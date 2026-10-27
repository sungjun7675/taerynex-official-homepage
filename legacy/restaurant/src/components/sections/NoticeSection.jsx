import { businessInfoSources, photoSources, siteInfo } from "../../data/siteData.js";

export default function NoticeSection() {
  const sourceLinks = [...photoSources, ...businessInfoSources];

  return (
    <section className="notice-section" aria-label="정보 출처 안내">
      <div className="container notice-inner">
        <div>
          <strong>정보 출처 안내</strong>
          <p>
            주소, 연락처, 메뉴, 리뷰 수, 사진 정보는 네이버 플레이스와 공개 검색 결과를 기준으로 반영했습니다.
            {` ${siteInfo.businessHoursNote}. `}
            예약 가능 여부와 최신 리뷰는 네이버 플레이스에서 확인하세요.
          </p>
        </div>
        <details className="notice-source-details">
          <summary>정보 출처 보기</summary>
          <ul aria-label="사진 및 매장 정보 출처">
            {sourceLinks.map((source) => (
              <li key={`${source.label}-${source.url}`}>
                <a href={source.url} target="_blank" rel="noreferrer">
                  {source.label}
                </a>
              </li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}
