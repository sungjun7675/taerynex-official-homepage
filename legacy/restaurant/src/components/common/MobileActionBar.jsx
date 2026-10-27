import { siteInfo } from "../../data/siteData.js";

export default function MobileActionBar() {
  const phoneHref = `tel:${siteInfo.phone.replaceAll("-", "")}`;
  const naverLink = siteInfo.bookingUrl || siteInfo.naverPlaceUrl;
  const naverLabel = siteInfo.bookingUrl ? "예약" : "확인";

  return (
    <nav className="mobile-action-bar" aria-label="모바일 빠른 작업">
      <a href={phoneHref} aria-label={`${siteInfo.name} 전화 문의`}>
        전화
      </a>
      <a
        href={naverLink}
        target="_blank"
        rel="noreferrer"
        aria-label={`${siteInfo.name} 네이버 플레이스 확인`}
      >
        <span aria-hidden="true">N</span>
        {naverLabel}
      </a>
      <a
        href={siteInfo.directionsUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`${siteInfo.name} 네이버 길찾기 열기`}
      >
        길찾기
      </a>
    </nav>
  );
}
