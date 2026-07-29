import { FaDownload, FaFile, FaFileImage, FaFilePdf, FaFileWord, FaFileZipper, FaXmark } from 'react-icons/fa6';
import { API_MEDIA_ORIGIN } from '../../config/apiConfig.js';

function resolveUrl(url) {
  if (!url) return '';
  const s = String(url);
  if (/^https?:\/\//i.test(s) || s.startsWith('blob:') || s.startsWith('data:')) return s;
  const origin = String(API_MEDIA_ORIGIN || '').replace(/\/+$/, '');
  if (s.startsWith('/')) return `${origin}${s}`;
  return `${origin}/${s}`;
}

function fileIcon(name = '', mime = '') {
  const n = String(name).toLowerCase();
  const m = String(mime).toLowerCase();
  if (m.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(n)) return FaFileImage;
  if (m.includes('pdf') || n.endsWith('.pdf')) return FaFilePdf;
  if (m.includes('zip') || n.endsWith('.zip')) return FaFileZipper;
  if (m.includes('word') || n.endsWith('.docx') || n.endsWith('.doc')) return FaFileWord;
  return FaFile;
}

function isImage(name = '', mime = '') {
  const n = String(name).toLowerCase();
  const m = String(mime).toLowerCase();
  return m.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(n);
}

/**
 * Preview a local File or remote attachment metadata.
 */
export default function AttachmentPreview({
  file,
  attachment,
  onRemove,
  onPreviewImage,
  compact = false,
}) {
  const name = file?.name || attachment?.name || attachment?.filename || 'Attachment';
  const mime = file?.type || attachment?.mime_type || attachment?.mimeType || '';
  const size = file?.size ?? attachment?.size;
  const url = file ? (file.previewUrl || URL.createObjectURL?.(file)) : resolveUrl(attachment?.url || attachment?.path);
  const Icon = fileIcon(name, mime);
  const image = isImage(name, mime);

  const sizeLabel =
    size != null && Number.isFinite(Number(size))
      ? Number(size) < 1024 * 1024
        ? `${(Number(size) / 1024).toFixed(1)} KB`
        : `${(Number(size) / (1024 * 1024)).toFixed(1)} MB`
      : null;

  return (
    <div className={`support-attachment ${compact ? 'support-attachment--compact' : ''}`}>
      {image && url ? (
        <button
          type="button"
          className="support-attachment__thumb btn p-0 border-0"
          onClick={() => onPreviewImage?.(url, name)}
          title="Preview image"
        >
          <img src={url} alt={name} />
        </button>
      ) : (
        <div className="support-attachment__icon">
          <Icon aria-hidden />
        </div>
      )}
      <div className="support-attachment__meta">
        <span className="support-attachment__name" title={name}>
          {name}
        </span>
        {sizeLabel ? <span className="support-attachment__size">{sizeLabel}</span> : null}
      </div>
      <div className="support-attachment__actions">
        {url && !file ? (
          <a
            className="btn btn-link btn-sm p-0 text-secondary"
            href={url}
            download={name}
            target="_blank"
            rel="noopener noreferrer"
            title="Download"
            aria-label={`Download ${name}`}
          >
            <FaDownload />
          </a>
        ) : null}
        {typeof onRemove === 'function' ? (
          <button
            type="button"
            className="btn btn-link btn-sm p-0 text-danger"
            onClick={onRemove}
            title="Remove"
            aria-label={`Remove ${name}`}
          >
            <FaXmark />
          </button>
        ) : null}
      </div>
    </div>
  );
}
