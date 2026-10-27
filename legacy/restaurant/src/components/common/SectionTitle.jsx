export default function SectionTitle({ eyebrow, title, description }) {
  return (
    <header className="section-title">
      {eyebrow ? <p className="section-eyebrow">{eyebrow}</p> : null}
      {title ? <h2>{title}</h2> : null}
      {description ? <span className="section-description">{description}</span> : null}
    </header>
  );
}
