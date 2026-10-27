import { useEffect, useMemo, useState } from "react";
import { siteInfo } from "../data/siteData.js";
import { invokeAdminReviewAction, isAdminEdgeFunctionsEnabled } from "../lib/adminReviewApi.js";
import { getPageHref } from "../lib/routes.js";
import { isSupabaseConfigured, supabase, supabaseConfigStatus } from "../lib/supabaseClient.js";
import {
  extractReviewMetadata,
  getReviewTextQuality,
  isPublishableReview,
  maskReviewAuthor,
} from "../utils/reviewText.js";

const REVIEW_PHOTO_BUCKET = "review-photos";
const DEFAULT_ADMIN_EMAIL = "tjdrhkde@gmail.com";
const MAX_REVIEW_PHOTOS = 8;
const MAX_REVIEW_UPLOAD_INPUT_FILES = 12;
const MAX_REVIEW_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_REVIEW_TEXT_LENGTH = 1200;
const MAX_REVIEW_AUTHOR_LENGTH = 40;
const MAX_REVIEW_TIME_LENGTH = 40;
const MAX_SOURCE_URL_LENGTH = 500;
const MIN_SIGN_IN_INTERVAL_MS = 2500;
const MIN_REVIEW_SUBMIT_INTERVAL_MS = 2500;
const SIGNED_REVIEW_PHOTO_EXPIRES_IN_SECONDS = 60 * 60;
const ALLOWED_REVIEW_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const ALLOWED_REVIEW_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);
const REVIEW_PHOTO_ACCEPT = Array.from(ALLOWED_REVIEW_IMAGE_TYPES).join(",");
const REVIEW_PHOTO_PUBLIC_SEGMENT = `/storage/v1/object/public/${REVIEW_PHOTO_BUCKET}/`;

