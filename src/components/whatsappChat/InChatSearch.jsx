import { useEffect, useMemo, useState } from 'react';
import { FaChevronDown, FaChevronUp, FaXmark } from 'react-icons/fa6';

export default function InChatSearch({
  open,
  onClose,
  messages,
  onActiveMatchChange,
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return (messages || []).filter((m) =>
      String(m.message || m.fileName || '')
        .toLowerCase()
        .includes(q)
    );
  }, [messages, query]);

  useEffect(() => {
    setIndex(0);
  }, [query, messages]);

  useEffect(() => {
    const active = matches[index] || null;
    onActiveMatchChange?.({
      query: query.trim(),
      activeId: active?.id || null,
      total: matches.length,
      index,
    });
  }, [matches, index, query, onActiveMatchChange]);

  if (!open) return null;

  const go = (dir) => {
    if (!matches.length) return;
    setIndex((prev) => (prev + dir + matches.length) % matches.length);
  };

  return (
    <div className="wa-inchat-search">
      <input
        type="search"
        placeholder="Search in conversation…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
        aria-label="Search in conversation"
      />
      <div className="wa-match-nav">
        <span>
          {matches.length ? `${index + 1} / ${matches.length}` : '0 / 0'}
        </span>
        <button
          type="button"
          className="wa-icon-btn"
          onClick={() => go(-1)}
          disabled={!matches.length}
          title="Previous match"
          aria-label="Previous match"
        >
          <FaChevronUp />
        </button>
        <button
          type="button"
          className="wa-icon-btn"
          onClick={() => go(1)}
          disabled={!matches.length}
          title="Next match"
          aria-label="Next match"
        >
          <FaChevronDown />
        </button>
        <button
          type="button"
          className="wa-icon-btn"
          onClick={() => {
            setQuery('');
            onClose();
          }}
          title="Close search"
          aria-label="Close search"
        >
          <FaXmark />
        </button>
      </div>
    </div>
  );
}
