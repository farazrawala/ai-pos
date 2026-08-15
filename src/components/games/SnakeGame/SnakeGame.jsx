import { useCallback, useEffect, useRef, useState } from 'react';
import { useTheme } from '../../../context/ThemeContext.jsx';
import './SnakeGame.css';

const BOARD_SIZE = 20;
const SCORE_PER_FOOD = 10;
const HIGH_SCORE_KEY = 'pos_snake_high_score';
const BASE_SPEED_MS = 170;
const MIN_SPEED_MS = 70;

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const KEY_DIRECTIONS = {
  ArrowUp: DIRECTIONS.up,
  w: DIRECTIONS.up,
  ArrowDown: DIRECTIONS.down,
  s: DIRECTIONS.down,
  ArrowLeft: DIRECTIONS.left,
  a: DIRECTIONS.left,
  ArrowRight: DIRECTIONS.right,
  d: DIRECTIONS.right,
};

function createInitialSnake() {
  const center = Math.floor(BOARD_SIZE / 2);
  return [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
    { x: center - 3, y: center },
  ];
}

function sameCell(first, second) {
  return first.x === second.x && first.y === second.y;
}

function createFood(snake) {
  const openCells = [];

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!snake.some((segment) => segment.x === x && segment.y === y)) {
        openCells.push({ x, y });
      }
    }
  }

  return openCells.length
    ? openCells[Math.floor(Math.random() * openCells.length)]
    : null;
}

function readHighScore() {
  try {
    const storedScore = Number.parseInt(localStorage.getItem(HIGH_SCORE_KEY) || '0', 10);
    return Number.isFinite(storedScore) && storedScore > 0 ? storedScore : 0;
  } catch {
    return 0;
  }
}

function storeHighScore(score) {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(score));
  } catch {
    // The game still works when storage is unavailable (for example, private mode).
  }
}

function getSpeed(score) {
  const foodEaten = score / SCORE_PER_FOOD;
  return Math.max(MIN_SPEED_MS, BASE_SPEED_MS - foodEaten * 6);
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

function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.roundRect(x, y, width, height, safeRadius);
  context.fill();
}

