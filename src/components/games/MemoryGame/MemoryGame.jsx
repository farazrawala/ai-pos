import { useCallback, useEffect, useRef, useState } from 'react';
import GameShell from '../GameShell/index.js';
import {
  MEMORY_DIFFICULTIES,
  createMemoryDeck,
  isMatchingPair,
  markPairMatched,
} from './memoryLogic.js';
import './MemoryGame.css';

const MISMATCH_DELAY_MS = 850;
const BEST_KEY_PREFIX = 'pos_memory_best_';

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function readBest(difficulty) {
  try {
    const parsed = JSON.parse(localStorage.getItem(`${BEST_KEY_PREFIX}${difficulty}`));
    return Number.isFinite(parsed?.moves) && Number.isFinite(parsed?.time) ? parsed : null;
  } catch {
    return null;
  }
}

function isBetterResult(result, currentBest) {
  return (
    !currentBest ||
    result.moves < currentBest.moves ||
    (result.moves === currentBest.moves && result.time < currentBest.time)
  );
}

function storeBest(difficulty, result) {
  try {
    localStorage.setItem(`${BEST_KEY_PREFIX}${difficulty}`, JSON.stringify(result));
  } catch {
    // Storage can be unavailable; gameplay remains fully functional.
  }
}

const MemoryGame = () => {
  const [difficulty, setDifficulty] = useState('easy');
  const [cards, setCards] = useState(() => createMemoryDeck('easy'));
  const [selectedIds, setSelectedIds] = useState([]);
  const [moves, setMoves] = useState(0);
  const [matches, setMatches] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [best, setBest] = useState(() => readBest('easy'));

  const mismatchTimerRef = useRef(null);
  const selectedIdsRef = useRef([]);
  const lockedRef = useRef(false);

  const clearMismatchTimer = useCallback(() => {
    if (mismatchTimerRef.current !== null) {
      window.clearTimeout(mismatchTimerRef.current);
      mismatchTimerRef.current = null;
    }
  }, []);

  const startNewGame = useCallback(
    (nextDifficulty = difficulty) => {
      clearMismatchTimer();
      selectedIdsRef.current = [];
      lockedRef.current = false;
      setDifficulty(nextDifficulty);
      setCards(createMemoryDeck(nextDifficulty));
      setSelectedIds([]);
      setMoves(0);
      setMatches(0);
      setElapsed(0);
      setStarted(false);
      setCompleted(false);
      setBest(readBest(nextDifficulty));
    },
    [clearMismatchTimer, difficulty]
  );

  useEffect(
    () => () => {
      clearMismatchTimer();
    },
    [clearMismatchTimer]
  );

  useEffect(() => {
    if (!started || completed) return undefined;
    const timer = window.setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => window.clearInterval(timer);
  }, [completed, started]);

  useEffect(() => {
    if (!completed) return;
    const result = { moves, time: elapsed };

    setBest((currentBest) => {
      if (!isBetterResult(result, currentBest)) return currentBest;
      storeBest(difficulty, result);
      return result;
    });
  }, [completed, difficulty, elapsed, moves]);

  const handleCardClick = (card) => {
    if (
      lockedRef.current ||
      completed ||
      card.matched ||
      selectedIdsRef.current.includes(card.id)
    ) {
      return;
    }

    setStarted(true);
    const firstId = selectedIdsRef.current[0];

    if (!firstId) {
      selectedIdsRef.current = [card.id];
      setSelectedIds([card.id]);
      return;
    }

    const nextSelected = [firstId, card.id];
    const firstCard = cards.find((candidate) => candidate.id === firstId);
    selectedIdsRef.current = nextSelected;
    lockedRef.current = true;
    setSelectedIds(nextSelected);
    setMoves((current) => current + 1);

    if (isMatchingPair(firstCard, card)) {
      const nextMatches = matches + 1;
      setCards((currentCards) => markPairMatched(currentCards, firstId, card.id));
      setMatches(nextMatches);
      selectedIdsRef.current = [];
      setSelectedIds([]);
      lockedRef.current = false;

      if (nextMatches === MEMORY_DIFFICULTIES[difficulty].pairs) {
        setCompleted(true);
      }
      return;
    }

    mismatchTimerRef.current = window.setTimeout(() => {
      selectedIdsRef.current = [];
      lockedRef.current = false;
      mismatchTimerRef.current = null;
      setSelectedIds([]);
    }, MISMATCH_DELAY_MS);
  };

  const config = MEMORY_DIFFICULTIES[difficulty];
  const bestLabel = best ? `${best.moves} moves · ${formatTime(best.time)}` : '—';

  return (
    <GameShell emoji="🧠" title="Memory">
      <div className="memory-game">
        <div className="memory-game__toolbar">
          <div className="memory-game__difficulty" aria-label="Choose difficulty">
            {Object.entries(MEMORY_DIFFICULTIES).map(([key, option]) => (
              <button
                key={key}
                type="button"
                className={difficulty === key ? 'is-active' : ''}
                onClick={() => startNewGame(key)}
                aria-pressed={difficulty === key}
              >
                {option.label}
                <small>
                  {option.rows}×{option.columns}
                </small>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn bg-gradient-primary memory-game__new-button"
            onClick={() => startNewGame()}
          >
            New Game
          </button>
        </div>

        <div className="memory-game__scoreboard" aria-label="Memory game statistics">
          <div>
            <span>Moves</span>
            <strong>{moves}</strong>
          </div>
          <div>
            <span>Matches</span>
            <strong>
              {matches}/{config.pairs}
            </strong>
          </div>
          <div>
            <span>Time</span>
            <strong>{formatTime(elapsed)}</strong>
          </div>
        </div>

        <p className="memory-game__best">
          Best {config.label}: <strong>{bestLabel}</strong>
        </p>

        <div className="memory-game__board-shell">
          <div
            className={`memory-game__board memory-game__board--${difficulty}`}
            style={{ '--memory-columns': config.columns }}
            aria-label={`${config.label} memory board`}
          >
            {cards.map((card, index) => {
              const isFlipped = card.matched || selectedIds.includes(card.id);
              return (
                <button
                  key={card.id}
                  type="button"
                  className={`memory-card${isFlipped ? ' is-flipped' : ''}${
                    card.matched ? ' is-matched' : ''
                  }`}
                  onClick={() => handleCardClick(card)}
                  disabled={card.matched}
                  aria-label={
                    isFlipped ? `${card.emoji}, card ${index + 1}` : `Hidden card ${index + 1}`
                  }
                  aria-pressed={isFlipped}
                >
                  <span className="memory-card__inner">
                    <span className="memory-card__face memory-card__back" aria-hidden="true">
                      <span>?</span>
                    </span>
                    <span className="memory-card__face memory-card__front" aria-hidden="true">
                      {card.emoji}
                    </span>
                  </span>
                </button>
              );
            })}

            {completed && (
              <div
                className="memory-game__completion"
                role="dialog"
                aria-modal="true"
                aria-labelledby="memory-complete-title"
              >
                <span className="memory-game__completion-icon" aria-hidden="true">
                  🎉
                </span>
                <h2 id="memory-complete-title">Board Complete!</h2>
                <p>
                  You found all {config.pairs} pairs in <strong>{moves} moves</strong> and{' '}
                  <strong>{formatTime(elapsed)}</strong>.
                </p>
                <button
                  type="button"
                  className="btn bg-gradient-primary"
                  onClick={() => startNewGame()}
                >
                  Play Again
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="memory-game__hint" aria-live="polite">
          {completed
            ? `Completed in ${moves} moves and ${formatTime(elapsed)}`
            : 'Flip two cards at a time and find every matching pair.'}
        </p>
      </div>
    </GameShell>
  );
};

export default MemoryGame;
