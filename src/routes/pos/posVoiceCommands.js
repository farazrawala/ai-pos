const FILLER_WORDS = new Set([
  'a',
  'an',
  'the',
  'please',
  'add',
  'product',
  'products',
  'item',
  'items',
  'barcode',
  'code',
  'sku',
  'to',
  'cart',
  'buy',
  'get',
  'give',
  'me',
  'one',
]);

const MAX_VOICE_QTY = 20;

/**
 * Parse a spoken POS command into quantity + product lookup query.
 *
 * Examples: "coke", "add coke", "add 2 pepsi", "2 pepsi", "barcode 12345"
 *
 * @param {string} transcript
 * @returns {{ qty: number; query: string }}
 */
export function parsePosVoiceCommand(transcript) {
  const raw = String(transcript ?? '')
    .trim()
    .toLowerCase()
    .replace(/[.,!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!raw) return { qty: 1, query: '' };

  const tokens = raw.split(' ').filter(Boolean);
  let qty = 1;
  const rest = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const asNum = Number(token);
    if (
      Number.isFinite(asNum) &&
      asNum >= 1 &&
      asNum <= MAX_VOICE_QTY &&
      String(Math.floor(asNum)) === token
    ) {
      // Prefer the first spoken quantity; later numbers may be part of a barcode.
      if (rest.length === 0 && qty === 1) {
        qty = Math.floor(asNum);
        continue;
      }
    }
    if (FILLER_WORDS.has(token)) continue;
    rest.push(token);
  }

  // "one coke" was stripped as filler — restore qty 1 with remaining query.
  let query = rest.join(' ').trim();

  // If everything was filler but transcript had content, fall back to raw minus leading add/qty.
  if (!query) {
    query = raw
      .replace(/^(please\s+)?(add\s+)?(product\s+)?/i, '')
      .replace(/^\d+\s+/, '')
      .trim();
  }

  return {
    qty: Math.min(Math.max(1, qty), MAX_VOICE_QTY),
    query,
  };
}
