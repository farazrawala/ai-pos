/** MIME types accepted for product images (must match backend `handleImageUpload`). */
export const PRODUCT_IMAGE_ACCEPT =
  'image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif';

export const PRODUCT_IMAGE_ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
];

export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const PRODUCT_IMAGE_HINT =
  'JPEG, PNG, GIF, WebP, or AVIF (max 5MB)';

/**
 * @param {File} file
 * @returns {string} empty string when valid, otherwise an error message
 */
export function validateProductImageFile(file) {
  if (!file) return 'Please select an image file';
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    return 'Image size must be less than 5MB';
  }
  const type = String(file.type || '').toLowerCase();
  const ext = String(file.name || '')
    .split('.')
    .pop()
    ?.toLowerCase();
  const allowedByType = PRODUCT_IMAGE_ALLOWED_TYPES.includes(type);
  const allowedByExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'].includes(ext || '');
  if (!allowedByType && !allowedByExt) {
    return 'Unsupported image type. Use JPEG, PNG, GIF, WebP, or AVIF.';
  }
  return '';
}
