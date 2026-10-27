import { useEffect, useState } from "react";

export default function TopButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(window.scrollY > 320);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <button
      className="top-button"
      type="button"
      aria-label="맨 위로 이동"
      title="맨 위로 이동"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    >
      TOP
    </button>
  );
}
