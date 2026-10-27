import { commercialReviewPolicy, publicReviewItems, reviewSummary, siteInfo } from "../../data/siteData.js";

export default function ReviewGuideSection({ variant = "full" }) {
  const isCompact = variant === "compact";
  const approvedReviews = publicReviewItems.filter((review) => review.isCommercialUseApproved === true);
  const reviews = isCompact ? approvedReviews.slice(0, 3) : approvedReviews;

  return (
    <section
      className={`review-guide-section public-review-section ${isCompact ? "public-review-compact" : ""}`}
      aria-labelledby="review-guide-title"
    >
      <div className="container public-review-panel">
        <div className="public-review-header">
          <div>
            <p className="section-eyebrow">Visitor Reviews</p>
            <h2 id="review-guide-title">네이버 리뷰와 방문 전 확인 포인트</h2>
            <p>
              방문자 리뷰 원문과 사진은 네이버 플레이스에서 최신 상태로 확인하도록 연결합니다. 홈페이지에는
              리뷰 수, 확인 경로, 방문 전 체크 포인트를 먼저 정리해 실제 방문 판단이 빠르게 되도록 구성했습니다.
            </p>
          </div>
          <div className="public-review-summary">
            <strong>{reviewSummary.headline}</strong>
            <span>{reviewSummary.totalLabel}</span>
            <small>{reviewSummary.status}</small>
          </div>
        </div>

        {reviews.length > 0 ? (
          <div className="public-review-grid" aria-label="상업 사용 허락 확인 완료 리뷰">
            {reviews.map((review) => (
              <article className="public-review-card" key={`${review.author}-${review.date}`}>
                {review.image ? (
                  <img
                    className="public-review-photo"
                    src={review.image}
                    alt={review.imageAlt || `${review.author} 리뷰 사진`}
                    loading="lazy"
                    decoding="async"
                  />
                ) : null}
                <div className="public-review-copy">
                  <div className="review-stars" aria-label={`${review.rating}점 만점 리뷰`}>
                    {"★".repeat(review.rating)}
                  </div>
                  <p>{review.text}</p>
                  <footer>
                    <strong>{review.author}</strong>
                    <span>{review.date}</span>
                    <small>{review.source}</small>
                  </footer>
                  {review.tags?.length ? (
                    <div className="review-tag-row" aria-label="리뷰 키워드">
                      {review.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="public-review-safe-grid" aria-label="리뷰 공개 운영 기준">
            <div className="public-review-safe-card public-review-safe-card-primary">
              <span>Review Policy</span>
              <h3>{commercialReviewPolicy.heading}</h3>
              <p>{commercialReviewPolicy.description}</p>
            </div>
            {commercialReviewPolicy.items.map((item) => (
              <div className="public-review-safe-card" key={item.label}>
                <span>{item.label}</span>
                <p>{item.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="public-review-actions">
          <p>방문자 리뷰, 사진, 영업 상태, 예약 가능 여부는 네이버 플레이스 원문 화면에서 최신 상태를 확인하세요.</p>
          <a className="button button-solid" href={siteInfo.naverPlaceUrl} target="_blank" rel="noreferrer">
            <span aria-hidden="true">N</span>
            네이버 리뷰 확인
          </a>
          <a className="button button-outline" href={`tel:${siteInfo.phone.replaceAll("-", "")}`}>
            전화 문의
          </a>
        </div>
      </div>
    </section>
  );
}
