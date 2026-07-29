import AppModal from '../AppModal.jsx';

export default function ImagePreviewModal({ open, src, alt = 'Attachment', onClose }) {
  return (
    <AppModal open={open} onClose={onClose} title={alt || 'Image preview'} size="lg">
      {src ? (
        <div className="text-center">
          <img src={src} alt={alt} className="img-fluid rounded support-image-preview" />
        </div>
      ) : null}
    </AppModal>
  );
}
