import { FaMagnifyingGlass } from 'react-icons/fa6';
import NavIcon from './NavIcon.jsx';

/** Search magnifier for Argon `input-group-text` addons (replaces `fas fa-search`). */
const SearchInputIcon = ({ size = 14, className = '' }) => (
  <NavIcon icon={FaMagnifyingGlass} size={size} className={className} />
);

export default SearchInputIcon;
