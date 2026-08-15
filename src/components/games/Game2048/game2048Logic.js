export const BOARD_SIZE = 4;

export function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

export function mergeLine(line) {
  const compacted = line.filter((value) => value !== 0);
  const merged = [];
  let score = 0;

  for (let index = 0; index < compacted.length; index += 1) {
    if (compacted[index] === compacted[index + 1]) {
      const value = compacted[index] * 2;
      merged.push(value);
      score += value;
      index += 1;
    } else {
      merged.push(compacted[index]);
    }
  }

  return {
    line: [...merged, ...Array(BOARD_SIZE - merged.length).fill(0)],
    score,
  };
}

function boardsEqual(first, second) {
  return first.every((row, rowIndex) =>
    row.every((value, columnIndex) => value === second[rowIndex][columnIndex])
  );
}

function transpose(board) {
  return board[0].map((_, columnIndex) => board.map((row) => row[columnIndex]));
}

export function moveBoard(board, direction) {
  const movesLeft = direction === 'left' || direction === 'right';
  const reverse = direction === 'right' || direction === 'down';
  const lines = movesLeft ? board.map((row) => [...row]) : transpose(board);
  let score = 0;

  const movedLines = lines.map((line) => {
    const input = reverse ? [...line].reverse() : line;
    const result = mergeLine(input);
    score += result.score;
    return reverse ? result.line.reverse() : result.line;
  });

  const nextBoard = movesLeft ? movedLines : transpose(movedLines);
  return {
    board: nextBoard,
    score,
    moved: !boardsEqual(board, nextBoard),
  };
}

export function spawnTile(board, random = Math.random) {
  const emptyCells = [];

  board.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (value === 0) emptyCells.push([rowIndex, columnIndex]);
    });
  });

  if (emptyCells.length === 0) return board.map((row) => [...row]);

  const positionIndex = Math.min(
    emptyCells.length - 1,
    Math.floor(random() * emptyCells.length)
  );
  const [rowIndex, columnIndex] = emptyCells[positionIndex];
  const nextBoard = board.map((row) => [...row]);
  nextBoard[rowIndex][columnIndex] = random() < 0.9 ? 2 : 4;
  return nextBoard;
}

export function createInitialBoard(random = Math.random) {
  return spawnTile(spawnTile(createEmptyBoard(), random), random);
}

export function hasWinningTile(board) {
  return board.some((row) => row.some((value) => value >= 2048));
}

export function isGameOver(board) {
  if (board.some((row) => row.includes(0))) return false;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      if (
        (column < BOARD_SIZE - 1 && board[row][column] === board[row][column + 1]) ||
        (row < BOARD_SIZE - 1 && board[row][column] === board[row + 1][column])
      ) {
        return false;
      }
    }
  }

  return true;
}
