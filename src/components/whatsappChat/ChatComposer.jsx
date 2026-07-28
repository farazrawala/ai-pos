import { useState } from 'react';
import { FaPaperPlane } from 'react-icons/fa6';

export default function ChatComposer({ disabled, sending, onSend }) {
  const [text, setText] = useState('');

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
      <textarea
        rows={1}
        placeholder="Type a message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={disabled || sending}
        aria-label="Message"
      />
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
