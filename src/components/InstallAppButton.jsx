import { FaMobileScreen } from 'react-icons/fa6';
import NavIcon from './NavIcon.jsx';
import { useAndroidPwaInstall } from '../hooks/useAndroidPwaInstall.js';

const VARIANT_CLASS = {
  header:
    'install-app-btn btn btn-sm btn-outline-light mb-0 py-1 px-2 text-xs d-xl-none d-inline-flex align-items-center',
  signin: 'install-app-btn install-app-btn--signin ghost-btn d-xl-none',
};

/**
 * Android Chrome install action. Hidden on desktop, iOS, and when already installed
 * or the browser has not offered an install prompt.
 */
const InstallAppButton = ({ variant = 'header', className = '' }) => {
  const { canInstall, installing, promptInstall } = useAndroidPwaInstall();
  if (!canInstall) return null;

  const variantClass = VARIANT_CLASS[variant] || VARIANT_CLASS.header;

  return (
    <button
      type="button"
      className={`${variantClass} ${className}`.trim()}
      onClick={promptInstall}
      disabled={installing}
      aria-label="Install AI POS on this phone"
    >
      <NavIcon icon={FaMobileScreen} className="me-1" size={14} />
      {installing ? 'Installing…' : 'Install app'}
    </button>
  );
};

export default InstallAppButton;
