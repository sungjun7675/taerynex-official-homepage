import { reviewSummary, siteInfo, visitChecklist } from "../../data/siteData.js";

export default function ReservationSection() {
  const naverLink = siteInfo.bookingUrl || siteInfo.naverPlaceUrl;

  return (
    <section className="reservation-section" id="reservation" aria-labelledby="reservation-title">
      <div className="container reservation-inner">
        <div>
          <p className="section-eyebrow">이용안내</p>
          <h2 id="reservation-title">방문 전 네이버와 전화로 최종 확인하세요</h2>
          <p>
            영업시간, 메뉴 구성, 대기, 단체 이용 가능 여부는 당일 운영 상황에 따라 달라질 수 있습니다. 출발
            전 네이버 플레이스와 전화 문의를 함께 확인하는 흐름을 권장합니다.
          </p>
          <div className="reservation-meta-row" aria-label="방문 전 확인 정보">
            <span>{reviewSummary.headline}</span>
            <span>{siteInfo.businessHours}</span>
            <span>예약·단체·주차 확인</span>
          </div>
        </div>
        <div className="reservation-actions">
          <a className="button button-solid" href={naverLink} target="_blank" rel="noreferrer">
            <span aria-hidden="true">N</span>
            네이버 확인
          </a>
          <a className="button button-outline" href={`tel:${siteInfo.phone.replaceAll("-", "")}`}>
            전화 문의
          </a>
        </div>
        <div className="visit-check-grid">
          {visitChecklist.map((item) => (
            <article key={item.label}>
              <strong>{item.label}</strong>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
