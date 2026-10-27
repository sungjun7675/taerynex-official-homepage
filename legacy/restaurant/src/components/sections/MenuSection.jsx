import { menuItems, siteInfo } from "../../data/siteData.js";

const imagePositionClassMap = {
  "center 32%": "image-position-center-32",
  "center 38%": "image-position-center-38",
  "center 44%": "image-position-center-44",
  "center 50%": "image-position-center-50",
  "center 52%": "image-position-center-52",
  "center 54%": "image-position-center-54",
  "center 58%": "image-position-center-58",
  "center 64%": "image-position-center-64",
  "center 78%": "image-position-center-78",
};

const getImagePositionClass = (position) => imagePositionClassMap[position] || "";

export default function MenuSection({ variant = "compact" }) {
  const isFull = variant === "full";

  return (
    <section
      className={`summary-card menu-card ${isFull ? "menu-card-full" : ""}`}
      id="menu"
      aria-labelledby="menu-title"
    >
      <div className="card-title-row">
        <h2 id="menu-title">인기 메뉴 BEST</h2>
        <a href={siteInfo.naverPlaceUrl} target="_blank" rel="noreferrer">
          네이버 메뉴 확인
        </a>
      </div>
      {isFull ? (
        <>
          <p className="menu-card-intro">
            실제 가격과 세트 구성은 계절, 재료 수급, 매장 운영 상황에 따라 달라질 수 있습니다. 방문 전 네이버
            플레이스 또는 전화로 최종 확인하는 흐름을 기준으로 안내합니다.
          </p>
          <div className="menu-detail-grid">
            {menuItems.map((item) => (
              <article className="menu-detail-item" key={item.name}>
                <div className="menu-detail-image">
                  <img
                    className={getImagePositionClass(item.imagePosition)}
                    src={item.image}
                    alt={item.alt}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <div className="menu-detail-copy">
                  <span>{item.category}</span>
                  <h3>{item.name}</h3>
                  <div className="menu-detail-meta">
                    <strong className="menu-price">{item.price}</strong>
                    <small>{item.serving}</small>
                  </div>
                  <p>{item.description}</p>
                  {item.includes?.length ? (
                    <div className="menu-include-list" aria-label={`${item.name} 구성`}>
                      {item.includes.map((include) => (
                        <span key={include}>{include}</span>
                      ))}
                    </div>
                  ) : null}
                  <small>{item.note}</small>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="menu-list">
          {menuItems.slice(0, 5).map((item) => (
            <article className="menu-item" key={item.name}>
              <div className="menu-thumb">
                <img
                  className={getImagePositionClass(item.imagePosition)}
                  src={item.image}
                  alt={item.alt}
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <h3>{item.name}</h3>
              <span>{item.price}</span>
            </article>
          ))}
        </div>
      )}
      {isFull ? (
        <div className="menu-verify-row">
          <p>가격, 세트 구성, 라스트오더는 현장 운영 상황에 따라 달라질 수 있습니다.</p>
          <a href={`tel:${siteInfo.phone.replaceAll("-", "")}`}>전화로 메뉴 확인</a>
        </div>
      ) : null}
    </section>
  );
}
