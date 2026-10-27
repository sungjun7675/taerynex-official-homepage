export function scrollToTarget(target, options = {}) {
  const element = typeof target === "string" ? document.querySelector(target) : target;

  if (!element) {
    return;
  }

  element.scrollIntoView({ behavior: "smooth", block: "start", ...options });
}
