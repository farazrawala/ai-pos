import { FaSort, FaSortDown, FaSortUp } from 'react-icons/fa6';
import NavIcon from '../NavIcon.jsx';

/**
 * Sortable column header for list data tables.
 */
const ListSortableTh = ({ column, label, sort, onSort, className = '', style }) => {
  const isActive = sort?.sortBy === column;
  const Icon = !isActive ? FaSort : sort?.sortOrder === 'asc' ? FaSortUp : FaSortDown;

  return (
    <th
      className={`list-data-table-sortable ${className}`.trim()}
      style={style}
      onClick={() => onSort(column)}
      onDoubleClick={() => onSort(column, true)}
    >
      <span className="d-inline-flex align-items-center">
        {label}
        <NavIcon
          icon={Icon}
          className={`ms-1 ${isActive ? 'text-primary' : 'text-muted opacity-6'}`}
          size={12}
        />
      </span>
    </th>
  );
};

export default ListSortableTh;
