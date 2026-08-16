import { useEffect, useState } from 'react';

/**
 * Product image that falls back to the store logo when the product has no
 * picture or its URL fails to load. `fallback` renders only when the store has
 * no usable logo either.
 */
export default function ShopImage({
  src = '',
  logo = '',
  alt = '',
  className = '',
  loading,
  fallback = null,
}) {
  const [srcFailed, setSrcFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setSrcFailed(false);
  }, [src]);

  useEffect(() => {
    setLogoFailed(false);
  }, [logo]);

  const usingLogo = !src || srcFailed;
  const url = usingLogo ? (logoFailed ? '' : logo) : src;

  if (!url) return fallback;

  return (
    <img
      src={url}
      alt={alt}
      loading={loading}
      className={`${className} ${usingLogo ? 'shop-img-logo' : ''}`.trim() || undefined}
      onError={() => (usingLogo ? setLogoFailed(true) : setSrcFailed(true))}
    />
  );
}
