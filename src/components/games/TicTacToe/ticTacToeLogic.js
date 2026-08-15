export const WINNING_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const getGameResult = (board) => {
  for (const line of WINNING_LINES) {
    const [first, second, third] = line;
    if (board[first] && board[first] === board[second] && board[first] === board[third]) {
      return { winner: board[first], winningLine: line, isDraw: false };
    }
  }

  return {
    winner: null,
    winningLine: [],
    isDraw: board.every(Boolean),
  };
};

const getEmptyCells = (board) =>
  board.reduce((emptyCells, cell, index) => {
    if (!cell) emptyCells.push(index);
    return emptyCells;
  }, []);

const minimax = (board, isMaximizing, depth) => {
  const { winner, isDraw } = getGameResult(board);
  if (winner === 'O') return 10 - depth;
  if (winner === 'X') return depth - 10;
  if (isDraw) return 0;

  const scores = getEmptyCells(board).map((index) => {
    const nextBoard = [...board];
    nextBoard[index] = isMaximizing ? 'O' : 'X';
    return minimax(nextBoard, !isMaximizing, depth + 1);
  });

  return isMaximizing ? Math.max(...scores) : Math.min(...scores);
};

export const getBestMove = (board) => {
  if (getGameResult(board).winner || getGameResult(board).isDraw) return null;

  let bestScore = -Infinity;
  let bestMove = null;

  getEmptyCells(board).forEach((index) => {
    const nextBoard = [...board];
    nextBoard[index] = 'O';
    const score = minimax(nextBoard, false, 0);
    if (score > bestScore) {
      bestScore = score;
      bestMove = index;
    }
  });

  return bestMove;
};

const getRandomMove = (board, random) => {
  const emptyCells = getEmptyCells(board);
  if (!emptyCells.length) return null;
  return emptyCells[Math.floor(random() * emptyCells.length)];
};

const findTacticalMove = (board, mark) => {
  for (const index of getEmptyCells(board)) {
    const nextBoard = [...board];
    nextBoard[index] = mark;
    if (getGameResult(nextBoard).winner === mark) return index;
  }
  return null;
};

export const getComputerMove = (board, difficulty, random = Math.random) => {
  if (getGameResult(board).winner || getGameResult(board).isDraw) return null;
  if (difficulty === 'hard') return getBestMove(board);

  if (difficulty === 'medium') {
    return (
      findTacticalMove(board, 'O') ??
      findTacticalMove(board, 'X') ??
      getRandomMove(board, random)
    );
  }

  return getRandomMove(board, random);
};
