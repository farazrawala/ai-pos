import { useCallback, useEffect, useMemo, useState } from 'react';
import './calculator.css';
const KEYS = [
  { key: 'C', label: 'C', type: 'clear', className: 'calc-key--fn' },
  { key: 'back', label: '⌫', type: 'back', className: 'calc-key--fn' },
  { key: '%', label: '%', type: 'percent', className: 'calc-key--fn' },
  { key: '/', label: '÷', type: 'operator', value: '/' },
  { key: '7', label: '7', type: 'digit', value: '7' },
  { key: '8', label: '8', type: 'digit', value: '8' },
  { key: '9', label: '9', type: 'digit', value: '9' },
  { key: '*', label: '×', type: 'operator', value: '*' },
  { key: '4', label: '4', type: 'digit', value: '4' },
  { key: '5', label: '5', type: 'digit', value: '5' },
  { key: '6', label: '6', type: 'digit', value: '6' },
  { key: '-', label: '−', type: 'operator', value: '-' },
  { key: '1', label: '1', type: 'digit', value: '1' },
  { key: '2', label: '2', type: 'digit', value: '2' },
  { key: '3', label: '3', type: 'digit', value: '3' },
  { key: '+', label: '+', type: 'operator', value: '+' },
  { key: '0', label: '0', type: 'digit', value: '0', wide: true },
  { key: '.', label: '.', type: 'decimal', value: '.' },
  { key: '=', label: '=', type: 'equals', className: 'calc-key--equals' },
];

function toNumber(value) {
  const n = parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

function formatDisplay(value) {
  if (!Number.isFinite(value)) return 'Error';
  const rounded = Math.round(value * 1e10) / 1e10;
  return String(rounded);
}

function compute(a, b, operator) {
  switch (operator) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '*':
      return a * b;
    case '/':
      return b === 0 ? NaN : a / b;
    default:
      return b;
  }
}

/** Map physical keyboard / numpad events to calculator actions. */
export function mapKeyboardToCalculatorAction(event) {
  const { key, code } = event;

  if (/^[0-9]$/.test(key)) {
    return { type: 'digit', value: key };
  }
  if (/^Numpad[0-9]$/.test(code)) {
    return { type: 'digit', value: code.slice(6) };
  }

  if (key === '.' || key === ',' || code === 'NumpadDecimal' || code === 'Period') {
    return { type: 'decimal' };
  }

  if (key === '+' || code === 'NumpadAdd') return { type: 'operator', value: '+' };
  if (key === '-' || code === 'NumpadSubtract' || code === 'Minus') {
    return { type: 'operator', value: '-' };
  }
  if (key === '*' || code === 'NumpadMultiply') return { type: 'operator', value: '*' };
  if (key === '/' || code === 'NumpadDivide' || code === 'Slash') {
    return { type: 'operator', value: '/' };
  }

  if (key === '=' || key === 'Enter' || code === 'NumpadEnter') {
    return { type: 'equals' };
  }

  if (key === 'Backspace' || key === 'Delete') return { type: 'back' };
  if (key === '%') return { type: 'percent' };
  if (key === 'c' || key === 'C') return { type: 'clear' };

  return null;
}

function isTypingTarget(target) {
  if (!target || typeof target !== 'object') return false;
  const tag = String(target.tagName || '').toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  return Boolean(target.isContentEditable);
}
/**
 * Reusable on-screen calculator.
 * @param {{
 *   initialValue?: string|number,
 *   onChange?: (value: string) => void,
 *   className?: string,
 *   keyboardActive?: boolean,
 * }} props
 */
