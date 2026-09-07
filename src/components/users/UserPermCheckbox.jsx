/** Custom permission checkbox — avoids Argon/theme gradient wiping the checkmark. */
export default function UserPermCheckbox({
  checked,
  onChange,
  disabled = false,
  id,
  label,
  ariaLabel,
}) {
  return (
    <label className={label ? 'user-perm-tick user-perm-tick--labeled' : 'user-perm-tick'}>
      <input
        id={id}
        type="checkbox"
        className="user-perm-tick__input"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <span className="user-perm-tick__box" aria-hidden="true" />
      {label ? <span className="user-perm-tick__text">{label}</span> : null}
    </label>
  );
}
