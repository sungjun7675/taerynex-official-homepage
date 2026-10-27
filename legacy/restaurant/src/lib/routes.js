export const pagePathById = {
  home: "/",
  menu: "/menu",
  store: "/store",
  reviews: "/reviews",
  location: "/location",
  reservation: "/reservation",
  admin: "/admin",
};

const pageIds = new Set(Object.keys(pagePathById));
const basePath = import.meta.env.BASE_URL || "/";

export const usesPathRouting = basePath === "/";

const getHashPage = () => {
  const hashPage = window.location.hash.replace("#", "").trim();

  return pageIds.has(hashPage) ? hashPage : "";
};

const getPathPage = () => {
  let path = window.location.pathname;

  if (basePath !== "/" && path.startsWith(basePath)) {
    path = `/${path.slice(basePath.length)}`;
  }

  const normalizedPath = path.replace(/\/+$/, "") || "/";
  const match = Object.entries(pagePathById).find(([, pagePath]) => pagePath === normalizedPath);

  return match?.[0] || "";
};

export const getPageHref = (pageId) => {
  if (!pageIds.has(pageId)) {
    return usesPathRouting ? pagePathById.home : "#home";
  }

  return usesPathRouting ? pagePathById[pageId] : `#${pageId}`;
};

export const getCurrentPageFromLocation = () => {
  if (typeof window === "undefined") {
    return "home";
  }

  const pathPage = usesPathRouting ? getPathPage() : "";
  const hashPage = getHashPage();

  return pathPage || hashPage || "home";
};

export const normalizeLegacyHashRoute = () => {
  if (!usesPathRouting || typeof window === "undefined") {
    return getCurrentPageFromLocation();
  }

  const hashPage = getHashPage();

  if (hashPage) {
    window.history.replaceState(null, "", getPageHref(hashPage));
    return hashPage;
  }

  return getCurrentPageFromLocation();
};
