import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GameShell from '../GameShell/index.js';
import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  TETROMINO_TYPES,
  clearLines,
  collides,
  createBoard,
  createPiece,
  getDropDistance,
  mergePiece,
  rotateMatrix,
} from './tetrisLogic.js';
import './TetrisGame.css';

const HIGH_SCORE_KEY = 'pos_tetris_high_score';
const LINE_SCORES = [0, 100, 300, 500, 800];

function readHighScore() {
  try {
    const value = Number.parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function storeHighScore(score) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // Storage can be unavailable in private browsing; gameplay remains functional.
  }
}

function shuffledBag() {
  const bag = [...TETROMINO_TYPES];
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [bag[index], bag[randomIndex]] = [bag[randomIndex], bag[index]];
  }
  return bag;
}

function dropSpeed(level) {
  return Math.max(90, 800 - (level - 1) * 65);
}

const TetrisGame = () => {
  const gameRef = useRef(null);
  const bagRef = useRef([]);

  const nextPiece = useCallback(() => {
    if (!bagRef.current.length) bagRef.current = shuffledBag();
    return createPiece(bagRef.current.pop());
  }, []);

  const [board, setBoard] = useState(createBoard);
  const [piece, setPiece] = useState(nextPiece);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [highScore, setHighScore] = useState(readHighScore);
  const [status, setStatus] = useState('running');
  const [autoPaused, setAutoPaused] = useState(false);

  const boardRef = useRef(board);
  const pieceRef = useRef(piece);
  const scoreRef = useRef(score);
  const linesRef = useRef(lines);
  const statusRef = useRef(status);
  const level = Math.floor(lines / 10) + 1;

  const updateBoard = useCallback((nextBoard) => {
    boardRef.current = nextBoard;
    setBoard(nextBoard);
  }, []);

  const updatePiece = useCallback((nextActivePiece) => {
    pieceRef.current = nextActivePiece;
    setPiece(nextActivePiece);
  }, []);

  const updateStatus = useCallback((nextStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const addScore = useCallback((points) => {
    if (!points) return;
    const nextScore = scoreRef.current + points;
    scoreRef.current = nextScore;
    setScore(nextScore);
    setHighScore((currentBest) => {
      const nextBest = Math.max(currentBest, nextScore);
      if (nextBest !== currentBest) storeHighScore(nextBest);
      return nextBest;
    });
  }, []);

  const lockPiece = useCallback(() => {
    const merged = mergePiece(boardRef.current, pieceRef.current);
    const cleared = clearLines(merged);
    const currentLevel = Math.floor(linesRef.current / 10) + 1;
    const nextLines = linesRef.current + cleared.linesCleared;

    updateBoard(cleared.board);
    linesRef.current = nextLines;
    setLines(nextLines);
    addScore(LINE_SCORES[cleared.linesCleared] * currentLevel);

    const spawnedPiece = nextPiece();
    updatePiece(spawnedPiece);
    if (collides(cleared.board, spawnedPiece)) updateStatus('over');
  }, [addScore, nextPiece, updateBoard, updatePiece, updateStatus]);

  const dropOne = useCallback((softDrop = false) => {
    if (statusRef.current !== 'running') return;
    const activePiece = pieceRef.current;

    if (!collides(boardRef.current, activePiece, 0, 1)) {
      updatePiece({ ...activePiece, y: activePiece.y + 1 });
      if (softDrop) addScore(1);
      return;
    }

    lockPiece();
  }, [addScore, lockPiece, updatePiece]);

  const moveHorizontal = useCallback((offset) => {
    if (statusRef.current !== 'running') return;
    const activePiece = pieceRef.current;
    if (!collides(boardRef.current, activePiece, offset, 0)) {
      updatePiece({ ...activePiece, x: activePiece.x + offset });
    }
  }, [updatePiece]);

  const rotate = useCallback(() => {
    if (statusRef.current !== 'running') return;
    const activePiece = pieceRef.current;
    const rotated = rotateMatrix(activePiece.matrix);
    const kick = [0, -1, 1, -2, 2].find(
      (offset) => !collides(boardRef.current, activePiece, offset, 0, rotated)
    );

    if (kick !== undefined) {
      updatePiece({
        ...activePiece,
        x: activePiece.x + kick,
        matrix: rotated,
      });
    }
  }, [updatePiece]);

  const hardDrop = useCallback(() => {
    if (statusRef.current !== 'running') return;
    const activePiece = pieceRef.current;
    const distance = getDropDistance(boardRef.current, activePiece);
    const droppedPiece = { ...activePiece, y: activePiece.y + distance };
    updatePiece(droppedPiece);
    pieceRef.current = droppedPiece;
    addScore(distance * 2);
    lockPiece();
  }, [addScore, lockPiece, updatePiece]);

  const togglePause = useCallback(() => {
    if (statusRef.current === 'over') return;
    setAutoPaused(false);
    updateStatus(statusRef.current === 'running' ? 'paused' : 'running');
    gameRef.current?.focus({ preventScroll: true });
  }, [updateStatus]);

  const restartGame = useCallback(() => {
    const emptyBoard = createBoard();
    bagRef.current = [];
    const firstPiece = nextPiece();

    boardRef.current = emptyBoard;
    pieceRef.current = firstPiece;
    scoreRef.current = 0;
    linesRef.current = 0;
    setBoard(emptyBoard);
    setPiece(firstPiece);
    setScore(0);
    setLines(0);
    setAutoPaused(false);
    updateStatus('running');
    gameRef.current?.focus({ preventScroll: true });
  }, [nextPiece, updateStatus]);

  const runControl = useCallback((action) => {
    action();
    gameRef.current?.focus({ preventScroll: true });
  }, []);

  const handleKeyDown = useCallback((event) => {
    if (event.target !== event.currentTarget) return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (key === 'p' && event.repeat) return;
    const actions = {
      ArrowLeft: () => moveHorizontal(-1),
      ArrowRight: () => moveHorizontal(1),
      ArrowUp: rotate,
      ArrowDown: () => dropOne(true),
      ' ': hardDrop,
      p: togglePause,
    };
    const action = actions[key];
    if (!action) return;
    event.preventDefault();
    action();
  }, [dropOne, hardDrop, moveHorizontal, rotate, togglePause]);

  useEffect(() => {
    gameRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (status !== 'running') return undefined;
    const timer = window.setInterval(() => dropOne(false), dropSpeed(level));
    return () => window.clearInterval(timer);
  }, [dropOne, level, status]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && statusRef.current === 'running') {
        setAutoPaused(true);
        updateStatus('paused');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [updateStatus]);

  const visibleBoard = useMemo(() => mergePiece(board, piece), [board, piece]);
  const statusMessage =
    status === 'over' ? 'Game over' : status === 'paused' ? 'Game paused' : 'Game in progress';

  return (
    <GameShell emoji="🧱" title="Tetris">
      <div
        ref={gameRef}
        className="tetris-game"
        tabIndex="0"
        onKeyDown={handleKeyDown}
        aria-label="Tetris game. Focus here to use keyboard controls."
      >
        <div className="tetris-game__scoreboard" aria-label="Tetris scores">
          <div><span>Score</span><strong>{score}</strong></div>
          <div><span>Lines</span><strong>{lines}</strong></div>
          <div><span>Level</span><strong>{level}</strong></div>
          <div><span>Best</span><strong>{highScore}</strong></div>
        </div>

        <div className="tetris-game__board-shell">
          <div
            className="tetris-game__board"
            role="img"
            aria-label={`10 by 20 Tetris playfield. ${statusMessage}. Score ${score}.`}
          >
            {visibleBoard.flat().map((cell, index) => (
              <span
                key={index}
                className={`tetris-game__cell${cell ? ` tetris-game__cell--${cell.toLowerCase()}` : ''}`}
              />
            ))}

            {status === 'paused' && (
              <div className="tetris-game__overlay" role="status">
                <span className="tetris-game__overlay-icon" aria-hidden="true">Ⅱ</span>
                <strong>Paused</strong>
                <span>{autoPaused ? 'The tab was hidden. Resume when ready.' : 'Press P or Resume to continue.'}</span>
                <button type="button" className="btn bg-gradient-primary" onClick={togglePause}>
                  Resume
                </button>
              </div>
            )}

            {status === 'over' && (
              <div className="tetris-game__overlay" role="dialog" aria-modal="true" aria-labelledby="tetris-over-title">
                <span className="tetris-game__overlay-icon" aria-hidden="true">🧱</span>
                <h2 id="tetris-over-title">Game Over</h2>
                <span>Score {score} · Best {highScore}</span>
                <button type="button" className="btn bg-gradient-primary" onClick={restartGame}>
                  Play Again
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="tetris-game__status" aria-live="polite">{statusMessage}</p>

        <div className="tetris-game__actions">
          <button type="button" className="btn btn-outline-primary" onClick={togglePause} disabled={status === 'over'}>
            {status === 'paused' ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="btn bg-gradient-primary" onClick={restartGame}>
            Restart Game
          </button>
        </div>

        <div className="tetris-game__controls" aria-label="Tetris mobile controls">
          <button type="button" onClick={() => runControl(rotate)} disabled={status !== 'running'} aria-label="Rotate piece">↻</button>
          <button type="button" onClick={() => runControl(() => moveHorizontal(-1))} disabled={status !== 'running'} aria-label="Move left">←</button>
          <button type="button" onClick={() => runControl(() => moveHorizontal(1))} disabled={status !== 'running'} aria-label="Move right">→</button>
          <button type="button" onClick={() => runControl(() => dropOne(true))} disabled={status !== 'running'} aria-label="Soft drop">↓</button>
          <button type="button" onClick={() => runControl(hardDrop)} disabled={status !== 'running'} aria-label="Hard drop">⇊</button>
        </div>

        <p className="tetris-game__hint">
          Focus the game, then use arrows to move and rotate · Space hard drops · P pauses
        </p>
      </div>
    </GameShell>
  );
};

export default TetrisGame;
