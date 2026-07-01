export const parseVariationAttrs = (name) => {
  const match = String(name || '').match(/\[([^\]]+)\]/);
  if (!match) return [];
  return match[1]
    .split(/\s*-\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
};
