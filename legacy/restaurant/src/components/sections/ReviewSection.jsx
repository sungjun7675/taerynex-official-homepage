import { featureItems } from "../../data/siteData.js";

const iconLabel = {
  fresh: "식",
  menu: "메",
  view: "뷰",
  service: "친",
  group: "단",
  naver: "N",
};

export default function ReviewSection() {
  return (
    <section className="feature-strip" aria-label="매장 핵심 장점">
      <div className="container feature-strip-inner">
        {featureItems.map((item) => (
          <article className="feature-item" key={item.label}>
            <span className="feature-icon" aria-hidden="true">
              {iconLabel[item.icon]}
            </span>
            <div>
              <h2>{item.label}</h2>
              <p>{item.description}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
