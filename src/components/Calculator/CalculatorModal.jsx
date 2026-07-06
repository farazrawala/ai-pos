import { useEffect, useId, useState } from 'react';
import Calculator from './Calculator.jsx';
import './calculator.css';
export const DEFAULT_CALCULATOR_MODAL_ID = 'appCalculatorModal';

export function openCalculatorModal(modalId = DEFAULT_CALCULATOR_MODAL_ID) {
  const el = document.getElementById(modalId);
  if (el && window.bootstrap?.Modal) {
    const M = window.bootstrap.Modal;
    const instance =
      typeof M.getOrCreateInstance === 'function'
        ? M.getOrCreateInstance(el)
        : M.getInstance(el) || new M(el);
    instance.show();
  }
}

export function closeCalculatorModal(modalId = DEFAULT_CALCULATOR_MODAL_ID) {
  const el = document.getElementById(modalId);
  if (el && window.bootstrap?.Modal) {
    window.bootstrap.Modal.getInstance(el)?.hide();
  }
}

/**
 * Calculator in a Bootstrap modal — reusable across modules.
 * @param {{
 *   modalId?: string,
 *   open?: boolean,
 *   onClose?: () => void,
 *   title?: string,
 *   initialValue?: string|number,
 *   onChange?: (value: string) => void,
 * }} props
 */
export default function CalculatorModal({
  modalId = DEFAULT_CALCULATOR_MODAL_ID,
  open,
  onClose,
  title = 'Calculator',
  initialValue = '0',
  onChange,
}) {
  const titleId = useId();
  const isControlled = open !== undefined;
  const [isVisible, setIsVisible] = useState(Boolean(open));

  useEffect(() => {
    const el = document.getElementById(modalId);
    if (!el) return undefined;

    const onShown = () => setIsVisible(true);
    const onHidden = () => {
      setIsVisible(false);
      onClose?.();
    };

    el.addEventListener('shown.bs.modal', onShown);
    el.addEventListener('hidden.bs.modal', onHidden);
    return () => {
      el.removeEventListener('shown.bs.modal', onShown);
      el.removeEventListener('hidden.bs.modal', onHidden);
    };
  }, [modalId, onClose]);

  useEffect(() => {
    if (!isControlled) return undefined;
    setIsVisible(Boolean(open));
  }, [isControlled, open]);

  useEffect(() => {    if (!isControlled) return undefined;
    const el = document.getElementById(modalId);
    if (!el || !window.bootstrap?.Modal) return undefined;

    const M = window.bootstrap.Modal;
    const instance =
      typeof M.getOrCreateInstance === 'function'
        ? M.getOrCreateInstance(el)
        : M.getInstance(el) || new M(el);

    if (open) instance.show();
    else instance.hide();

    const handleHidden = () => onClose?.();
    el.addEventListener('hidden.bs.modal', handleHidden);
    return () => el.removeEventListener('hidden.bs.modal', handleHidden);
  }, [isControlled, modalId, onClose, open]);

  return (
    <div
      className="modal fade"
      id={modalId}
      tabIndex={-1}
      aria-labelledby={titleId}
      aria-hidden="true"
    >
      <div className="modal-dialog modal-dialog-centered modal-sm">
        <div className="modal-content">
          <div className="modal-header py-2 px-3">
            <h5 className="modal-title text-sm mb-0" id={titleId}>
              {title}
            </h5>
            <button
              type="button"
              className="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"
              onClick={onClose}
            />
          </div>
          <div className="modal-body pt-2 pb-3 px-3">
            <Calculator
              initialValue={initialValue}
              onChange={onChange}
              keyboardActive={isVisible}
            />
          </div>        </div>
      </div>
    </div>
  );
}
