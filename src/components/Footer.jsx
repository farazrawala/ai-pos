import { APP_NAME } from '../config/env.js';

/** Compact Pakistan flag (green field, white hoist, crescent & star). */
function PakistanFlag({ className = '', title = 'Pakistan' }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 60 40"
      width="22"
      height="15"
      role="img"
      aria-label={title}
      style={{ display: 'inline-block', verticalAlign: '-0.15em', borderRadius: 2 }}
    >
      <title>{title}</title>
      <rect width="60" height="40" fill="#01411C" />
      <rect width="15" height="40" fill="#FFFFFF" />
      <circle cx="36" cy="20" r="9" fill="#FFFFFF" />
      <circle cx="39.2" cy="20" r="7.4" fill="#01411C" />
      <polygon
        fill="#FFFFFF"
        points="44.5,14.2 45.7,17.8 49.5,17.8 46.4,20.1 47.6,23.7 44.5,21.4 41.4,23.7 42.6,20.1 39.5,17.8 43.3,17.8"
      />
    </svg>
  );
}

const Footer = () => {
  return (
    <footer className="footer pt-3">
      <div className="container-fluid">
        <div className="row align-items-center justify-content-lg-between">
          <div className="col-lg-12 mb-lg-0 mb-4">
            <div className="copyright text-center text-sm text-muted">
              © {new Date().getFullYear()}, made in Pakistan{' '}
              <PakistanFlag className="mx-1" /> by {APP_NAME}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
