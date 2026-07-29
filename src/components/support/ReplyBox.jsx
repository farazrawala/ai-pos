import { useCallback, useEffect, useRef, useState } from 'react';
import { FaPaperclip, FaPaperPlane } from 'react-icons/fa6';
import {
  ATTACHMENT_ACCEPT,
  isAttachmentAllowed,
} from '../../features/support/supportConstants.js';
import { toast } from '../../utils/toast.js';
import AttachmentPreview from './AttachmentPreview.jsx';

export default function ReplyBox({
  disabled = false,
  sending = false,
  onSend,
  placeholder = 'Write a reply…',
  showInternalToggle = false,
  submitLabel = 'Send Reply',
}) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [isInternal, setIsInternal] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    return () => {
      files.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
    };
  }, [files]);

  const resizeTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 44), 160)}px`;
  };

  useEffect(() => {
    resizeTextarea();
  }, [text]);

  const addFiles = useCallback((incoming) => {
    const list = Array.from(incoming || []);
    if (list.length === 0) return;
    const next = [];
    list.forEach((file) => {
      if (!isAttachmentAllowed(file)) {
        toast.error(`"${file.name}" is not allowed or exceeds 10 MB.`);
        return;
      }
      const withPreview = file;
      if (file.type?.startsWith('image/')) {
        withPreview.previewUrl = URL.createObjectURL(file);
      }
      next.push(withPreview);
    });
    if (next.length) setFiles((prev) => [...prev, ...next]);
  }, []);

  const removeFile = (index) => {
    setFiles((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(index, 1);
      if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  };

  const submit = async (e) => {
    e?.preventDefault?.();
    const value = text.trim();
    if ((!value && files.length === 0) || disabled || sending) return;
    try {
      await onSend?.({
        message: value,
        attachments: files,
        is_internal: showInternalToggle ? isInternal : false,
      });
      setText('');
      files.forEach((f) => {
        if (f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      });
      setFiles([]);
      setIsInternal(false);
      requestAnimationFrame(resizeTextarea);
    } catch {
      // Parent handles toast
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form
      className={`support-reply-box card border-0 shadow-sm ${isInternal ? 'is-internal' : ''}`}
      onSubmit={submit}
    >
      <div className="card-body p-0">
        {showInternalToggle ? (
          <div className="support-reply-box__toolbar px-3 pt-3">
            <div className="form-check form-switch mb-0">
              <input
                className="form-check-input"
                type="checkbox"
                id="support-internal-note"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                disabled={disabled || sending}
              />
              <label className="form-check-label text-sm" htmlFor="support-internal-note">
                Internal note <span className="text-muted">(hidden from customer)</span>
              </label>
            </div>
          </div>
        ) : null}

        <div className="support-reply-box__composer px-3 pt-3">
          <textarea
            ref={textareaRef}
            className="form-control support-reply-box__textarea border-0 shadow-none"
            rows={1}
            placeholder={placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            disabled={disabled || sending}
            aria-label="Reply message"
          />
        </div>

        {files.length > 0 ? (
          <div className="support-reply-box__files px-3 pt-2">
            {files.map((file, idx) => (
              <AttachmentPreview key={`${file.name}-${idx}`} file={file} onRemove={() => removeFile(idx)} compact />
            ))}
          </div>
        ) : null}

        <div className="support-reply-box__footer px-3 py-3">
          <div className="d-flex align-items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="d-none"
              multiple
              accept={ATTACHMENT_ACCEPT}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm mb-0 support-reply-attach"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || sending}
              title="Attach files"
            >
              <FaPaperclip className="me-1" />
              Attach
            </button>
            <span className="support-reply-hint d-none d-md-inline">
              <kbd>Enter</kbd> send · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line
            </span>
          </div>
          <button
            type="submit"
            className={`btn btn-sm mb-0 ${isInternal ? 'btn-warning' : 'btn-primary'}`}
            disabled={disabled || sending || (!text.trim() && files.length === 0)}
          >
            {sending ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden />
                Sending…
              </>
            ) : (
              <>
                <FaPaperPlane className="me-1" />
                {isInternal ? 'Add Note' : submitLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
