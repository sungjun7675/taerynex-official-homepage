import { existsSync, readFileSync } from "node:fs";

const results = [];
const root = process.cwd();

const pass = (name) => results.push({ status: "PASS", name });
const fail = (name, detail = "") => results.push({ status: "FAIL", name, detail });
const skip = (name, detail = "") => results.push({ status: "SKIP", name, detail });

const readEnvFile = (path) => {
  if (!existsSync(path)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const [key, ...rest] = line.split("=");
        return [key.trim(), rest.join("=").trim().replace(/^["']|["']$/g, "")];
      }),
  );
};

const fileEnv = {
  ...readEnvFile(`${root}/.env`),
  ...readEnvFile(`${root}/.env.local`),
};

const env = (name, fallbackName = name) =>
  process.env[name] || process.env[fallbackName] || fileEnv[name] || fileEnv[fallbackName] || "";

const supabaseUrl = env("SUPABASE_URL", "VITE_SUPABASE_URL").replace(/\/+$/, "");
const anonKey = env("SUPABASE_ANON_KEY", "VITE_SUPABASE_ANON_KEY");
const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
const adminEmail = env("SUPABASE_SECURITY_TEST_ADMIN_EMAIL");
const adminPassword = env("SUPABASE_SECURITY_TEST_ADMIN_PASSWORD");
const testStoragePath = env("SUPABASE_SECURITY_TEST_STORAGE_PATH");
const expectEdgeFunction = ["1", "true", "yes", "on"].includes(
  env("SUPABASE_SECURITY_TEST_EDGE").toLowerCase(),
);

const isValidSupabaseUrl = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl);
const isLikelyPublishableKey =
  /^(eyJ|sb_publishable_)[A-Za-z0-9_.-]{20,}$/.test(anonKey) && !/service_role|sb_secret_/i.test(anonKey);