const SnakeGame = () => {
  const { isDark, colorId } = useTheme();
  const initialSnakeRef = useRef(createInitialSnake());
  const [snake, setSnake] = useState(initialSnakeRef.current);
  const [food, setFood] = useState(() => createFood(initialSnakeRef.current));
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(readHighScore);
  const [status, setStatus] = useState('running');
  const [boardSize, setBoardSize] = useState(0);

  const gameRef = useRef(null);
  const canvasRef = useRef(null);
  const snakeRef = useRef(snake);
  const foodRef = useRef(food);
  const scoreRef = useRef(score);
  const statusRef = useRef(status);
  const directionRef = useRef(DIRECTIONS.right);
  const nextDirectionRef = useRef(DIRECTIONS.right);
  const autoPausedRef = useRef(false);

  const updateStatus = useCallback((nextStatus) => {
    statusRef.current = nextStatus;
    setStatus(nextStatus);
  }, []);

  const queueDirection = useCallback((nextDirection) => {
    if (statusRef.current === 'over') return;

    const current = directionRef.current;
    const isReverse =
      current.x + nextDirection.x === 0 && current.y + nextDirection.y === 0;

    if (!isReverse && nextDirectionRef.current === current) {
      nextDirectionRef.current = nextDirection;
    }
  }, []);

  const restartGame = useCallback(() => {
    const nextSnake = createInitialSnake();
    const nextFood = createFood(nextSnake);

    snakeRef.current = nextSnake;
    foodRef.current = nextFood;
    scoreRef.current = 0;
    directionRef.current = DIRECTIONS.right;
    nextDirectionRef.current = DIRECTIONS.right;
    autoPausedRef.current = false;

    setSnake(nextSnake);
    setFood(nextFood);
    setScore(0);
    updateStatus('running');
    gameRef.current?.focus({ preventScroll: true });
  }, [updateStatus]);

  const togglePause = useCallback(() => {
    if (statusRef.current === 'over') return;
    autoPausedRef.current = false;
    updateStatus(statusRef.current === 'running' ? 'paused' : 'running');
    gameRef.current?.focus({ preventScroll: true });
  }, [updateStatus]);

  const endGame = useCallback(() => {
    autoPausedRef.current = false;
    updateStatus('over');
  }, [updateStatus]);

  const advanceGame = useCallback(() => {
    const currentSnake = snakeRef.current;
    const nextDirection = nextDirectionRef.current;
    directionRef.current = nextDirection;

    const currentHead = currentSnake[0];
    const nextHead = {
      x: currentHead.x + nextDirection.x,
      y: currentHead.y + nextDirection.y,
    };
    const ateFood = foodRef.current && sameCell(nextHead, foodRef.current);
    const collisionBody = ateFood ? currentSnake : currentSnake.slice(0, -1);
    const hitWall =
      nextHead.x < 0 ||
      nextHead.x >= BOARD_SIZE ||
      nextHead.y < 0 ||
      nextHead.y >= BOARD_SIZE;
    const hitSelf = collisionBody.some((segment) => sameCell(segment, nextHead));

    if (hitWall || hitSelf) {
      endGame();
      return;
    }

    const nextSnake = ateFood
      ? [nextHead, ...currentSnake]
      : [nextHead, ...currentSnake.slice(0, -1)];

    snakeRef.current = nextSnake;
    setSnake(nextSnake);

    if (ateFood) {
      const nextScore = scoreRef.current + SCORE_PER_FOOD;
      const nextFood = createFood(nextSnake);

      scoreRef.current = nextScore;
      foodRef.current = nextFood;
      setScore(nextScore);
      setFood(nextFood);
      setHighScore((currentBest) => {
        const nextBest = Math.max(currentBest, nextScore);
        if (nextBest !== currentBest) storeHighScore(nextBest);
        return nextBest;
      });

      if (!nextFood) endGame();
    }
  }, [endGame]);

  useEffect(() => {
    gameRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (isEditableTarget(event.target)) return;

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const nextDirection = KEY_DIRECTIONS[key];
      if (!nextDirection) return;

      event.preventDefault();
      queueDirection(nextDirection);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [queueDirection]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && statusRef.current === 'running') {
        autoPausedRef.current = true;
        updateStatus('paused');
      } else if (
        !document.hidden &&
        autoPausedRef.current &&
        statusRef.current === 'paused'
      ) {
        autoPausedRef.current = false;
        updateStatus('running');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [updateStatus]);

  useEffect(() => {
    if (status !== 'running') return undefined;
    const timer = window.setInterval(advanceGame, getSpeed(score));
    return () => window.clearInterval(timer);
  }, [advanceGame, score, status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const observer = new ResizeObserver(([entry]) => {
      setBoardSize(Math.round(entry.contentRect.width));
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || boardSize <= 0) return;

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const pixels = Math.round(boardSize * pixelRatio);
    if (canvas.width !== pixels || canvas.height !== pixels) {
      canvas.width = pixels;
      canvas.height = pixels;
    }

    const context = canvas.getContext('2d');
    const cellSize = pixels / BOARD_SIZE;
    const rootStyles = getComputedStyle(document.documentElement);
    const themeColor = rootStyles.getPropertyValue('--app-theme').trim() || '#5e72e4';

    context.clearRect(0, 0, pixels, pixels);
    context.fillStyle = isDark ? '#111827' : '#f8fafc';
    context.fillRect(0, 0, pixels, pixels);

    context.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.09)' : 'rgba(100, 116, 139, 0.09)';
    context.lineWidth = Math.max(1, pixelRatio * 0.5);
    for (let index = 1; index < BOARD_SIZE; index += 1) {
      const position = index * cellSize;
      context.beginPath();
      context.moveTo(position, 0);
      context.lineTo(position, pixels);
      context.moveTo(0, position);
      context.lineTo(pixels, position);
      context.stroke();
    }

    snake.forEach((segment, index) => {
      const inset = cellSize * 0.1;
      context.fillStyle = index === 0 ? themeColor : '#2dce89';
      roundedRect(
        context,
        segment.x * cellSize + inset,
        segment.y * cellSize + inset,
        cellSize - inset * 2,
        cellSize - inset * 2,
        cellSize * 0.24
      );
    });

    const head = snake[0];
    if (head) {
      const direction = directionRef.current;
      const eyeOffsetX = direction.x === 0 ? cellSize * 0.19 : direction.x * cellSize * 0.17;
      const eyeOffsetY = direction.y === 0 ? cellSize * 0.19 : direction.y * cellSize * 0.17;
      const centerX = (head.x + 0.5) * cellSize;
      const centerY = (head.y + 0.5) * cellSize;
      const radius = Math.max(1.25 * pixelRatio, cellSize * 0.055);

      context.fillStyle = '#fff';
      [-1, 1].forEach((side) => {
        context.beginPath();
        context.arc(
          centerX + eyeOffsetX + (direction.y !== 0 ? side * cellSize * 0.16 : 0),
          centerY + eyeOffsetY + (direction.x !== 0 ? side * cellSize * 0.16 : 0),
          radius,
          0,
          Math.PI * 2
        );
        context.fill();
      });
    }

    if (food) {
      const centerX = (food.x + 0.5) * cellSize;
      const centerY = (food.y + 0.55) * cellSize;
      context.fillStyle = '#f5365c';
      context.beginPath();
      context.arc(centerX, centerY, cellSize * 0.3, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#2dce89';
      context.beginPath();
      context.ellipse(
        centerX + cellSize * 0.1,
        centerY - cellSize * 0.34,
        cellSize * 0.13,
        cellSize * 0.07,
        -0.55,
        0,
        Math.PI * 2
      );
      context.fill();
    }
  }, [boardSize, colorId, food, isDark, snake]);

  const statusMessage =
    status === 'over' ? 'Game over' : status === 'paused' ? 'Game paused' : 'Game in progress';

  return (
    <section
      ref={gameRef}
      className="snake-game"
      tabIndex="-1"
      aria-label="Snake game"
    >
      <header className="snake-game__header">
        <div>
          <span className="snake-game__eyebrow">Offline arcade</span>
          <h1 className="snake-game__title">
            <span aria-hidden="true">🐍</span> Snake
          </h1>
        </div>
        <span className="snake-game__offline-badge">
          <span aria-hidden="true">●</span> Offline ready
        </span>
      </header>

      <div className="snake-game__scoreboard" aria-label="Game scores">
        <div className="snake-game__score">
          <span>Score</span>
          <strong>{score}</strong>
        </div>
        <div className="snake-game__score">
          <span>Best</span>
          <strong>{highScore}</strong>
        </div>
      </div>

      <div className="snake-game__board-shell">
        <div className="snake-game__board">
          <canvas
            ref={canvasRef}
            className="snake-game__canvas"
            role="img"
            aria-label={`Snake board. Score ${score}. ${statusMessage}.`}
          />

          {status === 'paused' && (
            <div className="snake-game__overlay snake-game__overlay--paused" role="status">
              <span className="snake-game__overlay-icon" aria-hidden="true">Ⅱ</span>
              <strong>Paused</strong>
              <span>Press Resume when you are ready</span>
            </div>
          )}

          {status === 'over' && (
            <div className="snake-game__overlay" role="dialog" aria-modal="true" aria-labelledby="snake-game-over-title">
              <span className="snake-game__overlay-icon" aria-hidden="true">🐍</span>
              <h2 id="snake-game-over-title">Game Over</h2>
              <div className="snake-game__overlay-scores">
                <span>Score <strong>{score}</strong></span>
                <span>Best <strong>{highScore}</strong></span>
              </div>
              <button type="button" className="btn bg-gradient-primary" onClick={restartGame}>
                Play Again
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="snake-game__status sr-only" aria-live="polite">{statusMessage}</p>

      <div className="snake-game__actions">
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={togglePause}
          disabled={status === 'over'}
          aria-label={status === 'paused' ? 'Resume snake game' : 'Pause snake game'}
        >
          {status === 'paused' ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          className="btn bg-gradient-primary"
          onClick={restartGame}
          aria-label="Restart snake game"
        >
          Restart Game
        </button>
      </div>

      <div className="snake-game__controls" aria-label="Snake direction controls">
        <button
          type="button"
          className="snake-game__control snake-game__control--up"
          onClick={() => queueDirection(DIRECTIONS.up)}
          aria-label="Move up"
        >
          ↑
        </button>
        <button
          type="button"
          className="snake-game__control snake-game__control--left"
          onClick={() => queueDirection(DIRECTIONS.left)}
          aria-label="Move left"
        >
          ←
        </button>
        <button
          type="button"
          className="snake-game__control snake-game__control--down"
          onClick={() => queueDirection(DIRECTIONS.down)}
          aria-label="Move down"
        >
          ↓
        </button>
        <button
          type="button"
          className="snake-game__control snake-game__control--right"
          onClick={() => queueDirection(DIRECTIONS.right)}
          aria-label="Move right"
        >
          →
        </button>
      </div>

      <p className="snake-game__hint">
        Use arrow keys or W A S D <span aria-hidden="true">•</span> Speed increases as you score
      </p>
    </section>
  );
};

export default SnakeGame;
