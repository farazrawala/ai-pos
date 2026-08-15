export const MEMORY_DIFFICULTIES = {
  easy: { label: 'Easy', rows: 4, columns: 4, pairs: 8 },
  medium: { label: 'Medium', rows: 4, columns: 6, pairs: 12 },
  hard: { label: 'Hard', rows: 6, columns: 6, pairs: 18 },
};

const EMOJIS = [
  '🍎',
  '🍊',
  '🍋',
  '🍉',
  '🍇',
  '🍓',
  '🥝',
  '🍒',
  '🥑',
  '🌽',
  '🥕',
  '🍄',
  '🌻',
  '🌈',
  '⭐',
  '🌙',
  '🚀',
  '🎈',
];

export function shuffleCards(cards, random = Math.random) {
  const shuffled = [...cards];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function createMemoryDeck(difficulty = 'easy', random = Math.random) {
  const config = MEMORY_DIFFICULTIES[difficulty];
  if (!config) throw new Error(`Unknown Memory difficulty: ${difficulty}`);

  const cards = EMOJIS.slice(0, config.pairs).flatMap((emoji, pairIndex) => [
    { id: `${difficulty}-${pairIndex}-a`, pairId: pairIndex, emoji, matched: false },
    { id: `${difficulty}-${pairIndex}-b`, pairId: pairIndex, emoji, matched: false },
  ]);

  return shuffleCards(cards, random);
}

export function isMatchingPair(firstCard, secondCard) {
  return Boolean(
    firstCard &&
      secondCard &&
      firstCard.id !== secondCard.id &&
      firstCard.pairId === secondCard.pairId
  );
}

export function markPairMatched(cards, firstId, secondId) {
  const firstCard = cards.find((card) => card.id === firstId);
  const secondCard = cards.find((card) => card.id === secondId);

  if (!isMatchingPair(firstCard, secondCard)) return cards;

  return cards.map((card) =>
    card.id === firstId || card.id === secondId ? { ...card, matched: true } : card
  );
}
