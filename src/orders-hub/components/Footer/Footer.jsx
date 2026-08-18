import Logo from '../Logo.jsx';
import { site } from '../../config.js';

const social = [
  {
    label: 'Orders Hub on X',
    href: 'https://twitter.com',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.253 5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"
        />
      </svg>
    ),
  },
  {
    label: 'Orders Hub on LinkedIn',
    href: 'https://linkedin.com',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M4.98 3.5C4.98 4.88 3.88 6 2.5 6S0 4.88 0 3.5 1.12 1 2.5 1s2.48 1.12 2.48 2.5zM.5 8.5h4V24h-4V8.5zM8.5 8.5h3.8v2.1h.05c.53-1 1.83-2.1 3.77-2.1 4.03 0 4.78 2.65 4.78 6.1V24h-4v-7.7c0-1.84-.03-4.2-2.56-4.2-2.56 0-2.95 2-2.95 4.06V24h-4V8.5z"
        />
      </svg>
    ),
  },
  {
    label: 'Orders Hub on Facebook',
    href: 'https://facebook.com',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M22 12.07C22 6.48 17.52 2 11.93 2 6.35 2 1.87 6.48 1.87 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.02H7.9v-2.91h2.41V9.84c0-2.38 1.42-3.7 3.6-3.7 1.04 0 2.13.19 2.13.19v2.35h-1.2c-1.18 0-1.55.74-1.55 1.49v1.79h2.64l-.42 2.91h-2.22V22c4.78-.75 8.44-4.91 8.44-9.93z"
        />
      </svg>
    ),
  },
  {
    label: 'Orders Hub on Instagram',
    href: 'https://instagram.com',
    icon: (
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zM17.8 6.2a1 1 0 1 1-1 1 1 1 0 0 1 1-1z"
        />
      </svg>
    ),
  },
];

const columns = [
  {
    title: 'Orders Hub',
    links: [
      { label: 'About', href: '#features' },
      { label: 'Contact', href: `mailto:${site.email}` },
      { label: 'Careers', href: `mailto:${site.email}?subject=Careers` },
    ],
  },
  {
    title: 'Product',
    links: [
      { label: 'POS', href: '#pos' },
      { label: 'Inventory', href: '#inventory' },
      { label: 'Invoices', href: '#invoices' },
      { label: 'Ledger', href: '#ledger' },
      { label: 'Reports', href: '#reports' },
      { label: 'Online Store', href: '#store' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Help Center', href: '#faq' },
      { label: 'Documentation', href: '#how-it-works' },
      { label: 'Blog', href: '#features' },
      { label: 'Guides', href: '#how-it-works' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#features' },
      { label: 'Contact', href: `mailto:${site.email}` },
      { label: 'Privacy', href: '#faq' },
      { label: 'Terms', href: '#faq' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="oh-footer">
      <div className="oh-container oh-footer__grid">
        <div className="oh-footer__brand">
          <Logo />
          <p>{site.tagline}</p>
          <p className="oh-footer__message">{site.coreMessage}</p>
          <div className="oh-footer__social">
            {social.map((item) => (
              <a
                key={item.label}
                href={item.href}
                aria-label={item.label}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.icon}
              </a>
            ))}
          </div>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h2 className="oh-footer__title">{col.title}</h2>
            <ul>
              {col.links.map((link) => (
                <li key={link.label}>
                  <a href={link.href}>{link.label}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="oh-container oh-footer__legal">
        <p>© {new Date().getFullYear()} Orders Hub. All rights reserved.</p>
        <p>POS + Inventory + Accounting + Sales + Reports + Online Store — one platform.</p>
      </div>
    </footer>
  );
}
