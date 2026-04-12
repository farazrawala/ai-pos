import { openThermalReceiptPrint } from './thermalReceiptPrint.js';

/**
 * Renders a clickable control that opens the thermal receipt print flow.
 * Use `as` to render a link or custom component; default is `<button type="button">`.
 *
 * @example
 * <ThermalReceiptPrint data={receiptPayload} options={{ documentTitlePrefix: 'POS' }}>
 *   Thermal print
 * </ThermalReceiptPrint>
 */
const ThermalReceiptPrint = ({
  data,
  options,
  children,
  as: Comp = 'button',
  onBlocked,
  className,
  disabled,
  onClick,
  ...rest
}) => {
  const handleClick = (e) => {
    if (disabled) return;
    openThermalReceiptPrint(data, {
      ...options,
      onBlocked: onBlocked ?? options?.onBlocked,
    });
    onClick?.(e);
  };

  const extra =
    Comp === 'button'
      ? { type: 'button', disabled: !!disabled }
      : {};

  return (
    <Comp {...extra} className={className} onClick={handleClick} {...rest}>
      {children}
    </Comp>
  );
};

export default ThermalReceiptPrint;
