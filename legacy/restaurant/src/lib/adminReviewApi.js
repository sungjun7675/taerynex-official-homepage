const adminEdgeFlag = String(import.meta.env.VITE_USE_ADMIN_EDGE_FUNCTIONS ?? "").trim().toLowerCase();

export const isAdminEdgeFunctionsEnabled = ["1", "true", "yes", "on"].includes(adminEdgeFlag);

export const invokeAdminReviewAction = async (supabase, action, payload = {}) => {
  const { data, error } = await supabase.functions.invoke("admin-review", {
    body: { action, payload },
  });

  if (error) {
    throw new Error("관리자 서버 작업을 처리하지 못했습니다.");
  }

  if (!data?.ok) {
    throw new Error(data?.message || "관리자 서버 작업을 처리하지 못했습니다.");
  }

  return data.data ?? null;
};
