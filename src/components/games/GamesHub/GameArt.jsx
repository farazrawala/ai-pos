/**
 * Inline SVG cover art for the games hub.
 * Vector art keeps the arcade fully offline-capable — no external image requests.
 */

const artProps = {
  viewBox: '0 0 320 180',
  preserveAspectRatio: 'xMidYMid slice',
  role: 'presentation',
  focusable: 'false',
};

const GridPattern = ({ id, color = 'rgba(255,255,255,0.14)' }) => (
  <pattern id={id} width="20" height="20" patternUnits="userSpaceOnUse">
    <path d="M20 0H0V20" fill="none" stroke={color} strokeWidth="1" />
  </pattern>
);

export const SnakeArt = () => (
  <svg {...artProps}>
    <defs>
      <linearGradient id="snakeBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0f766e" />
        <stop offset="100%" stopColor="#065f46" />
      </linearGradient>
      <GridPattern id="snakeGrid" />
    </defs>
    <rect width="320" height="180" fill="url(#snakeBg)" />
    <rect width="320" height="180" fill="url(#snakeGrid)" />
    {[
      [80, 60],
      [100, 60],
      [120, 60],
      [140, 60],
      [140, 80],
      [140, 100],
      [160, 100],
      [180, 100],
    ].map(([x, y], index) => (
      <rect
        key={`${x}-${y}`}
        x={x}
        y={y}
        width="18"
        height="18"
        rx="5"
        fill="#5eead4"
        opacity={0.55 + index * 0.055}
      />
    ))}
    <rect x="200" y="100" width="18" height="18" rx="5" fill="#a7f3d0" />
    <circle cx="205" cy="106" r="2.4" fill="#065f46" />
    <circle cx="213" cy="106" r="2.4" fill="#065f46" />
    <circle cx="235" cy="65" r="9" fill="#fb7185" />
    <path d="M235 56c2-4 6-5 8-4-1 3-4 5-8 4Z" fill="#4ade80" />
  </svg>
);

export const Game2048Art = () => {
  const tiles = [
    { x: 60, y: 34, label: '2', fill: '#fde68a', text: '#78350f' },
    { x: 124, y: 34, label: '4', fill: '#fcd34d', text: '#78350f' },
    { x: 188, y: 34, label: '8', fill: '#fbbf24', text: '#7c2d12' },
    { x: 60, y: 98, label: '16', fill: '#f59e0b', text: '#fff7ed' },
    { x: 124, y: 98, label: '32', fill: '#ea580c', text: '#fff7ed' },
    { x: 188, y: 98, label: '64', fill: '#c2410c', text: '#fff7ed' },
  ];
  return (
    <svg {...artProps}>
      <defs>
        <linearGradient id="g2048Bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c2d12" />
          <stop offset="100%" stopColor="#431407" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#g2048Bg)" />
      <rect
        x="46"
        y="20"
        width="228"
        height="140"
        rx="14"
        fill="rgba(255,255,255,0.08)"
      />
      {tiles.map((tile) => (
        <g key={tile.label}>
          <rect x={tile.x} y={tile.y} width="52" height="48" rx="9" fill={tile.fill} />
          <text
            x={tile.x + 26}
            y={tile.y + 32}
            textAnchor="middle"
            fontSize="20"
            fontWeight="800"
            fontFamily="system-ui, sans-serif"
            fill={tile.text}
          >
            {tile.label}
          </text>
        </g>
      ))}
    </svg>
  );
};

