export default function SectionHeader({
  eyebrow,
  title,
  description,
  align = 'center',
  light = false,
  id,
}) {
  return (
    <header
      className={`oh-section-header oh-section-header--${align}${light ? ' oh-section-header--light' : ''}`}
    >
      {eyebrow ? <p className="oh-eyebrow">{eyebrow}</p> : null}
      <h2 id={id} className="oh-h2">
        {title}
      </h2>
      {description ? <p className="oh-lede">{description}</p> : null}
    </header>
  );
}
