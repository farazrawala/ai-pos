import { NavLink } from 'react-router-dom';
import { FaPlus } from 'react-icons/fa6';
import NavIcon from './NavIcon.jsx';

const SIZE_CLASSES = {
  sm: 'btn-sm',
  md: 'btn-md',
};

/**
 * Primary add/create action for list page toolbars.
 * @param {string} to - React Router path (e.g. "/categories/add")
 * @param {string} [label] - Button label (use `children` as an alternative)
 * @param {'sm' | 'md'} [size='sm'] - Bootstrap button size
 */
const AddNewButton = ({ to, label, children, size = 'sm', className = '' }) => {
  const text = children ?? label;
  if (!to || text == null || text === '') return null;

  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.sm;

  return (
    <NavLink
      to={to}
      className={`btn btn-primary ${sizeClass} mb-0 text-sm ${className}`.trim()}
    >
      <NavIcon icon={FaPlus} className="me-1" size={14} />
      {text}
    </NavLink>
  );
};

export default AddNewButton;