const makeStarLabel = (rating) => `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;

const sanitizeSingleLine = (value, maxLength) =>
  String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

const sanitizeReviewText = (value) =>
  String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, MAX_REVIEW_TEXT_LENGTH);

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value ?? "").trim());

const normalizeSourceUrl = (value) => {
  const trimmed = sanitizeSingleLine(value, MAX_SOURCE_URL_LENGTH);

  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);

    if (!["http:", "https:"].includes(url.protocol)) {
      return "";
    }

    return url.href.slice(0, MAX_SOURCE_URL_LENGTH);
  } catch {
    return "";
  }
};

const getSafeErrorMessage = (fallback = "요청을 처리하지 못했습니다. 권한과 네트워크 상태를 확인하세요.") =>
  fallback;

const getFileExtension = (file) => file.name.split(".").pop()?.toLowerCase() ?? "";

const isAllowedReviewImageFile = (file) =>
  ALLOWED_REVIEW_IMAGE_TYPES.has(file.type) ||
  (!file.type && ALLOWED_REVIEW_IMAGE_EXTENSIONS.has(getFileExtension(file)));

const getReviewFileValidationError = (file) => {
  if (!file) {
    return "파일을 확인할 수 없습니다.";
  }

  if (file.size <= 0) {
    return "비어 있는 파일은 업로드할 수 없습니다.";
  }

  if (file.size > MAX_REVIEW_UPLOAD_SIZE_BYTES) {
    return "이미지는 5MB 이하만 업로드할 수 있습니다.";
  }

  if (!isAllowedReviewImageFile(file)) {
    return "JPG, PNG, WebP, HEIC 이미지만 업로드할 수 있습니다.";
  }

  return "";
};

const getStoragePathFromPhotoReference = (value) => {
  const rawValue = String(value ?? "").trim();

  if (!rawValue) {
    return "";
  }

  if (!/^https?:\/\//i.test(rawValue) && !rawValue.startsWith("/")) {
    return rawValue;
  }

  try {
    const url = new URL(rawValue);
    const index = url.pathname.indexOf(REVIEW_PHOTO_PUBLIC_SEGMENT);

    if (index === -1) {
      return "";
    }

    return decodeURIComponent(url.pathname.slice(index + REVIEW_PHOTO_PUBLIC_SEGMENT.length));
  } catch {
    return "";
  }
};

const isExternalLegacyPhotoUrl = (value) => {
  const rawValue = String(value ?? "").trim();
  return /^https?:\/\//i.test(rawValue) && !getStoragePathFromPhotoReference(rawValue);
};

const hashFileSha256 = async (file) => {
  if (!crypto?.subtle) {
    return "";
  }

  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const getInitialForm = () => ({
  author: "",
  rating: 5,
  time: "",
  sourceUrl: siteInfo.naverPlaceUrl,
  text: "",
  isPublished: true,
});

const canvasToBlob = (canvas, type = "image/jpeg", quality = 0.88) =>
  new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });

const createCroppedImageFile = async (bitmap, crop, namePrefix, type = "image/jpeg", quality = 0.88) => {
  const canvas = document.createElement("canvas");
  canvas.width = crop.width;
  canvas.height = crop.height;
  const context = canvas.getContext("2d");

  context.drawImage(
    bitmap,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );

  const blob = await canvasToBlob(canvas, type, quality);

  if (!blob) {
    return null;
  }

  const extension = type === "image/png" ? "png" : "jpg";

  return new File([blob], `${namePrefix}-${Date.now()}.${extension}`, { type });
};

const getPixelSignal = (data, index) => {
  const red = data[index];
  const green = data[index + 1];
  const blue = data[index + 2];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const saturation = max === 0 ? 0 : (max - min) / max;
  const brightness = (red + green + blue) / 3;
  const isWhite = brightness > 238 && saturation < 0.16;
  const isLightUi = brightness > 190 && saturation < 0.28;
  const isGrayText = brightness < 120 && max - min < 42;
  const isDark = brightness < 62;

  return {
    isPhotoLike: !isLightUi && !isGrayText && brightness > 36 && brightness < 244 && saturation > 0.12,
    isWhite,
    isLightUi,
    isGrayText,
    isDark,
  };
};

const analyzeImageSignal = (bitmap) => {
  const sampleWidth = 240;
  const sampleHeight = Math.max(1, Math.round((bitmap.height / bitmap.width) * sampleWidth));
  const canvas = document.createElement("canvas");
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  context.drawImage(bitmap, 0, 0, sampleWidth, sampleHeight);

  const { data } = context.getImageData(0, 0, sampleWidth, sampleHeight);
  let whitePixels = 0;
  let lightUiPixels = 0;
  let grayTextPixels = 0;
  let photoLikePixels = 0;
  let darkPixels = 0;
  const rowSignals = [];
  const contentBounds = {
    minX: sampleWidth,
    minY: sampleHeight,
    maxX: 0,
    maxY: 0,
  };

  for (let y = 0; y < sampleHeight; y += 1) {
    let rowPhotoPixels = 0;

    for (let x = 0; x < sampleWidth; x += 1) {
      const signal = getPixelSignal(data, (y * sampleWidth + x) * 4);

      if (signal.isWhite) {
        whitePixels += 1;
      }

      if (signal.isLightUi) {
        lightUiPixels += 1;
      }

      if (signal.isGrayText) {
        grayTextPixels += 1;
      }

      if (signal.isDark) {
        darkPixels += 1;
      }

      if (signal.isLightUi || signal.isGrayText) {
        contentBounds.minX = Math.min(contentBounds.minX, x);
        contentBounds.minY = Math.min(contentBounds.minY, y);
        contentBounds.maxX = Math.max(contentBounds.maxX, x);
        contentBounds.maxY = Math.max(contentBounds.maxY, y);
      }

      if (signal.isPhotoLike) {
        photoLikePixels += 1;
        rowPhotoPixels += 1;
      }
    }

    rowSignals.push(rowPhotoPixels / sampleWidth);
  }

  const totalPixels = sampleWidth * sampleHeight;

  return {
    sampleWidth,
    sampleHeight,
    rowSignals,
    whiteRatio: whitePixels / totalPixels,
    lightUiRatio: lightUiPixels / totalPixels,
    grayTextRatio: grayTextPixels / totalPixels,
    photoLikeRatio: photoLikePixels / totalPixels,
    darkRatio: darkPixels / totalPixels,
    contentBounds: contentBounds.minX <= contentBounds.maxX ? contentBounds : null,
  };
};

const isLikelyReviewCapture = (bitmap, signal) => {
  const aspectRatio = bitmap.height / bitmap.width;
  const hasReadableUi = signal.grayTextRatio > 0.004 && signal.lightUiRatio > 0.16;
  const hasPhoneScreenShape = aspectRatio > 1.12;
  const isCameraShotOfScreen = signal.darkRatio > 0.08 && signal.lightUiRatio > 0.2;

  return hasPhoneScreenShape && hasReadableUi && (signal.whiteRatio > 0.08 || isCameraShotOfScreen);
};

const getScaledContentCrop = (bitmap, signal) => {
  if (!signal.contentBounds) {
    return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  }

  const scaleX = bitmap.width / signal.sampleWidth;
  const scaleY = bitmap.height / signal.sampleHeight;
  const paddingX = Math.round(bitmap.width * 0.02);
  const paddingY = Math.round(bitmap.height * 0.02);
  const x = Math.max(0, Math.round(signal.contentBounds.minX * scaleX) - paddingX);
  const y = Math.max(0, Math.round(signal.contentBounds.minY * scaleY) - paddingY);
  const right = Math.min(bitmap.width, Math.round((signal.contentBounds.maxX + 1) * scaleX) + paddingX);
  const bottom = Math.min(bitmap.height, Math.round((signal.contentBounds.maxY + 1) * scaleY) + paddingY);
  const width = right - x;
  const height = bottom - y;

  if (width < bitmap.width * 0.45 || height < bitmap.height * 0.35) {
    return { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
  }

  return { x, y, width, height };
};

const createOcrReadyFile = async (bitmap, signal) => {
  const crop = getScaledContentCrop(bitmap, signal);
  const targetWidth = Math.min(1800, Math.max(1000, crop.width));
  const targetHeight = Math.round((crop.height / crop.width) * targetWidth);
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  context.drawImage(
    bitmap,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  const imageData = context.getImageData(0, 0, targetWidth, targetHeight);
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    const contrasted = Math.max(0, Math.min(255, (gray - 128) * 1.35 + 138));
    data[index] = contrasted;
    data[index + 1] = contrasted;
    data[index + 2] = contrasted;
  }

  context.putImageData(imageData, 0, 0);

  const blob = await canvasToBlob(canvas, "image/png");

  if (!blob) {
    return null;
  }

  return new File([blob], `review-ocr-${Date.now()}.png`, { type: "image/png" });
};

const createDisplayPhotoFile = async (bitmap) => {
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  context.drawImage(bitmap, 0, 0, width, height);

  const blob = await canvasToBlob(canvas, "image/jpeg", 0.86);

  if (!blob) {
    return null;
  }

  return new File([blob], `review-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
};

const findPhotoBands = ({ rowSignals, sampleHeight }) => {
  const bands = [];
  let start = null;

  rowSignals.forEach((signal, index) => {
    const isPhotoRow = signal > 0.1;

    if (isPhotoRow && start === null) {
      start = index;
    }

    if ((!isPhotoRow || index === rowSignals.length - 1) && start !== null) {
      const end = isPhotoRow && index === rowSignals.length - 1 ? index : index - 1;
      const height = end - start + 1;

      if (height > sampleHeight * 0.055) {
        bands.push({ start, end });
      }

      start = null;
    }
  });

  return bands;
};

