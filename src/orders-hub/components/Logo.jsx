export default function Logo({ className = '' }) {
  return (
    <span className={`oh-logo ${className}`.trim()}>
      <svg className="oh-logo__mark" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#0B1F3A" />
        <rect x="7" y="8" width="18" height="16" rx="3" fill="#0D9488" />
        <rect x="10" y="12" width="12" height="2" rx="1" fill="#ECFDF8" />
        <rect x="10" y="16" width="8" height="2" rx="1" fill="#ECFDF8" />
        <rect x="10" y="20" width="5" height="2" rx="1" fill="#99F6E4" />
      </svg>
      <span className="oh-logo__word">
        Orders <strong>Hub</strong>
      </span>
    </span>
  );
}
