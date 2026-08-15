export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;

export const TETROMINOES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
};

export const TETROMINO_TYPES = Object.keys(TETROMINOES);

export function createBoard() {
  return Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(null));
}

export function createPiece(type) {
  const matrix = TETROMINOES[type];
  if (!matrix) throw new Error(`Unknown tetromino: ${type}`);

  return {
    type,
    matrix: matrix.map((row) => [...row]),
    x: Math.floor((BOARD_WIDTH - matrix[0].length) / 2),
    y: 0,
  };
}

export function rotateMatrix(matrix) {
  return matrix[0].map((_, column) =>
    matrix.map((row) => row[column]).reverse()
  );
}

export function collides(board, piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
  for (let y = 0; y < matrix.length; y += 1) {
    for (let x = 0; x < matrix[y].length; x += 1) {
      if (!matrix[y][x]) continue;

      const boardX = piece.x + x + offsetX;
      const boardY = piece.y + y + offsetY;
      if (
        boardX < 0 ||
        boardX >= BOARD_WIDTH ||
        boardY >= BOARD_HEIGHT ||
        (boardY >= 0 && board[boardY][boardX])
      ) {
        return true;
      }
    }
  }

  return false;
}

export function mergePiece(board, piece) {
  const merged = board.map((row) => [...row]);

  piece.matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      const boardY = piece.y + y;
      const boardX = piece.x + x;
      if (cell && boardY >= 0 && boardY < BOARD_HEIGHT) {
        merged[boardY][boardX] = piece.type;
      }
    });
  });

  return merged;
}

export function clearLines(board) {
  const remainingRows = board
    .filter((row) => row.some((cell) => !cell))
    .map((row) => [...row]);
  const linesCleared = BOARD_HEIGHT - remainingRows.length;
  const emptyRows = Array.from(
    { length: linesCleared },
    () => Array(BOARD_WIDTH).fill(null)
  );

  return {
    board: [...emptyRows, ...remainingRows],
    linesCleared,
  };
}

export function getDropDistance(board, piece) {
  let distance = 0;
  while (!collides(board, piece, 0, distance + 1)) distance += 1;
  return distance;
}
