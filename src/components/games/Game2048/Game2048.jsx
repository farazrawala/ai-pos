import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '../GameShell/index.js';
import {
  createInitialBoard,
  hasWinningTile,
  isGameOver,
  moveBoard,
  spawnTile,
} from './game2048Logic.js';
import './Game2048.css';

const HIGH_SCORE_KEY = 'pos_2048_high_score';
const SWIPE_THRESHOLD = 30;

const KEY_DIRECTIONS = {
  ArrowUp: 'up',
  w: 'up',
  ArrowDown: 'down',
  s: 'down',
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
};

function readHighScore() {
  try {
    const stored = Number.parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
    return Number.isFinite(stored) && stored > 0 ? stored : 0;
  } catch {
    return 0;
  }
}

function storeHighScore(score) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // Storage can be unavailable in privacy modes; gameplay remains fully functional.
  }
}

function isEditableTarget(target) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT')
  );
}

const Game2048 = () => {
  const [board, setBoard] = useState(createInitialBoard);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(readHighScore);
  const [status, setStatus] = useState('playing');
  const [hasWon, setHasWon] = useState(false);
  const gameRef = useRef(null);
  const touchStartRef = useRef(null);

  const updateBest = useCallback((nextScore) => {
    setBest((currentBest) => {
      const nextBest = Math.max(currentBest, nextScore);
      if (nextBest !== currentBest) storeHighScore(nextBest);
      return nextBest;
    });
  }, []);

  const move = useCallback(
    (direction) => {
      if (status !== 'playing') return;

      const result = moveBoard(board, direction);
      if (!result.moved) return;

      const nextBoard = spawnTile(result.board);
      const nextScore = score + result.score;
      const reachedWin = !hasWon && hasWinningTile(nextBoard);

      setBoard(nextBoard);
      setScore(nextScore);
      updateBest(nextScore);

      if (reachedWin) {
        setHasWon(true);
        setStatus('won');
      } else if (isGameOver(nextBoard)) {
        setStatus('over');
      }
    },
    [board, hasWon, score, status, updateBest]
  );

  const startNewGame = useCallback(() => {
    setBoard(createInitialBoard());
    setScore(0);
    setStatus('playing');
    setHasWon(false);
    gameRef.current?.focus({ preventScroll: true });
  }, []);

  const continueGame = useCallback(() => {
    setStatus(isGameOver(board) ? 'over' : 'playing');
    gameRef.current?.focus({ preventScroll: true });
  }, [board]);

  useEffect(() => {
    gameRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isEditableTarget(event.target)) return;

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const direction = KEY_DIRECTIONS[key];
      if (!direction) return;

      event.preventDefault();
      move(direction);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [move]);

  const handleTouchStart = (event) => {
    const touch = event.changedTouches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event) => {
    if (!touchStartRef.current) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    touchStartRef.current = null;

    if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < SWIPE_THRESHOLD) return;
    move(Math.abs(deltaX) > Math.abs(deltaY) ? (deltaX > 0 ? 'right' : 'left') : deltaY > 0 ? 'down' : 'up');
  };

  const statusMessage =
    status === 'won'
      ? 'You reached 2048'
      : status === 'over'
        ? 'Game over'
        : 'Game in progress';

  return (
    <GameShell emoji="🔢" title="2048">
      <div
        ref={gameRef}
        className="game-2048"
        tabIndex="-1"
        aria-label="2048 game"
      >
        <div className="game-2048__topbar">
          <div className="game-2048__scoreboard" aria-label="Game scores">
            <div className="game-2048__score">
              <span>Score</span>
              <strong>{score}</strong>
            </div>
            <div className="game-2048__score">
              <span>Best</span>
              <strong>{best}</strong>
            </div>
          </div>
          <button type="button" className="btn bg-gradient-primary" onClick={startNewGame}>
            New Game
          </button>
        </div>

        <div className="game-2048__board-shell">
          <div
            className="game-2048__board"
            role="grid"
            aria-label={`2048 board. Score ${score}. ${statusMessage}.`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={() => {
              touchStartRef.current = null;
            }}
          >
            {board.flatMap((row, rowIndex) =>
              row.map((value, columnIndex) => (
                <div
                  key={`${rowIndex}-${columnIndex}`}
                  className="game-2048__cell"
                  role="gridcell"
                  aria-label={
                    value
                      ? `Row ${rowIndex + 1}, column ${columnIndex + 1}: ${value}`
                      : `Row ${rowIndex + 1}, column ${columnIndex + 1}: empty`
                  }
                >
                  {value > 0 && (
                    <div className="game-2048__tile" data-value={value}>
                      {value}
                    </div>
                  )}
                </div>
              ))
            )}

            {status === 'won' && (
              <div className="game-2048__overlay" role="dialog" aria-modal="true" aria-labelledby="game-2048-win-title">
                <span className="game-2048__overlay-icon" aria-hidden="true">🏆</span>
                <h2 id="game-2048-win-title">You Win!</h2>
                <p>You reached the 2048 tile.</p>
                <div className="game-2048__overlay-actions">
                  <button type="button" className="btn bg-gradient-primary" onClick={continueGame}>
                    Continue
                  </button>
                  <button type="button" className="btn btn-outline-light" onClick={startNewGame}>
                    New Game
                  </button>
                </div>
              </div>
            )}

            {status === 'over' && (
              <div className="game-2048__overlay" role="dialog" aria-modal="true" aria-labelledby="game-2048-over-title">
                <span className="game-2048__overlay-icon" aria-hidden="true">🔢</span>
                <h2 id="game-2048-over-title">Game Over</h2>
                <p>No more moves. Final score: <strong>{score}</strong></p>
                <button type="button" className="btn bg-gradient-primary" onClick={startNewGame}>
                  Play Again
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="game-2048__status" aria-live="polite">{statusMessage}</p>
        <p className="game-2048__hint">
          Use arrow keys or W A S D <span aria-hidden="true">•</span> Swipe on touch screens
        </p>
      </div>
    </GameShell>
  );
};

export default Game2048;
