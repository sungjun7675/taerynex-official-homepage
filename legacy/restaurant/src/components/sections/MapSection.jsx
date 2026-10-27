import { useState } from "react";
import { siteInfo } from "../../data/siteData.js";

export default function MapSection({ variant = "full" }) {
  const [isCopied, setIsCopied] = useState(false);
  const isSummary = variant === "summary";

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(siteInfo.address);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1800);
    } catch {
      setIsCopied(false);
    }
  };

  return (
    <section className={`summary-card map-card ${isSummary ? "map-card-summary" : ""}`} id="location" aria-labelledby="location-title">
      <div className="card-title-row">
        <h2 id="location-title">{isSummary ? "찾아오시는길 요약" : "찾아오시는길"}</h2>
        <a href={siteInfo.naverPlaceUrl} target="_blank" rel="noreferrer">
          네이버 지도
        </a>
      </div>
      <div className="map-visual-panel">
        <iframe
          className="map-embed"
          title="을왕리 동해회조개구이 Google 지도"
          src={siteInfo.googleMapEmbedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
        <div className="map-visual-caption">
          <span className="map-provider-badge" aria-hidden="true">G</span>
          <div>
            <strong>Google Maps 기준 지도 표시</strong>
            <span>네이버 플레이스와 길찾기 버튼으로 방문 전 최종 확인</span>
          </div>
        </div>
      </div>
      {!isSummary ? (
        <div className="naver-place-summary" aria-label="방문 위치 요약">
          <p>
            <span>주소</span>
            <strong>{siteInfo.address}</strong>
          </p>
          <p>
            <span>위치</span>
            <strong>{siteInfo.locationHint}</strong>
          </p>
        </div>
      ) : null}
      <div className="map-info-panel">
        <p>
          <strong>{siteInfo.address}</strong>
          <span>{siteInfo.locationHint}</span>
        </p>
        <div className="map-action-row">
          <a className="map-action map-action-primary" href={siteInfo.directionsUrl} target="_blank" rel="noreferrer">
            길찾기
          </a>
          <a className="map-action" href={`tel:${siteInfo.phone.replaceAll("-", "")}`}>
            전화
          </a>
          <button className="map-action" type="button" onClick={handleCopyAddress}>
            {isCopied ? "복사완료" : "주소복사"}
          </button>
        </div>
      </div>
      <div className="route-note-list" aria-label="방문 전 확인 사항">
        <p>
          <strong>지도 기준</strong>
          <span>네이버 플레이스 장소 ID {siteInfo.naverPlaceId} 기준으로 연결합니다.</span>
        </p>
        <p>
          <strong>실시간 길찾기</strong>
          <span>교통, 주차, 도착지 입구는 네이버 지도에서 실시간으로 확인하세요.</span>
        </p>
      </div>
    </section>
  );
}
