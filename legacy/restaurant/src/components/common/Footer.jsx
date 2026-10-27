import { siteInfo } from "../../data/siteData.js";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-brand-block">
        <strong>{siteInfo.name}</strong>
        <span>{siteInfo.romanName}</span>
        <p>{siteInfo.sourceNote}</p>
      </div>
      <div className="footer-info-grid" aria-label="매장 기본 정보">
        <p>
          <span>주소</span>
          <strong>{siteInfo.address}</strong>
        </p>
        <p>
          <span>전화</span>
          <a href={`tel:${siteInfo.phone.replaceAll("-", "")}`}>{siteInfo.phone}</a>
        </p>
        <p>
          <span>영업시간</span>
          <strong>{siteInfo.businessHours}</strong>
        </p>
      </div>
      <div className="footer-action-row">
        <a href={siteInfo.naverPlaceUrl} target="_blank" rel="noreferrer">
          네이버 확인
        </a>
        <a href={siteInfo.directionsUrl} target="_blank" rel="noreferrer">
          길찾기
        </a>
      </div>
      <p className="footer-notice">운영시간, 예약 가능 여부, 메뉴 구성은 방문 전 네이버 플레이스 또는 전화로 확인하세요.</p>
    </footer>
  );
}