const splitPhotoBandIntoColumns = (bitmap, band, signal) => {
  const canvas = document.createElement("canvas");
  canvas.width = signal.sampleWidth;
  canvas.height = signal.sampleHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });

  context.drawImage(bitmap, 0, 0, signal.sampleWidth, signal.sampleHeight);

  const { data } = context.getImageData(0, 0, signal.sampleWidth, signal.sampleHeight);
  const columnSignals = [];

  for (let x = 0; x < signal.sampleWidth; x += 1) {
    let columnPhotoPixels = 0;

    for (let y = band.start; y <= band.end; y += 1) {
      if (getPixelSignal(data, (y * signal.sampleWidth + x) * 4).isPhotoLike) {
        columnPhotoPixels += 1;
      }
    }

    columnSignals.push(columnPhotoPixels / (band.end - band.start + 1));
  }

  const columns = [];
  let start = null;

  columnSignals.forEach((value, index) => {
    const isPhotoColumn = value > 0.09;

    if (isPhotoColumn && start === null) {
      start = index;
    }

    if ((!isPhotoColumn || index === columnSignals.length - 1) && start !== null) {
      const end = isPhotoColumn && index === columnSignals.length - 1 ? index : index - 1;

      if (end - start + 1 > signal.sampleWidth * 0.18) {
        columns.push({ start, end });
      }

      start = null;
    }
  });

  return columns.length > 0 ? columns : [{ start: 0, end: signal.sampleWidth - 1 }];
};

