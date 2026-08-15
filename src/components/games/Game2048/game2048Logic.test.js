import { describe, expect, it } from 'vitest';
import {
  createEmptyBoard,
  isGameOver,
  mergeLine,
  moveBoard,
  spawnTile,
} from './game2048Logic.js';

describe('mergeLine', () => {
  it('merges each pair only once and reports score', () => {
    expect(mergeLine([2, 2, 2, 2])).toEqual({
      line: [4, 4, 0, 0],
      score: 8,
    });
    expect(mergeLine([2, 2, 4, 0])).toEqual({
      line: [4, 4, 0, 0],
      score: 4,
    });
  });

  it('compacts tiles without merging different values', () => {
    expect(mergeLine([2, 0, 4, 2])).toEqual({
      line: [2, 4, 2, 0],
      score: 0,
    });
  });
});

describe('moveBoard', () => {
  it('moves and merges columns upward', () => {
    const result = moveBoard(
      [
        [2, 0, 0, 0],
        [2, 0, 0, 0],
        [4, 0, 0, 0],
        [4, 0, 0, 0],
      ],
      'up'
    );

    expect(result).toEqual({
      board: [
        [4, 0, 0, 0],
        [8, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      score: 12,
      moved: true,
    });
  });
});

describe('spawnTile', () => {
  it('spawns a two in a deterministic empty cell without mutating input', () => {
    const board = createEmptyBoard();
    const randomValues = [0.5, 0.1];
    const spawned = spawnTile(board, () => randomValues.shift());

    expect(spawned.flat().filter(Boolean)).toEqual([2]);
    expect(spawned[2][0]).toBe(2);
    expect(board).toEqual(createEmptyBoard());
  });

  it('can spawn a four', () => {
    const randomValues = [0, 0.95];
    expect(spawnTile(createEmptyBoard(), () => randomValues.shift())[0][0]).toBe(4);
  });
});

describe('isGameOver', () => {
  it('detects a full board with no adjacent matches', () => {
    expect(
      isGameOver([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 8],
      ])
    ).toBe(true);
  });

  it('allows boards with an empty cell or available merge', () => {
    expect(
      isGameOver([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 2, 4],
        [4, 2, 4, 0],
      ])
    ).toBe(false);
    expect(
      isGameOver([
        [2, 4, 2, 4],
        [4, 2, 4, 2],
        [2, 4, 4, 8],
        [4, 2, 8, 16],
      ])
    ).toBe(false);
  });
});