export default function Calculator({
  initialValue = '0',
  onChange,
  className = '',
  keyboardActive = false,
}) {  const [display, setDisplay] = useState(() => formatDisplay(toNumber(initialValue)));
  const [storedValue, setStoredValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const emit = useCallback(
    (next) => {
      setDisplay(next);
      onChange?.(next);
    },
    [onChange]
  );

  const clearAll = useCallback(() => {
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(false);
    emit('0');
  }, [emit]);

  const inputDigit = useCallback(
    (digit) => {
      if (display === 'Error') {
        emit(digit);
        setWaitingForOperand(false);
        return;
      }
      if (waitingForOperand) {
        emit(digit);
        setWaitingForOperand(false);
        return;
      }
      emit(display === '0' ? digit : `${display}${digit}`);
    },
    [display, emit, waitingForOperand]
  );

  const inputDecimal = useCallback(() => {
    if (display === 'Error') {
      emit('0.');
      setWaitingForOperand(false);
      return;
    }
    if (waitingForOperand) {
      emit('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) emit(`${display}.`);
  }, [display, emit, waitingForOperand]);

  const backspace = useCallback(() => {
    if (waitingForOperand || display === 'Error') return;
    if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) {
      emit('0');
      return;
    }
    emit(display.slice(0, -1));
  }, [display, emit, waitingForOperand]);

  const applyPercent = useCallback(() => {
    const current = toNumber(display);
    if (storedValue != null && operator) {
      const pct = (storedValue * current) / 100;
      emit(formatDisplay(pct));
      setWaitingForOperand(true);
      return;
    }
    emit(formatDisplay(current / 100));
  }, [display, emit, operator, storedValue]);

  const chooseOperator = useCallback(
    (nextOp) => {
      const current = toNumber(display);
      if (display === 'Error') return;

      if (storedValue == null) {
        setStoredValue(current);
      } else if (!waitingForOperand && operator) {
        const result = compute(storedValue, current, operator);
        const formatted = formatDisplay(result);
        setStoredValue(toNumber(formatted));
        emit(formatted);
      } else {
        setStoredValue(current);
      }

      setOperator(nextOp);
      setWaitingForOperand(true);
    },
    [display, emit, operator, storedValue, waitingForOperand]
  );

  const equals = useCallback(() => {
    if (operator == null || storedValue == null) return;
    const current = toNumber(display);
    const result = compute(storedValue, current, operator);
    emit(formatDisplay(result));
    setStoredValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  }, [display, emit, operator, storedValue]);

  const applyAction = useCallback(
    (action) => {
      if (!action) return;
      switch (action.type) {
        case 'clear':
          clearAll();
          break;
        case 'back':
          backspace();
          break;
        case 'percent':
          applyPercent();
          break;
        case 'digit':
          inputDigit(action.value);
          break;
        case 'decimal':
          inputDecimal();
          break;
        case 'operator':
          chooseOperator(action.value);
          break;
        case 'equals':
          equals();
          break;
        default:
          break;
      }
    },
    [applyPercent, backspace, chooseOperator, clearAll, equals, inputDecimal, inputDigit]
  );

  const handleKey = useCallback(
    (item) => {
      applyAction({ type: item.type, value: item.value });
    },
    [applyAction]
  );

  useEffect(() => {
    if (!keyboardActive) return undefined;

    const onKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;

      const action = mapKeyboardToCalculatorAction(event);
      if (!action) return;

      event.preventDefault();
      applyAction(action);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyAction, keyboardActive]);

  const expressionHint = useMemo(() => {
    if (storedValue == null || !operator) return '';
    const opLabel = { '+': '+', '-': '−', '*': '×', '/': '÷' }[operator] || operator;
    return `${formatDisplay(storedValue)} ${opLabel}`;
  }, [operator, storedValue]);

  return (
    <div className={`calc-panel ${className}`.trim()} tabIndex={-1}>
      <div className="calc-display" aria-live="polite" aria-label="Calculator display">
        {expressionHint ? <div className="calc-display__expr">{expressionHint}</div> : null}
        <div className="calc-display__value">{display}</div>
      </div>
      <div className="calc-keys" role="group" aria-label="Calculator keypad">
        {KEYS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`calc-key ${item.className || ''} ${item.wide ? 'calc-key--wide' : ''}`.trim()}
            onClick={() => handleKey(item)}
            aria-label={item.label}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
