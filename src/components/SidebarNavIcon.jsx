import NavIcon from './NavIcon.jsx';

/** Icon cell matching Argon sidebar `.icon.icon-shape.icon-sm` layout. */
const SidebarNavIcon = ({ icon, size = 14 }) => (
  <div className="icon icon-shape icon-sm text-center d-flex align-items-center justify-content-center">
    <NavIcon icon={icon} size={size} className="text-dark opacity-10" />
  </div>
);

export default SidebarNavIcon;