const extractPhotoCandidatesFromCapture = async (bitmap, signal) => {
  const bands = findPhotoBands(signal)
    .filter((band) => band.start > signal.sampleHeight * 0.18)
    .filter((band) => band.end - band.start > signal.sampleHeight * 0.06)
    .sort((first, second) => second.end - second.start - (first.end - first.start))
    .slice(0, 3);
  const candidates = [];

  for (const band of bands) {
    const columns = splitPhotoBandIntoColumns(bitmap, band, signal).slice(0, 4);

    for (const column of columns) {
      const scaleX = bitmap.width / signal.sampleWidth;
      const scaleY = bitmap.height / signal.sampleHeight;
      const padding = 4;
      const cropX = Math.max(0, Math.round((column.start - padding) * scaleX));
      const cropY = Math.max(0, Math.round((band.start - padding) * scaleY));
      const cropRight = Math.min(bitmap.width, Math.round((column.end + padding + 1) * scaleX));
      const cropBottom = Math.min(bitmap.height, Math.round((band.end + padding + 1) * scaleY));
      const crop = {
        x: cropX,
        y: cropY,
        width: cropRight - cropX,
        height: cropBottom - cropY,
      };

      if (crop.width < bitmap.width * 0.24 || crop.height < bitmap.height * 0.045) {
        continue;
      }

      const candidate = await createCroppedImageFile(bitmap, crop, "review-photo");

      if (candidate) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
};

const analyzeReviewUpload = async (file) => {
  try {
    const bitmap = await createImageBitmap(file);
    const signal = analyzeImageSignal(bitmap);
    const isReviewCapture = isLikelyReviewCapture(bitmap, signal);

    if (!isReviewCapture) {
      const displayPhoto = await createDisplayPhotoFile(bitmap);
      bitmap.close();
      return {
        fileName: file.name,
        kind: "photo",
        ocrFile: null,
        photoFiles: displayPhoto ? [displayPhoto] : [],
      };
    }

    const [ocrFile, photoFiles] = await Promise.all([
      createOcrReadyFile(bitmap, signal),
      extractPhotoCandidatesFromCapture(bitmap, signal),
    ]);

    bitmap.close();
    return {
      fileName: file.name,
      kind: photoFiles.length > 0 ? "capture-with-photos" : "text-capture",
      ocrFile,
      photoFiles,
    };
  } catch {
    return {
      fileName: file.name,
      kind: "unsupported",
      ocrFile: null,
      photoFiles: [],
    };
  }
};

const getSafeImageExtension = (file) => {
  const extension = getFileExtension(file);

  if (ALLOWED_REVIEW_IMAGE_EXTENSIONS.has(extension)) {
    return extension;
  }

  if (file.type === "image/png") {
    return "png";
  }

  if (file.type === "image/webp") {
    return "webp";
  }

  return "jpg";
};

const getUploadPath = (userId, file, index) => {
  const randomId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.round(Math.random() * 100000)}`;

  return `${userId}/${Date.now()}-${index}-${randomId}.${getSafeImageExtension(file)}`;
};

function FilePreviewGrid({ previews, onRemove }) {
  if (previews.length === 0) {
    return null;
  }

  return (
    <div className="admin-photo-preview-grid" aria-label="선택한 리뷰 사진 미리보기">
      {previews.map((preview, index) => (
        <figure key={preview.url}>
          <img src={preview.url} alt={`${preview.name} 미리보기`} />
          <figcaption>{preview.name}</figcaption>
          <button type="button" onClick={() => onRemove(index)}>
            제외
          </button>
        </figure>
      ))}
    </div>
  );
}

function AdminLogin({ authForm, authStatus, isSigningIn, onChange, onSubmit }) {
  return (
    <form className="admin-card admin-login-card" onSubmit={onSubmit}>
      <p className="section-eyebrow">Secure Login</p>
      <h2>관리자 로그인</h2>
      <p>
        Supabase Authentication에 생성된 관리자 계정으로 로그인해야 리뷰와 사진을 등록할 수
        있습니다.
      </p>
      <label>
        이메일
        <input
          autoComplete="email"
          inputMode="email"
          name="email"
          type="email"
          value={authForm.email}
          onChange={onChange}
          required
        />
      </label>
      <label>
        비밀번호
        <input
          autoComplete="current-password"
          name="password"
          type="password"
          value={authForm.password}
          onChange={onChange}
          required
        />
      </label>
      <button className="admin-primary-button" type="submit" disabled={isSigningIn}>
        {isSigningIn ? "로그인 중" : "로그인"}
      </button>
      {authStatus ? <p className="admin-status-text">{authStatus}</p> : null}
    </form>
  );
}

export default function Admin() {
  const [session, setSession] = useState(null);
  const [authForm, setAuthForm] = useState({ email: DEFAULT_ADMIN_EMAIL, password: "" });
  const [authStatus, setAuthStatus] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [adminStatus, setAdminStatus] = useState({
    isChecking: false,
    isAdmin: false,
    error: "",
  });
  const [form, setForm] = useState(getInitialForm);
  const [ocrFiles, setOcrFiles] = useState([]);
  const [ocrText, setOcrText] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [isReadingOcr, setIsReadingOcr] = useState(false);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoPreviews, setPhotoPreviews] = useState([]);
  const [submitStatus, setSubmitStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [listStatus, setListStatus] = useState("");
  const [lastSignInAttemptAt, setLastSignInAttemptAt] = useState(0);
  const [lastReviewSubmitAt, setLastReviewSubmitAt] = useState(0);

  const userEmail = session?.user?.email ?? "";
  const canManageReviews = Boolean(session && adminStatus.isAdmin);
  const ratingOptions = useMemo(() => [5, 4, 3, 2, 1], []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      return undefined;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (isMounted) {
        setSession(data.session);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const previews = photoFiles.map((file) => ({
      name: file.name,
      url: URL.createObjectURL(file),
    }));

    setPhotoPreviews(previews);

    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [photoFiles]);

  const createSignedReviewPhotoUrls = async (review) => {
    const storedPaths = [
      ...(Array.isArray(review.image_paths) ? review.image_paths : []),
      ...(Array.isArray(review.image_urls)
        ? review.image_urls.map(getStoragePathFromPhotoReference).filter(Boolean)
        : []),
    ];
    const uniquePaths = Array.from(new Set(storedPaths)).slice(0, MAX_REVIEW_PHOTOS);
    let signedUrls = [];

    if (isAdminEdgeFunctionsEnabled && uniquePaths.length > 0) {
      const signedData = await invokeAdminReviewAction(supabase, "signedPhotoUrls", {
        paths: uniquePaths,
      });
      signedUrls = Array.isArray(signedData?.signedUrls) ? signedData.signedUrls : [];
    } else {
      const bucket = supabase.storage.from(REVIEW_PHOTO_BUCKET);

      for (const path of uniquePaths) {
        const { data, error } = await bucket.createSignedUrl(
          path,
          SIGNED_REVIEW_PHOTO_EXPIRES_IN_SECONDS,
        );

        if (!error && data?.signedUrl) {
          signedUrls.push(data.signedUrl);
        }
      }
    }

    const legacyExternalUrls = Array.isArray(review.image_urls)
      ? review.image_urls.filter(isExternalLegacyPhotoUrl)
      : [];

    return [...signedUrls, ...legacyExternalUrls].slice(0, MAX_REVIEW_PHOTOS);
  };

  const hydrateReviewPhotoUrls = async (reviewRows = []) =>
    Promise.all(
      reviewRows.map(async (review) => ({
        ...review,
        display_image_urls: await createSignedReviewPhotoUrls(review),
      })),
    );

  const recordAuditLog = async (action, metadata = {}, reviewId = null) => {
    if (!session?.user?.id) {
      return "감사 로그를 기록할 관리자 세션을 확인할 수 없습니다.";
    }

    const { error } = await supabase.from("homepage_review_audit_logs").insert({
      action,
      review_id: reviewId,
      actor_user_id: session.user.id,
      metadata,
    });

    if (error) {
      return "감사 로그 기록을 확인해야 합니다.";
    }

    return "";
  };

  const loadAdminReviews = async () => {
    setListStatus("리뷰 목록을 불러오는 중입니다.");

    const { data, error } = await supabase
      .from("homepage_reviews")
      .select(
        "id, author, label, text, time, rating, is_published, created_at, image_urls, image_paths, image_hashes, source_url",
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setListStatus(getSafeErrorMessage("목록을 불러오지 못했습니다. 관리자 권한과 네트워크 상태를 확인하세요."));
      return;
    }

    try {
      setReviews(await hydrateReviewPhotoUrls(data ?? []));
      setListStatus("");
    } catch {
      setReviews(data ?? []);
      setListStatus("목록은 불러왔지만 일부 사진 서명 URL을 만들지 못했습니다.");
    }
  };

  const checkAdminAccess = async () => {
    setAdminStatus({ isChecking: true, isAdmin: false, error: "" });

    const { data, error } = await supabase.rpc("is_homepage_admin");

    if (error) {
      setAdminStatus({
        isChecking: false,
        isAdmin: false,
        error: "관리자 권한을 확인하지 못했습니다. 로그인 상태와 네트워크를 확인하세요.",
      });
      return;
    }

    setAdminStatus({
      isChecking: false,
      isAdmin: Boolean(data),
      error: data ? "" : "이 이메일은 아직 홈페이지 관리자 목록에 없습니다.",
    });

    if (data) {
      await loadAdminReviews();
    }
  };

  useEffect(() => {
    if (!session || !isSupabaseConfigured) {
      setAdminStatus({ isChecking: false, isAdmin: false, error: "" });
      setReviews([]);
      return;
    }

    checkAdminAccess();
  }, [session]);

  const handleAuthFieldChange = (event) => {
    const { name, value } = event.target;
    setAuthForm((current) => ({
      ...current,
      [name]: name === "email" ? sanitizeSingleLine(value, 120) : value,
    }));
  };

  const handleSignIn = async (event) => {
    event.preventDefault();

    const email = sanitizeSingleLine(authForm.email, 120);
    const now = Date.now();

    if (!isValidEmail(email)) {
      setAuthStatus("이메일 형식을 확인하세요.");
      return;
    }

    if (now - lastSignInAttemptAt < MIN_SIGN_IN_INTERVAL_MS) {
      setAuthStatus("잠시 후 다시 시도하세요.");
      return;
    }

    setLastSignInAttemptAt(now);
    setIsSigningIn(true);
    setAuthStatus("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: authForm.password,
    });

    setIsSigningIn(false);

    if (error) {
      setAuthStatus("로그인 실패: 이메일 또는 비밀번호를 확인하세요.");
      return;
    }

    setAuthStatus("로그인되었습니다.");
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setAuthStatus("");
    setSubmitStatus("");
  };

  const handleFormChange = (event) => {
    const { checked, name, type, value } = event.target;
    const nextValue =
      name === "text"
        ? sanitizeReviewText(value)
        : name === "sourceUrl"
          ? sanitizeSingleLine(value, MAX_SOURCE_URL_LENGTH)
          : name === "author"
            ? sanitizeSingleLine(value, MAX_REVIEW_AUTHOR_LENGTH)
            : name === "time"
              ? sanitizeSingleLine(value, MAX_REVIEW_TIME_LENGTH)
              : value;

    setForm((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : nextValue,
    }));
  };

  const handleUnifiedReviewImageChange = async (event) => {
    const rawFiles = Array.from(event.target.files ?? []).slice(0, MAX_REVIEW_UPLOAD_INPUT_FILES);
    const rejectedMessages = [];
    const selectedFiles = rawFiles.filter((file) => {
      const validationError = getReviewFileValidationError(file);

      if (validationError) {
        rejectedMessages.push(`${file.name}: ${validationError}`);
        return false;
      }

      return true;
    });

    if (selectedFiles.length === 0) {
      if (rejectedMessages.length > 0) {
        setSubmitStatus(rejectedMessages.slice(0, 2).join(" "));
      }

      event.target.value = "";
      return;
    }

    setOcrText("");
    setSubmitStatus(
      `${selectedFiles.length}개 이미지에서 리뷰와 사진 후보를 분석하는 중입니다.${
        rejectedMessages.length > 0 ? ` 제외된 파일 ${rejectedMessages.length}개.` : ""
      }`,
    );

    const uploadResults = await Promise.all(selectedFiles.map(analyzeReviewUpload));
    const nextOcrFiles = uploadResults.flatMap((result) => (result.ocrFile ? [result.ocrFile] : []));
    const nextPhotoFiles = uploadResults.flatMap((result) => result.photoFiles).slice(0, MAX_REVIEW_PHOTOS);
    const captureCount = uploadResults.filter((result) => result.kind !== "photo").length;
    const textOnlyCount = uploadResults.filter((result) => result.kind === "text-capture").length;

    setOcrFiles(nextOcrFiles);
    setPhotoFiles((current) => [...current, ...nextPhotoFiles].slice(0, MAX_REVIEW_PHOTOS));

    if (nextOcrFiles.length > 0) {
      handleReadOcr(nextOcrFiles);
    } else {
      setOcrStatus("리뷰 화면으로 보이는 이미지를 찾지 못했습니다. 실제 음식 사진만 선택한 경우 리뷰 문구는 직접 입력하세요.");
    }

    setSubmitStatus(
      nextPhotoFiles.length > 0
        ? `${nextPhotoFiles.length}개 사진 후보를 찾았습니다. 필요 없는 사진은 제외하세요.`
        : textOnlyCount > 0
          ? "글만 있는 리뷰 캡처로 판단했습니다. 사진 없이 저장됩니다."
          : captureCount > 0
            ? "리뷰 화면은 읽었지만 음식 사진 후보는 찾지 못했습니다."
            : "표시 사진 후보가 없습니다.",
    );
    event.target.value = "";
  };

  const handleRemovePhoto = (indexToRemove) => {
    setPhotoFiles((current) => current.filter((_file, index) => index !== indexToRemove));
  };

  const uploadReviewPhotos = async () => {
    if (photoFiles.length === 0) {
      return { imagePaths: [], imageHashes: [] };
    }

    const bucket = supabase.storage.from(REVIEW_PHOTO_BUCKET);
    const imagePaths = [];
    const imageHashes = [];

    for (const [index, file] of photoFiles.entries()) {
      const validationError = getReviewFileValidationError(file);

      if (validationError) {
        throw new Error(validationError);
      }

      const path = getUploadPath(session.user.id, file, index);
      const { error } = await bucket.upload(path, file, {
        cacheControl: "3600",
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

      if (error) {
        throw new Error("사진 업로드에 실패했습니다.");
      }

      imagePaths.push(path);
      imageHashes.push(await hashFileSha256(file));
    }

    return { imagePaths, imageHashes };
  };

  const handleReadOcr = async (selectedInput = ocrFiles) => {
    const selectedFiles = Array.isArray(selectedInput)
      ? selectedInput.filter(Boolean)
      : [selectedInput].filter(Boolean);

    if (selectedFiles.length === 0) {
      setOcrStatus("먼저 리뷰 캡처 이미지를 선택하세요.");
      return;
    }

    setIsReadingOcr(true);
    setOcrStatus(`${selectedFiles.length}개 이미지 OCR 엔진을 준비하는 중입니다.`);

    let worker;

    try {
      const { createWorker } = await import("tesseract.js");

      worker = await createWorker("kor+eng", 1, {
        logger: (message) => {
          if (!message.status) {
            return;
          }

          const progress = Number.isFinite(message.progress)
            ? ` ${Math.round(message.progress * 100)}%`
            : "";
          setOcrStatus(`${message.status}${progress}`);
        },
      });

      const recognizedTexts = [];

      for (const [index, file] of selectedFiles.entries()) {
        setOcrStatus(`${index + 1}/${selectedFiles.length} 이미지 글자를 읽는 중입니다.`);
        const {
          data: { text },
        } = await worker.recognize(file);

        recognizedTexts.push(text);
      }

      const rawText = recognizedTexts.join("\n");
      const extractedReview = extractReviewMetadata(rawText);
      const cleanedText = extractedReview.text;
      const fallbackText = rawText.trim().slice(0, 900);
      const nextText = cleanedText;
      const textQuality = getReviewTextQuality(nextText || fallbackText);

      setOcrText(nextText || fallbackText);
      setForm((current) => ({
        ...current,
        author: extractedReview.author || current.author,
        rating: extractedReview.rating || current.rating,
        time: extractedReview.time || current.time,
        text: nextText || current.text,
        isPublished: textQuality.isUsable ? current.isPublished : false,
      }));
      setOcrStatus(
        cleanedText && textQuality.isUsable
          ? "OCR 읽기와 자동 정제가 완료되었습니다. 내용을 확인하고 저장하세요."
          : "촬영본 OCR 품질이 낮아 비공개로 전환했습니다. 실제 리뷰 문구를 직접 확인해서 수정한 뒤 공개하세요.",
      );
    } catch {
      setOcrStatus("OCR 실패: 이미지 형식과 글자 선명도를 확인하세요.");
    } finally {
      if (worker) {
        await worker.terminate();
      }

      setIsReadingOcr(false);
    }
  };

  const handleUseOcrText = () => {
    setForm((current) => ({
      ...current,
      text: ocrText,
    }));
  };

  const resetForm = () => {
    setForm(getInitialForm());
    setOcrFiles([]);
    setOcrText("");
    setOcrStatus("");
    setPhotoFiles([]);
    setSubmitStatus("");
  };

  const handleSubmitReview = async (event) => {
    event.preventDefault();
    const now = Date.now();

    if (!canManageReviews) {
      setSubmitStatus("관리자 권한 확인 후 저장할 수 있습니다.");
      return;
    }

    if (now - lastReviewSubmitAt < MIN_REVIEW_SUBMIT_INTERVAL_MS) {
      setSubmitStatus("잠시 후 다시 저장하세요.");
      return;
    }

    const author = sanitizeSingleLine(form.author, MAX_REVIEW_AUTHOR_LENGTH);
    const reviewText = sanitizeReviewText(form.text);
    const reviewTime = sanitizeSingleLine(form.time, MAX_REVIEW_TIME_LENGTH);
    const sourceUrl = normalizeSourceUrl(form.sourceUrl) || siteInfo.naverPlaceUrl;

    if (!reviewText) {
      setSubmitStatus("리뷰 내용을 입력하거나 OCR로 읽어온 뒤 확인하세요.");
      return;
    }

    if (!author) {
      setSubmitStatus("작성자 아이디를 확인하세요. 캡처에서 못 읽은 경우 직접 입력해야 합니다.");
      return;
    }

    if (form.sourceUrl.trim() && !normalizeSourceUrl(form.sourceUrl)) {
      setSubmitStatus("출처 URL은 http 또는 https 주소만 입력할 수 있습니다.");
      return;
    }

    if (form.isPublished && !isPublishableReview({ author, text: reviewText })) {
      setSubmitStatus(
        "OCR 품질이 낮거나 작성자/본문이 불완전합니다. 실제 리뷰 문구를 수정하거나 비공개로 저장하세요.",
      );
      return;
    }

    setLastReviewSubmitAt(now);
    setIsSubmitting(true);
    setSubmitStatus("사진을 업로드하고 리뷰를 저장하는 중입니다.");

    try {
      const rating = Number(form.rating);
      const { imagePaths, imageHashes } = await uploadReviewPhotos();
      const reviewPayload = {
        author: maskReviewAuthor(author),
        label: makeStarLabel(rating),
        text: reviewText,
        time: reviewTime || null,
        rating,
        sourceUrl,
        imagePaths,
        imageHashes,
        isPublished: form.isPublished,
      };
      let saveStatus = form.isPublished
        ? "저장 완료. 공개 가능 데이터로 보관되었습니다."
        : "저장 완료. 비공개 검수 데이터로 보관되었습니다.";

      if (isAdminEdgeFunctionsEnabled) {
        await invokeAdminReviewAction(supabase, "createReview", reviewPayload);
      } else {
        const photoAuditWarning =
          imagePaths.length > 0
            ? await recordAuditLog("review_photo_upload", { image_count: imagePaths.length })
            : "";

        const { data, error } = await supabase
          .from("homepage_reviews")
          .insert({
            author: reviewPayload.author,
            label: reviewPayload.label,
            text: reviewPayload.text,
            time: reviewPayload.time,
            rating,
            source_type: "naver",
            source_url: sourceUrl,
            image_paths: imagePaths,
            image_hashes: imageHashes,
            image_urls: [],
            is_published: form.isPublished,
          })
          .select("id")
          .single();

        if (error) {
          throw new Error("리뷰 저장에 실패했습니다.");
        }

        const createAuditWarning = await recordAuditLog(
          "review_create",
          {
            is_published: form.isPublished,
            image_count: imagePaths.length,
            has_source_url: Boolean(sourceUrl),
          },
          data?.id ?? null,
        );

        if (photoAuditWarning || createAuditWarning) {
          saveStatus = `저장 완료. ${photoAuditWarning || createAuditWarning}`;
        }
      }

      resetForm();
      setSubmitStatus(saveStatus);
      await loadAdminReviews();
    } catch (error) {
      const message = error instanceof Error ? String(error).replace(/^Error:\s*/, "") : "";
      setSubmitStatus(getSafeErrorMessage(message || "저장에 실패했습니다."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePublished = async (review) => {
    const nextPublished = !review.is_published;
    let listWarning = "";

    try {
      if (isAdminEdgeFunctionsEnabled) {
        await invokeAdminReviewAction(supabase, "togglePublished", {
          id: review.id,
          isPublished: nextPublished,
        });
      } else {
        const { error } = await supabase
          .from("homepage_reviews")
          .update({ is_published: nextPublished })
          .eq("id", review.id);

        if (error) {
          throw new Error("공개 상태를 변경하지 못했습니다.");
        }

        const auditWarning = await recordAuditLog(
          "review_publish_toggle",
          { is_published: nextPublished },
          review.id,
        );

        if (auditWarning) {
          listWarning = `공개 상태는 변경됐지만 ${auditWarning}`;
        }
      }

      await loadAdminReviews();
      if (listWarning) {
        setListStatus(listWarning);
      }
    } catch {
      setListStatus("공개 상태를 변경하지 못했습니다. 관리자 권한을 확인하세요.");
    }
  };

  const handleDeleteReview = async (review) => {
    const confirmed = window.confirm(
      isAdminEdgeFunctionsEnabled
        ? "이 리뷰를 삭제할까요? private storage에 저장된 리뷰 사진 파일도 함께 삭제됩니다."
        : "이 리뷰를 삭제할까요? Edge Function 비활성 상태에서는 저장된 사진 파일은 삭제하지 않고 보존됩니다.",
    );

    if (!confirmed) {
      return;
    }

    const imageCount =
      (Array.isArray(review.image_paths) ? review.image_paths.length : 0) +
      (Array.isArray(review.image_urls) ? review.image_urls.length : 0);
    let listWarning = "";

    try {
      if (isAdminEdgeFunctionsEnabled) {
        const deleteResult = await invokeAdminReviewAction(supabase, "deleteReview", {
          id: review.id,
          wasPublished: Boolean(review.is_published),
          imageCount,
        });
        const deletedImageCount = Number(deleteResult?.deletedImageCount) || 0;

        if (deletedImageCount > 0) {
          listWarning = `리뷰와 private storage 사진 ${deletedImageCount}개를 삭제했습니다.`;
        }
      } else {
        const { error } = await supabase.from("homepage_reviews").delete().eq("id", review.id);

        if (error) {
          throw new Error("삭제하지 못했습니다.");
        }

        const auditWarning = await recordAuditLog(
          "review_delete",
          {
            was_published: Boolean(review.is_published),
            image_count: imageCount,
          },
          review.id,
        );

        if (auditWarning) {
          listWarning = `리뷰는 삭제됐지만 ${auditWarning}`;
        }
      }

      await loadAdminReviews();
      if (listWarning) {
        setListStatus(listWarning);
      }
    } catch {
      setListStatus("삭제하지 못했습니다. 관리자 권한을 확인하세요.");
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <section className="admin-page">
        <div className="container admin-shell">
          <div className="admin-card">
            <h1>Supabase 설정 필요</h1>
            <p>
              관리자 앱을 사용하려면 형식이 올바른 `VITE_SUPABASE_URL`과
              `VITE_SUPABASE_ANON_KEY`가 필요합니다.
            </p>
            <p>
              URL 설정: {supabaseConfigStatus.isValidUrl ? "확인됨" : "확인 필요"} / 공개 키
              설정: {supabaseConfigStatus.isPublishableKey ? "확인됨" : "확인 필요"}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="admin-page" aria-labelledby="admin-title">
      <div className="container admin-shell">
        <div className="admin-hero">
          <div>
            <p className="section-eyebrow">Review Admin</p>
            <h1 id="admin-title">리뷰 관리자 앱</h1>
            <p>
              네이버 리뷰 캡처를 OCR로 읽고 리뷰 사진을 private storage에 보관합니다. 현재
              고객 화면에는 자동 노출하지 않습니다.
            </p>
          </div>
          <a className="admin-secondary-button" href={getPageHref("home")}>
            홈페이지 보기
          </a>
        </div>

        {!session ? (
          <AdminLogin
            authForm={authForm}
            authStatus={authStatus}
            isSigningIn={isSigningIn}
            onChange={handleAuthFieldChange}
            onSubmit={handleSignIn}
          />
        ) : (
          <>
            <div className="admin-card admin-session-card">
              <div>
                <span>로그인 계정</span>
                <strong>{userEmail}</strong>
                <p>
                  관리자 작업 경계:{" "}
                  {isAdminEdgeFunctionsEnabled ? "Edge Function 서버 검증" : "Supabase RLS 직접 검증"}
                </p>
                {adminStatus.isChecking ? <p>관리자 권한 확인 중입니다.</p> : null}
                {adminStatus.error ? <p>{adminStatus.error}</p> : null}
              </div>
              <button className="admin-secondary-button" type="button" onClick={handleSignOut}>
                로그아웃
              </button>
            </div>

            {canManageReviews ? (
              <>
                <form className="admin-grid" onSubmit={handleSubmitReview}>
                  <div className="admin-card admin-form-card">
                    <p className="section-eyebrow">Review</p>
                    <h2>자동 입력 결과</h2>
                    <label>
                      작성자 표시명
                      <input
                        maxLength={MAX_REVIEW_AUTHOR_LENGTH}
                        name="author"
                        placeholder="예: 작성자**"
                        value={form.author}
                        onChange={handleFormChange}
                        required
                      />
                    </label>
                    <div className="admin-inline-fields">
                      <label>
                        별점
                        <select name="rating" value={form.rating} onChange={handleFormChange}>
                          {ratingOptions.map((rating) => (
                            <option key={rating} value={rating}>
                              {makeStarLabel(rating)} {rating}점
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        리뷰 날짜
                        <input
                          maxLength={MAX_REVIEW_TIME_LENGTH}
                          name="time"
                          placeholder="예: 5.3.일"
                          value={form.time}
                          onChange={handleFormChange}
                        />
                      </label>
                    </div>
                    <label>
                      출처 URL
                      <input
                        inputMode="url"
                        maxLength={MAX_SOURCE_URL_LENGTH}
                        name="sourceUrl"
                        type="url"
                        value={form.sourceUrl}
                        onChange={handleFormChange}
                      />
                    </label>
                    <label>
                      리뷰 문구
                      <textarea
                        name="text"
                        maxLength={MAX_REVIEW_TEXT_LENGTH}
                        rows="7"
                        value={form.text}
                        onChange={handleFormChange}
                        placeholder="OCR 결과를 확인한 뒤 실제 리뷰 문구만 남기세요."
                        required
                      />
                    </label>
                    <label className="admin-checkbox">
                      <input
                        checked={form.isPublished}
                        name="isPublished"
                        type="checkbox"
                        onChange={handleFormChange}
                      />
                      공개 가능 데이터로 표시
                    </label>
                  </div>

                  <div className="admin-card admin-upload-card">
                    <p className="section-eyebrow">One Shot</p>
                    <h2>리뷰 자료 한 번에 업로드</h2>
                    <p>
                      리뷰 캡처와 음식 사진을 여러 장 한 번에 선택하세요. 앱이 글자와 사진 후보를
                      자동으로 분리합니다.
                    </p>
                    <label>
                      캡처/사진 여러 장 선택
                      <input
                        accept={REVIEW_PHOTO_ACCEPT}
                        multiple
                        type="file"
                        onChange={handleUnifiedReviewImageChange}
                      />
                    </label>
                    <label>
                      카메라로 촬영해서 추가
                      <input
                        accept={REVIEW_PHOTO_ACCEPT}
                        capture="environment"
                        type="file"
                        onChange={handleUnifiedReviewImageChange}
                      />
                    </label>
                    <button
                      className="admin-secondary-button"
                      disabled={isReadingOcr}
                      type="button"
                      onClick={() => handleReadOcr()}
                    >
                      {isReadingOcr ? "자동 입력 중" : "다시 읽기"}
                    </button>
                    {ocrStatus ? <p className="admin-status-text">{ocrStatus}</p> : null}
                    <div className="admin-photo-candidates">
                      <strong>홈페이지 표시 사진 후보</strong>
                      {photoPreviews.length > 0 ? (
                        <>
                          <FilePreviewGrid previews={photoPreviews} onRemove={handleRemovePhoto} />
                          <button
                            className="admin-secondary-button"
                            type="button"
                            onClick={() => setPhotoFiles([])}
                          >
                            사진 후보 전체 비우기
                          </button>
                        </>
                      ) : (
                        <p>사진 후보가 없으면 글만 있는 리뷰로 저장됩니다.</p>
                      )}
                    </div>
                    {ocrText ? (
                      <div className="admin-ocr-result">
                        <strong>OCR 결과</strong>
                        <pre>{ocrText}</pre>
                        <button className="admin-secondary-button" type="button" onClick={handleUseOcrText}>
                          본문에 넣기
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div className="admin-card admin-submit-card">
                    <button className="admin-primary-button" disabled={isSubmitting} type="submit">
                      {isSubmitting ? "저장 중" : "리뷰 저장"}
                    </button>
                    <button className="admin-secondary-button" type="button" onClick={resetForm}>
                      입력 초기화
                    </button>
                    {submitStatus ? <p className="admin-status-text">{submitStatus}</p> : null}
                  </div>
                </form>

                <section className="admin-card admin-review-list" aria-labelledby="admin-list-title">
                  <div className="admin-list-header">
                    <div>
                      <p className="section-eyebrow">Published Data</p>
                      <h2 id="admin-list-title">등록된 리뷰</h2>
                    </div>
                    <button className="admin-secondary-button" type="button" onClick={loadAdminReviews}>
                      새로고침
                    </button>
                  </div>
                  {listStatus ? <p className="admin-status-text">{listStatus}</p> : null}
                  <div className="admin-review-items">
                    {reviews.map((review) => (
                      <article key={review.id} className="admin-review-item">
                        <div>
                          <div className="admin-review-meta">
                            <strong>{review.author}</strong>
                            <span>{review.label ?? makeStarLabel(review.rating ?? 5)}</span>
                            <em>{review.is_published ? "공개" : "비공개"}</em>
                          </div>
                          <p>{review.text}</p>
                          {Array.isArray(review.display_image_urls) &&
                          review.display_image_urls.length > 0 ? (
                            <div className="admin-review-photo-row">
                              {review.display_image_urls.slice(0, 4).map((url) => (
                                <img key={url} src={url} alt={`${review.author} 리뷰 사진`} />
                              ))}
                            </div>
                          ) : null}
                        </div>
                        <div className="admin-review-actions">
                          <button
                            className="admin-secondary-button"
                            type="button"
                            onClick={() => handleTogglePublished(review)}
                          >
                            {review.is_published ? "비공개" : "공개"}
                          </button>
                          <button
                            className="admin-danger-button"
                            type="button"
                            onClick={() => handleDeleteReview(review)}
                          >
                            삭제
                          </button>
                        </div>
                      </article>
                    ))}
                    {reviews.length === 0 && !listStatus ? <p>아직 등록된 리뷰가 없습니다.</p> : null}
                  </div>
                </section>
              </>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
