import { describe, expect, it } from 'vitest';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  clearLines,
  collides,
  createBoard,
  createPiece,
  mergePiece,
  rotateMatrix,
} from './tetrisLogic.js';

describe('Tetris collision logic', () => {
  it('detects walls and the bottom of the playfield', () => {
    const board = createBoard();
    const piece = createPiece('O');

    expect(collides(board, { ...piece, x: -1 })).toBe(true);
    expect(collides(board, { ...piece, x: BOARD_WIDTH - 1 })).toBe(true);
    expect(collides(board, { ...piece, y: BOARD_HEIGHT - 1 })).toBe(true);
    expect(collides(board, { ...piece, x: 4, y: BOARD_HEIGHT - 2 })).toBe(false);
  });

  it('detects occupied cells and permits empty space above the board', () => {
    const board = createBoard();
    board[5][4] = 'J';
    const piece = { ...createPiece('O'), x: 4, y: 4 };

    expect(collides(board, piece)).toBe(true);
    expect(collides(board, { ...piece, y: -2 })).toBe(false);
  });

  it('rotates a matrix clockwise without mutating it', () => {
    const matrix = [
      [1, 0],
      [1, 1],
    ];

    expect(rotateMatrix(matrix)).toEqual([
      [1, 1],
      [1, 0],
    ]);
    expect(matrix).toEqual([
      [1, 0],
      [1, 1],
    ]);
  });
});

describe('Tetris locking and line clearing', () => {
  it('merges a piece into a copied board', () => {
    const board = createBoard();
    const piece = { ...createPiece('O'), x: 3, y: 18 };
    const merged = mergePiece(board, piece);

    expect(merged[18].slice(3, 5)).toEqual(['O', 'O']);
    expect(merged[19].slice(3, 5)).toEqual(['O', 'O']);
    expect(board[18][3]).toBe(null);
  });

  it('clears complete lines and adds independent empty rows at the top', () => {
    const board = createBoard();
    board[17][0] = 'T';
    board[18] = Array(BOARD_WIDTH).fill('I');
    board[19] = Array(BOARD_WIDTH).fill('Z');

    const result = clearLines(board);

    expect(result.linesCleared).toBe(2);
    expect(result.board).toHaveLength(BOARD_HEIGHT);
    expect(result.board[19][0]).toBe('T');
    expect(result.board[0]).toEqual(Array(BOARD_WIDTH).fill(null));
    expect(result.board[0]).not.toBe(result.board[1]);
  });
});