export const TetrisArt = () => (
  <svg {...artProps}>
    <defs>
      <linearGradient id="tetrisBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#4c1d95" />
        <stop offset="100%" stopColor="#1e1b4b" />
      </linearGradient>
      <GridPattern id="tetrisGrid" color="rgba(255,255,255,0.1)" />
    </defs>
    <rect width="320" height="180" fill="url(#tetrisBg)" />
    <rect width="320" height="180" fill="url(#tetrisGrid)" />
    <g>
      <rect x="100" y="20" width="24" height="24" rx="4" fill="#22d3ee" />
      <rect x="124" y="20" width="24" height="24" rx="4" fill="#22d3ee" />
      <rect x="148" y="20" width="24" height="24" rx="4" fill="#22d3ee" />
      <rect x="172" y="20" width="24" height="24" rx="4" fill="#22d3ee" />
    </g>
    <g>
      <rect x="76" y="72" width="24" height="24" rx="4" fill="#f472b6" />
      <rect x="76" y="96" width="24" height="24" rx="4" fill="#f472b6" />
      <rect x="100" y="96" width="24" height="24" rx="4" fill="#f472b6" />
      <rect x="124" y="96" width="24" height="24" rx="4" fill="#f472b6" />
    </g>
    <g>
      <rect x="172" y="72" width="24" height="24" rx="4" fill="#facc15" />
      <rect x="196" y="72" width="24" height="24" rx="4" fill="#facc15" />
      <rect x="172" y="96" width="24" height="24" rx="4" fill="#facc15" />
      <rect x="196" y="96" width="24" height="24" rx="4" fill="#facc15" />
    </g>
    <g opacity="0.95">
      {[52, 76, 100, 124, 148, 172, 196, 220, 244].map((x) => (
        <rect key={x} x={x} y="132" width="24" height="24" rx="4" fill="#a5b4fc" />
      ))}
    </g>
  </svg>
);

export const MemoryArt = () => (
  <svg {...artProps}>
    <defs>
      <linearGradient id="memoryBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#0369a1" />
        <stop offset="100%" stopColor="#082f49" />
      </linearGradient>
    </defs>
    <rect width="320" height="180" fill="url(#memoryBg)" />
    {[
      { x: 46, y: 30, face: true },
      { x: 118, y: 30, face: false },
      { x: 190, y: 30, face: false },
      { x: 46, y: 100, face: false },
      { x: 118, y: 100, face: true },
      { x: 190, y: 100, face: false },
    ].map((card) => (
      <g key={`${card.x}-${card.y}`}>
        <rect
          x={card.x}
          y={card.y}
          width="60"
          height="52"
          rx="9"
          fill={card.face ? '#e0f2fe' : 'rgba(255,255,255,0.16)'}
          stroke="rgba(255,255,255,0.35)"
        />
        {card.face ? (
          <path
            d={`M${card.x + 30} ${card.y + 40}c-9-6-15-11-15-18a8 8 0 0 1 15-4 8 8 0 0 1 15 4c0 7-6 12-15 18Z`}
            fill="#0ea5e9"
          />
        ) : (
          <text
            x={card.x + 30}
            y={card.y + 34}
            textAnchor="middle"
            fontSize="20"
            fontWeight="800"
            fontFamily="system-ui, sans-serif"
            fill="rgba(255,255,255,0.55)"
          >
            ?
          </text>
        )}
      </g>
    ))}
  </svg>
);

export const TicTacToeArt = () => (
  <svg {...artProps}>
    <defs>
      <linearGradient id="tttBg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#9f1239" />
        <stop offset="100%" stopColor="#4c0519" />
      </linearGradient>
    </defs>
    <rect width="320" height="180" fill="url(#tttBg)" />
    <g stroke="rgba(255,255,255,0.4)" strokeWidth="4" strokeLinecap="round">
      <line x1="138" y1="26" x2="138" y2="154" />
      <line x1="182" y1="26" x2="182" y2="154" />
      <line x1="96" y1="69" x2="224" y2="69" />
      <line x1="96" y1="111" x2="224" y2="111" />
    </g>
    <g stroke="#fda4af" strokeWidth="6" strokeLinecap="round">
      <line x1="107" y1="38" x2="127" y2="58" />
      <line x1="127" y1="38" x2="107" y2="58" />
      <line x1="150" y1="80" x2="170" y2="100" />
      <line x1="170" y1="80" x2="150" y2="100" />
      <line x1="193" y1="122" x2="213" y2="142" />
      <line x1="213" y1="122" x2="193" y2="142" />
    </g>
    <g stroke="#fef3c7" strokeWidth="6" fill="none">
      <circle cx="160" cy="48" r="11" />
      <circle cx="203" cy="90" r="11" />
      <circle cx="117" cy="90" r="11" />
    </g>
  </svg>
);
