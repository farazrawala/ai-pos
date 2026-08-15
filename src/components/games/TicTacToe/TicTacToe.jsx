import { useCallback, useEffect, useState } from 'react';
import GameShell from '../GameShell/index.js';
import { getComputerMove, getGameResult } from './ticTacToeLogic.js';
import './TicTacToe.css';

const EMPTY_BOARD = Array(9).fill(null);
const SCORE_KEY = 'pos_tic_tac_toe_score';
const EMPTY_SCORE = { X: 0, O: 0, draws: 0 };

const loadScore = () => {
  try {
    const savedScore = JSON.parse(localStorage.getItem(SCORE_KEY));
    return {
      X: Number(savedScore?.X) || 0,
      O: Number(savedScore?.O) || 0,
      draws: Number(savedScore?.draws) || 0,
    };
  } catch {
    return EMPTY_SCORE;
  }
};

const TicTacToe = () => {
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [currentPlayer, setCurrentPlayer] = useState('X');
  const [mode, setMode] = useState('computer');
  const [difficulty, setDifficulty] = useState('hard');
  const [score, setScore] = useState(loadScore);
  const [isComputerThinking, setIsComputerThinking] = useState(false);

  const result = getGameResult(board);
  const isFinished = Boolean(result.winner || result.isDraw);

  const saveScore = useCallback((nextScore) => {
    setScore(nextScore);
    try {
      localStorage.setItem(SCORE_KEY, JSON.stringify(nextScore));
    } catch {
      // The game remains playable when storage is unavailable.
    }
  }, []);

  const finishMove = useCallback(
    (nextBoard, mark) => {
      const nextResult = getGameResult(nextBoard);
      if (nextResult.winner) {
        saveScore({ ...score, [nextResult.winner]: score[nextResult.winner] + 1 });
      } else if (nextResult.isDraw) {
        saveScore({ ...score, draws: score.draws + 1 });
      } else {
        setCurrentPlayer(mark === 'X' ? 'O' : 'X');
      }
    },
    [saveScore, score],
  );

  const playMove = useCallback(
    (index, mark) => {
      if (board[index] || isFinished) return;
      const nextBoard = [...board];
      nextBoard[index] = mark;
      setBoard(nextBoard);
      finishMove(nextBoard, mark);
    },
    [board, finishMove, isFinished],
  );

  useEffect(() => {
    if (mode !== 'computer' || currentPlayer !== 'O' || isFinished) {
      setIsComputerThinking(false);
      return undefined;
    }

    setIsComputerThinking(true);
    const timer = window.setTimeout(() => {
      const move = getComputerMove(board, difficulty);
      if (move !== null) playMove(move, 'O');
      setIsComputerThinking(false);
    }, 450);

    return () => {
      window.clearTimeout(timer);
    };
  }, [board, currentPlayer, difficulty, isFinished, mode, playMove]);

  const startNewGame = useCallback(() => {
    setBoard([...EMPTY_BOARD]);
    setCurrentPlayer('X');
    setIsComputerThinking(false);
  }, []);

  const changeMode = (nextMode) => {
    setMode(nextMode);
    startNewGame();
  };

  const resetScore = () => saveScore({ ...EMPTY_SCORE });

  const status = result.winner
    ? `${result.winner} wins!`
    : result.isDraw
      ? 'Draw game'
      : isComputerThinking
        ? 'Computer is thinking…'
        : `${currentPlayer}'s turn`;

  return (
    <GameShell emoji="⭕" title="Tic-Tac-Toe">
      <div className="tic-tac-toe">
        <div className="tic-tac-toe__scoreboard" aria-label="Scoreboard">
          <div><span>X wins</span><strong>{score.X}</strong></div>
          <div><span>Draws</span><strong>{score.draws}</strong></div>
          <div><span>O wins</span><strong>{score.O}</strong></div>
        </div>

        <div className="tic-tac-toe__controls">
          <fieldset>
            <legend>Game mode</legend>
            <div className="tic-tac-toe__segmented">
              <button
                type="button"
                className={mode === 'computer' ? 'is-active' : ''}
                aria-pressed={mode === 'computer'}
                onClick={() => changeMode('computer')}
              >
                vs Computer
              </button>
              <button
                type="button"
                className={mode === 'players' ? 'is-active' : ''}
                aria-pressed={mode === 'players'}
                onClick={() => changeMode('players')}
              >
                2 Players
              </button>
            </div>
          </fieldset>

          {mode === 'computer' && (
            <fieldset>
              <legend>Difficulty</legend>
              <div className="tic-tac-toe__segmented">
                {['easy', 'medium', 'hard'].map((level) => (
                  <button
                    type="button"
                    key={level}
                    className={difficulty === level ? 'is-active' : ''}
                    aria-pressed={difficulty === level}
                    onClick={() => {
                      setDifficulty(level);
                      startNewGame();
                    }}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <p className={`tic-tac-toe__status${isFinished ? ' is-finished' : ''}`} aria-live="polite">
          {status}
        </p>

        <div className="tic-tac-toe__board" role="grid" aria-label="Tic-Tac-Toe board">
          {board.map((cell, index) => {
            const isWinningCell = result.winningLine.includes(index);
            return (
              <button
                type="button"
                role="gridcell"
                className={`tic-tac-toe__cell${cell ? ` is-${cell.toLowerCase()}` : ''}${
                  isWinningCell ? ' is-winning' : ''
                }`}
                key={index}
                aria-label={`Row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}${
                  cell ? `: ${cell}` : ': empty'
                }`}
                disabled={
                  Boolean(cell) ||
                  isFinished ||
                  isComputerThinking ||
                  (mode === 'computer' && currentPlayer === 'O')
                }
                onClick={() => playMove(index, currentPlayer)}
              >
                {cell}
              </button>
            );
          })}
        </div>

        <div className="tic-tac-toe__actions">
          <button type="button" className="btn btn-primary" onClick={startNewGame}>
            New Game
          </button>
          <button type="button" className="btn btn-outline-secondary" onClick={resetScore}>
            Reset Scores
          </button>
        </div>
      </div>
    </GameShell>
  );
};

export default TicTacToe;
