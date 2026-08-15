import { Link } from 'react-router-dom';
import {
  FaBrain,
  FaGamepad,
  FaHashtag,
  FaPlay,
  FaShapes,
  FaStaffSnake,
  FaTableCellsLarge,
} from 'react-icons/fa6';
import {
  Game2048Art,
  MemoryArt,
  SnakeArt,
  TetrisArt,
  TicTacToeArt,
} from './GameArt.jsx';
import './GamesHub.css';

const GAMES = [
  {
    to: '/games/snake',
    title: 'Snake',
    description: 'Guide the snake, collect food, and chase your best score.',
    tag: 'Arcade',
    icon: FaStaffSnake,
    art: SnakeArt,
    available: true,
  },
  {
    to: '/games/2048',
    title: '2048',
    description: 'Slide and merge matching tiles to reach 2048.',
    tag: 'Puzzle',
    icon: FaTableCellsLarge,
    art: Game2048Art,
  },
  {
    to: '/games/tetris',
    title: 'Tetris',
    description: 'Stack falling pieces and clear complete lines.',
    tag: 'Arcade',
    icon: FaShapes,
    art: TetrisArt,
  },
  {
    to: '/games/memory',
    title: 'Memory',
    description: 'Turn over cards and find every matching pair.',
    tag: 'Brain teaser',
    icon: FaBrain,
    art: MemoryArt,
  },
  {
    to: '/games/tic-tac-toe',
    title: 'Tic-Tac-Toe',
    description: 'Line up three marks in the classic strategy game.',
    tag: 'Strategy',
    icon: FaHashtag,
    art: TicTacToeArt,
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
      {GAMES.map(({ to, title, description, tag, icon: Icon, art: Art, available }) => (
        <article className={`games-hub__card${available ? ' is-ready' : ''}`} key={to}>
          <Link to={to} className="games-hub__cover" aria-label={`Open ${title}`}>
            <Art />
            <span className="games-hub__cover-veil" aria-hidden="true" />
            <span className={`games-hub__status${available ? ' is-ready' : ''}`}>
              {available ? 'Ready to play' : 'Coming soon'}
            </span>
            <span className="games-hub__play" aria-hidden="true">
              <FaPlay />
            </span>
          </Link>

          <div className="games-hub__body">
            <div className="games-hub__card-heading">
              <span className="games-hub__icon" aria-hidden="true">
                <Icon />
              </span>
              <div>
                <h2>{title}</h2>
                <span className="games-hub__tag">{tag}</span>
              </div>
            </div>
            <p>{description}</p>
            <Link to={to} className="games-hub__action">
              {available ? 'Play now' : 'View game'}
            </Link>
          </div>
        </article>
      ))}
    </div>
  </section>
);

export default GamesHub;
