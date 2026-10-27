import { assets, siteInfo, storeHighlights } from "../../data/siteData.js";

export default function StoreInfoSection({ variant = "full" }) {
  const isSummary = variant === "summary";
  const visibleHighlights = isSummary ? storeHighlights.slice(0, 2) : storeHighlights;

  return (
    <section className={`summary-card store-card ${isSummary ? "store-card-summary" : ""}`} id="store" aria-labelledby="store-title">
      <div className="store-details">
        <h2 id="store-title">{isSummary ? "매장 요약" : "매장 정보"}</h2>
        <dl>
          <div>
            <dt>주소</dt>
            <dd>{siteInfo.address}</dd>
          </div>
          <div>
            <dt>전화번호</dt>
            <dd>
              <a href={`tel:${siteInfo.phone.replaceAll("-", "")}`}>{siteInfo.phone}</a>
            </dd>
          </div>
          <div>
            <dt>영업시간</dt>
            <dd>
              {siteInfo.businessHours}
              <small>{siteInfo.businessHoursNote}</small>
            </dd>
          </div>
        </dl>
        <div className="store-highlight-list" aria-label="매장 특징 안내">
          {visibleHighlights.map((highlight) => (
            <article key={highlight.label}>
              <strong>{highlight.label}</strong>
              <p>{highlight.description}</p>
            </article>
          ))}
        </div>
        {isSummary ? (
          <div className="store-summary-actions">
            <a href={`tel:${siteInfo.phone.replaceAll("-", "")}`}>전화 문의</a>
            <a href={siteInfo.naverPlaceUrl} target="_blank" rel="noreferrer">
              네이버 확인
            </a>
          </div>
        ) : null}
      </div>
      <img
        src={assets.storeImage}
        alt="을왕리 해변 인근 야간 해산물 식당 외관 이미지"
        loading="lazy"
        decoding="async"
      />
    </section>
  );
}
