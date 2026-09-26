import { useLayoutEffect, useRef, useState } from 'react';
import { FaPaperPlane } from 'react-icons/fa6';

export default function ChatComposer({ disabled, sending, onSend }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  // Auto-grow the textarea up to its CSS max-height.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  const submit = (e) => {
    e?.preventDefault?.();
    const value = text.trim();
    if (!value || disabled || sending) return;
    onSend(value);
    setText('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className="wa-composer" onSubmit={submit}>
      <div className="wa-composer-input">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder={disabled ? 'This contact has no phone number' : 'Type a message'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled || sending}
          aria-label="Message"
        />
        {text ? <span className="wa-composer-hint">Shift + Enter for new line</span> : null}
      </div>
      <button
        type="submit"
        className="wa-send-btn"
        disabled={disabled || sending || !text.trim()}
        title="Send"
        aria-label="Send"
      >
        <FaPaperPlane />
      </button>
    </form>
  );
}
