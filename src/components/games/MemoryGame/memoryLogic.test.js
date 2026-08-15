import { describe, expect, it } from 'vitest';
import {
  MEMORY_DIFFICULTIES,
  createMemoryDeck,
  isMatchingPair,
  markPairMatched,
  shuffleCards,
} from './memoryLogic.js';

describe('Memory deck generation', () => {
  it.each(Object.entries(MEMORY_DIFFICULTIES))(
    'creates the correct number of pairs for %s',
    (difficulty, config) => {
      const deck = createMemoryDeck(difficulty, () => 0.5);
      const pairCounts = deck.reduce((counts, card) => {
        counts[card.pairId] = (counts[card.pairId] || 0) + 1;
        return counts;
      }, {});

      expect(deck).toHaveLength(config.rows * config.columns);
      expect(new Set(deck.map((card) => card.id)).size).toBe(deck.length);
      expect(Object.values(pairCounts)).toEqual(Array(config.pairs).fill(2));
      expect(deck.every((card) => card.matched === false)).toBe(true);
    }
  );

  it('shuffles without changing or mutating the source cards', () => {
    const source = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
    const shuffled = shuffleCards(source, () => 0);

    expect(shuffled).toEqual([{ id: 2 }, { id: 3 }, { id: 4 }, { id: 1 }]);
    expect(source).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
  });
});

describe('Memory pair matching', () => {
  const cards = [
    { id: 'one-a', pairId: 1, emoji: '🍎', matched: false },
    { id: 'one-b', pairId: 1, emoji: '🍎', matched: false },
    { id: 'two-a', pairId: 2, emoji: '🍋', matched: false },
  ];

  it('matches two different cards from the same pair', () => {
    expect(isMatchingPair(cards[0], cards[1])).toBe(true);
    expect(isMatchingPair(cards[0], cards[0])).toBe(false);
    expect(isMatchingPair(cards[0], cards[2])).toBe(false);
  });

  it('marks only a valid pair and keeps input immutable', () => {
    const matched = markPairMatched(cards, 'one-a', 'one-b');

    expect(matched).not.toBe(cards);
    expect(matched.map((card) => card.matched)).toEqual([true, true, false]);
    expect(cards.every((card) => card.matched === false)).toBe(true);
    expect(markPairMatched(cards, 'one-a', 'two-a')).toBe(cards);
  });
});
