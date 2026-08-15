import { Link } from 'react-router-dom';
import {
  FaBrain,
  FaGamepad,
  FaHashtag,
  FaShapes,
  FaStaffSnake,
  FaTableCellsLarge,
} from 'react-icons/fa6';
import './GamesHub.css';

const GAMES = [
  {
    to: '/games/snake',
    title: 'Snake',
    description: 'Guide the snake, collect food, and chase your best score.',
    icon: FaStaffSnake,
    available: true,
  },
  {
    to: '/games/2048',
    title: '2048',
    description: 'Slide and merge matching tiles to reach 2048.',
    icon: FaTableCellsLarge,
  },
  {
    to: '/games/tetris',
    title: 'Tetris',
    description: 'Stack falling pieces and clear complete lines.',
    icon: FaShapes,
  },
  {
    to: '/games/memory',
    title: 'Memory',
    description: 'Turn over cards and find every matching pair.',
    icon: FaBrain,
  },
  {
    to: '/games/tic-tac-toe',
    title: 'Tic-Tac-Toe',
    description: 'Line up three marks in the classic strategy game.',
    icon: FaHashtag,
  },
];

const GamesHub = () => (
  <section className="games-hub">
    <header className="games-hub__header">
      <div>
        <span className="games-hub__eyebrow">Offline arcade</span>
        <h1 className="games-hub__title">
          <FaGamepad aria-hidden="true" /> Games
        </h1>
        <p>Take a quick break with games that work entirely offline.</p>
      </div>
      <span className="games-hub__offline-badge">
        <span aria-hidden="true">●</span> Offline ready
      </span>
    </header>

    <div className="games-hub__grid">
      {GAMES.map(({ to, title, description, icon: Icon, available }) => (
        <article className="games-hub__card" key={to}>
          <div className="games-hub__icon" aria-hidden="true">
            <Icon />
          </div>
          <div className="games-hub__card-copy">
            <div className="games-hub__card-heading">
              <h2>{title}</h2>
              <span className={available ? 'games-hub__status is-ready' : 'games-hub__status'}>
                {available ? 'Ready' : 'Coming soon'}
              </span>
            </div>
            <p>{description}</p>
          </div>
          <Link to={to} className="btn bg-gradient-primary">
            {available ? 'Play now' : 'View game'}
          </Link>
        </article>
      ))}
    </div>
  </section>
);

export default GamesHub;
