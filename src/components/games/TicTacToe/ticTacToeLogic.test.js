import { describe, expect, it } from 'vitest';
import { getBestMove, getComputerMove, getGameResult } from './ticTacToeLogic.js';

describe('getGameResult', () => {
  it('detects a winner and returns the winning cells', () => {
    expect(getGameResult(['X', null, 'O', 'X', 'O', null, 'X', null, null])).toEqual({
      winner: 'X',
      winningLine: [0, 3, 6],
      isDraw: false,
    });
  });

  it('detects a full-board draw', () => {
    expect(getGameResult(['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'])).toEqual({
      winner: null,
      winningLine: [],
      isDraw: true,
    });
  });

  it('keeps an unfinished game active', () => {
    expect(getGameResult(['X', null, null, null, 'O', null, null, null, null])).toEqual({
      winner: null,
      winningLine: [],
      isDraw: false,
    });
  });
});

describe('computer moves', () => {
  it('uses minimax to take an immediate win', () => {
    expect(getBestMove(['O', 'O', null, 'X', 'X', null, null, null, null])).toBe(2);
  });

  it('uses minimax to block a forced loss', () => {
    expect(getBestMove(['X', 'X', null, null, 'O', null, null, null, null])).toBe(2);
  });

  it('uses the center as the optimal response to a corner opening', () => {
    expect(getBestMove(['X', null, null, null, null, null, null, null, null])).toBe(4);
  });

  it('makes medium difficulty win before considering a block', () => {
    const board = ['O', 'O', null, 'X', 'X', null, null, null, null];
    expect(getComputerMove(board, 'medium', () => 0.99)).toBe(2);
  });

  it('returns no move for a completed game', () => {
    const board = ['X', 'X', 'X', 'O', 'O', null, null, null, null];
    expect(getBestMove(board)).toBeNull();
  });
});
