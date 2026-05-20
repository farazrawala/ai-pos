/**
 * Shared wrapper for react-icons in Argon navbar / sidebar / dashboard cards.
 */
const NavIcon = ({ icon: Icon, size = 16, className = '', style, ...props }) => {
  if (!Icon) return null;
  return <Icon size={size} className={className} style={style} aria-hidden {...props} />;
};

export default NavIcon;
