import { menuGalleryItems } from "../../data/siteData.js";

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

export default function GallerySection({ items = menuGalleryItems, title = "사진으로 보는 메뉴", eyebrow = "Gallery" }) {
  return (
    <section className="gallery-section" aria-labelledby="gallery-title">
      <div className="container">
        <div className="section-title compact">
          <p className="section-eyebrow">{eyebrow}</p>
          <h2 id="gallery-title">{title}</h2>
        </div>
        <div className="gallery-grid gallery-grid-featured">
          {items.map((item, index) => (
            <figure className={`gallery-card ${index === 0 ? "gallery-card-large" : ""}`} key={item.name}>
              <img
                className={`gallery-tile ${getImagePositionClass(item.imagePosition)}`.trim()}
                src={item.image}
                alt={item.alt}
                loading="lazy"
                decoding="async"
              />
              <figcaption>
                <strong>{item.name}</strong>
                <span>{item.caption}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
