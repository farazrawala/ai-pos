import { useState } from 'react';

/**
 * Click + drag-and-drop file picker for product images.
 * Hidden native input stays available for accessibility / form reset via ref.
 */
export default function ProductImageDropzone({
  inputRef,
  accept,
  multiple = false,
  disabled = false,
  onFiles,
  hint,
  id,
  compact = false,
  className = '',
  children,
}) {
  const [dragOver, setDragOver] = useState(false);

  const emitFiles = (fileList) => {
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) return;
    onFiles(multiple ? files : files.slice(0, 1));
  };

  const handleInputChange = (e) => {
    emitFiles(e.target.files);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled) return;
    emitFiles(e.dataTransfer.files);
  };

  const openPicker = () => {
    if (disabled) return;
    inputRef?.current?.click();
  };

  return (
    <>
      <input
        ref={inputRef}
        id={id}
        type="file"
        className="d-none"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        disabled={disabled}
      />
      <div
        className={`product-image-dropzone${compact ? ' product-image-dropzone--compact' : ''}${dragOver ? ' is-dragging' : ''}${disabled ? ' is-disabled' : ''}${className ? ` ${className}` : ''}`}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={multiple ? 'Upload images' : 'Upload image'}
        aria-disabled={disabled || undefined}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openPicker();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setDragOver(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOver(false);
          }
        }}
        onDrop={handleDrop}
      >
        {children ?? (
          <>
            <div className="product-image-dropzone-icon" aria-hidden="true">
              <i className="fas fa-cloud-arrow-up" />
            </div>
            <p className="product-image-dropzone-text">
              {multiple ? 'Drag & drop images here' : 'Drag & drop an image here'}
            </p>
            <p className="product-image-dropzone-or">or</p>
            <span className="product-image-dropzone-browse">Browse files</span>
            {hint ? <p className="product-image-dropzone-sub">{hint}</p> : null}
          </>
        )}
      </div>
    </>
  );
}
