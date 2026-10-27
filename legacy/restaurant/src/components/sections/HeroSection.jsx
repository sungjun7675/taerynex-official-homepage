import { assets, heroFacts, reviewSummary, siteInfo } from "../../data/siteData.js";
import { getPageHref } from "../../lib/routes.js";

export default function HeroSection() {
  const naverLink = siteInfo.bookingUrl || siteInfo.naverPlaceUrl;
  const naverLabel = siteInfo.bookingUrl ? "네이버 예약하기" : "네이버 확인";

  return (
    <section className="hero-section" id="home" aria-labelledby="hero-title">
      <img
        className="hero-image"
        src={assets.heroImage}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
      />
      <div className="hero-vignette" aria-hidden="true" />

      <div className="container hero-inner">
        <div className="hero-copy">
          <p className="hero-kicker">{siteInfo.tagline}</p>
          <h1 id="hero-title">{siteInfo.headline}</h1>
          <p className="hero-description">{siteInfo.description}</p>
          <div className="hero-actions">
            <a className="button button-outline" href={getPageHref("menu")}>
              메뉴보기
            </a>
            <a
              className="button button-solid"
              href={naverLink}
              target="_blank"
              rel="noreferrer"
              aria-label={`${siteInfo.name} 네이버 플레이스 확인`}
            >
              <span aria-hidden="true">N</span>
              {naverLabel}
            </a>
            <a className="button button-outline" href={`tel:${siteInfo.phone.replaceAll("-", "")}`}>
              전화 문의
            </a>
          </div>
          <div className="hero-facts" aria-label="방문 전 핵심 정보">
            {heroFacts.map((fact) => (
              <article className="hero-fact" key={fact.label}>
                <span>{fact.label}</span>
                <strong>{fact.value}</strong>
                <small>{fact.helper}</small>
              </article>
            ))}
          </div>
        </div>

        <aside className="review-score-card place-status-card" aria-label="네이버 플레이스 확인 안내">
          <div className="score-source">
            <span className="naver-letter">N</span>
            <span>{reviewSummary.provider}</span>
            <strong>{reviewSummary.status}</strong>
          </div>
          <div className="score-line">
            <span className="score-star" aria-hidden="true">
              ★
            </span>
            <strong>{reviewSummary.headline}</strong>
          </div>
          <p>{reviewSummary.totalLabel}</p>
          <div className="score-divider" />
          <p className="score-rank">
            <span aria-hidden="true">BEST</span>
            <small>{reviewSummary.badge}</small>
            <strong>{reviewSummary.rank}</strong>
          </p>
          <a className="place-status-link" href={siteInfo.naverPlaceUrl} target="_blank" rel="noreferrer">
            네이버에서 확인
          </a>
        </aside>

        <div className="scroll-cue" aria-hidden="true">
          <span />
          <small>SCROLL</small>
        </div>
      </div>
    </section>
  );
}
