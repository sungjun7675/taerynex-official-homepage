import { localSeoItems, reviewSummary, siteInfo } from "../../data/siteData.js";

export default function LocalInfoSection() {
  return (
    <section className="local-info-section" aria-labelledby="local-info-title">
      <div className="container local-info-inner">
        <div className="local-info-copy">
          <p className="section-eyebrow">Eulwangri Seafood</p>
          <h2 id="local-info-title">을왕리해수욕장 인근 조개구이 방문 안내</h2>
          <p>
            을왕리 동해회조개구이는 인천 중구 을왕로 62에 위치한 해산물 식당입니다. 손님이 실제 방문 전에
            궁금해하는 주소, 영업시간, 메뉴, 주차, 예약 확인 동선을 한 화면에서 빠르게 찾을 수 있도록
            정리했습니다.
          </p>
          <div className="local-info-actions">
            <a className="button button-solid" href={siteInfo.naverPlaceUrl} target="_blank" rel="noreferrer">
              네이버 플레이스 확인
            </a>
            <a className="button button-outline" href={siteInfo.directionsUrl} target="_blank" rel="noreferrer">
              길찾기
            </a>
          </div>
        </div>

        <div className="local-info-summary" aria-label="네이버 기준 요약 정보">
          <strong>{reviewSummary.headline}</strong>
          <span>{reviewSummary.status}</span>
          <small>{reviewSummary.totalLabel}</small>
        </div>

        <div className="local-info-grid">
          {localSeoItems.map((item) => (
            <article key={item.label}>
              <span>{item.label}</span>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
