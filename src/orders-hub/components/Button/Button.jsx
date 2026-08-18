import { Link } from 'react-router-dom';

export default function Button({
  children,
  href,
  to,
  variant = 'primary',
  size = 'md',
  className = '',
  ...props
}) {
  const cls = `oh-btn oh-btn--${variant} oh-btn--${size}${className ? ` ${className}` : ''}`;

  if (to) {
    return (
      <Link to={to} className={cls} {...props}>
        {children}
      </Link>
    );
  }

  if (href) {
    const external = /^https?:\/\//i.test(href) || href.startsWith('mailto:');
    return (
      <a
        href={href}
        className={cls}
        {...(external ? { rel: 'noopener noreferrer' } : undefined)}
        {...props}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={cls} {...props}>
      {children}
    </button>
  );
}
