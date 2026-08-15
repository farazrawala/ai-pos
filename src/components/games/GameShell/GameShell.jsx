import { Link } from 'react-router-dom';
import { FaArrowLeft } from 'react-icons/fa6';
import './GameShell.css';

const GameShell = ({ emoji, title, eyebrow = 'Offline arcade', children }) => (
  <section className="game-shell">
    <header className="game-shell__header">
      <div>
        <span className="game-shell__eyebrow">{eyebrow}</span>
        <h1 className="game-shell__title">
          {emoji && <span aria-hidden="true">{emoji}</span>} {title}
        </h1>
      </div>
      <span className="game-shell__offline-badge">
        <span aria-hidden="true">●</span> Offline ready
      </span>
    </header>

    {children}

    <footer className="game-shell__footer">
      <Link to="/games" className="btn btn-outline-primary game-shell__back-link">
        <FaArrowLeft aria-hidden="true" /> Back to Games
      </Link>
    </footer>
  </section>
);

export default GameShell;