const supabaseFetch = (path, options = {}, bearer = anonKey) =>
  fetch(`${supabaseUrl}${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

const readJson = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

if (!supabaseUrl || !anonKey) {
  skip("Supabase live checks", "SUPABASE_URL/VITE_SUPABASE_URL 또는 ANON_KEY가 없습니다.");
} else if (!isValidSupabaseUrl || !isLikelyPublishableKey) {
  fail("Supabase env format", "URL 또는 publishable/anon key 형식이 올바르지 않습니다.");
} else {
  pass("Supabase env format");

  const anonAdminRpc = await supabaseFetch("/rest/v1/rpc/is_homepage_admin", {
    method: "POST",
    body: "{}",
  });
  const anonAdminResult = await readJson(anonAdminRpc);

  if (anonAdminRpc.ok && anonAdminResult === false) {
    pass("anon is not homepage admin");
  } else if ([401, 403].includes(anonAdminRpc.status)) {
    pass("anon admin RPC is denied");
  } else {
    fail("anon is not homepage admin", `unexpected status ${anonAdminRpc.status}`);
  }

  const privateFieldResponse = await supabaseFetch(
    "/rest/v1/homepage_reviews?select=id,image_paths,image_hashes&is_published=eq.true&limit=1",
  );
  const privateFieldRows = await readJson(privateFieldResponse);

  if ([401, 403].includes(privateFieldResponse.status)) {
    pass("anon cannot query internal review table");
  } else if (privateFieldResponse.status === 400) {
    fail(
      "anon review table boundary",
      "보안 마이그레이션이 운영 DB에 아직 적용되지 않았거나 공개 테이블 스키마가 최신 코드와 다릅니다.",
    );
  } else if (privateFieldResponse.ok && Array.isArray(privateFieldRows)) {
    const exposed = privateFieldRows.some(
      (row) =>
        (Array.isArray(row.image_paths) && row.image_paths.length > 0) ||
        (Array.isArray(row.image_hashes) && row.image_hashes.length > 0),
    );
    if (exposed) {
      fail("anon cannot read private review image fields", "published row exposed image_paths/image_hashes");
    } else {
      pass("anon query did not expose private review image fields");
    }
  } else {
    fail("anon review table boundary", `unexpected status ${privateFieldResponse.status}`);
  }

  if (testStoragePath) {
    const publicObjectResponse = await fetch(
      `${supabaseUrl}/storage/v1/object/public/review-photos/${encodeURIComponent(testStoragePath)}`,
      { headers: { apikey: anonKey } },
    );

    if (publicObjectResponse.status === 200) {
      fail("review-photos bucket is not publicly readable", "public object endpoint returned 200");
    } else {
      pass("review-photos bucket is not publicly readable");
    }
  } else {
    skip("review-photos public object probe", "SUPABASE_SECURITY_TEST_STORAGE_PATH가 없어 실제 객체 검증은 생략합니다.");
  }

  if (expectEdgeFunction) {
    const unauthFunctionResponse = await fetch(`${supabaseUrl}/functions/v1/admin-review`, {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "signedPhotoUrls", payload: { paths: [] } }),
    });

    if ([401, 403].includes(unauthFunctionResponse.status)) {
      pass("admin-review function rejects unauthenticated calls");
    } else {
      fail("admin-review function rejects unauthenticated calls", `status ${unauthFunctionResponse.status}`);
    }
  } else {
    skip("admin-review function live probe", "SUPABASE_SECURITY_TEST_EDGE=true일 때 실행합니다.");
  }

  if (adminEmail && adminPassword) {
    const tokenResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: adminEmail, password: adminPassword }),
    });
    const tokenData = await readJson(tokenResponse);
    const accessToken = tokenData?.access_token ?? "";

    if (!tokenResponse.ok || !accessToken) {
      fail("admin test login", `status ${tokenResponse.status}`);
    } else {
      pass("admin test login");

      const adminRpcResponse = await supabaseFetch(
        "/rest/v1/rpc/is_homepage_admin",
        { method: "POST", body: "{}" },
        accessToken,
      );
      const adminRpcResult = await readJson(adminRpcResponse);

      if (adminRpcResponse.ok && adminRpcResult === true) {
        pass("admin account is active homepage admin");
      } else {
        fail("admin account is active homepage admin", `status ${adminRpcResponse.status}`);
      }

      if (expectEdgeFunction) {
        const functionResponse = await fetch(`${supabaseUrl}/functions/v1/admin-review`, {
          method: "POST",
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ action: "signedPhotoUrls", payload: { paths: [] } }),
        });

        if (functionResponse.ok) {
          pass("admin-review function accepts active admin");
        } else {
          fail("admin-review function accepts active admin", `status ${functionResponse.status}`);
        }
      }
    }
  } else {
    skip("admin credential checks", "SUPABASE_SECURITY_TEST_ADMIN_EMAIL/PASSWORD가 없어 관리자 로그인 검증은 생략합니다.");
  }

  if (serviceRoleKey) {
    const rateLimitResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/homepage_take_rate_limit`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_key: `local-security-check-${Date.now()}`,
        p_limit: 5,
        p_window_seconds: 60,
      }),
    });
    const rateLimitRows = await readJson(rateLimitResponse);
    const rateLimitState = Array.isArray(rateLimitRows) ? rateLimitRows[0] : rateLimitRows;

    if (rateLimitResponse.ok && rateLimitState?.allowed === true) {
      pass("service-role rate limit RPC works");
    } else {
      fail("service-role rate limit RPC works", `status ${rateLimitResponse.status}`);
    }
  } else {
    skip("service-role rate limit RPC", "SUPABASE_SERVICE_ROLE_KEY가 로컬에 없어 service-role 검증은 생략합니다.");
  }
}

for (const result of results) {
  const suffix = result.detail ? ` - ${result.detail}` : "";
  console.log(`${result.status}: ${result.name}${suffix}`);
}

const failed = results.filter((result) => result.status === "FAIL");

if (failed.length > 0) {
  console.error(`Supabase security check failed: ${failed.length} issue(s).`);
  process.exitCode = 1;
} else {
  console.log(`Supabase security check completed: ${results.length} checks, ${failed.length} failed.`);
}
