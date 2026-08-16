/** App-wide color themes + light/dark mode. */

export const THEME_STORAGE_KEY = 'app-theme';
export const CUSTOM_THEME_ID = 'custom';
export const DEFAULT_CUSTOM_COLOR = '#5e72e4';

export const COLOR_THEMES = [
  {
    id: 'default',
    label: 'Default',
    color: '#5e72e4',
    rgb: '94, 114, 228',
    gradientEnd: '#825ee4',
    headerColor: '#344767',
    headerGradientEnd: '#344767',
    sidenavColor: 'primary',
    swatch: '#344767',
  },
  {
    id: 'primary',
    label: 'Indigo',
    color: '#5e72e4',
    rgb: '94, 114, 228',
    gradientEnd: '#825ee4',
  },
  {
    id: 'violet',
    label: 'Violet',
    color: '#7c3aed',
    rgb: '124, 58, 237',
    gradientEnd: '#a78bfa',
  },
  {
    id: 'grape',
    label: 'Grape',
    color: '#6d28d9',
    rgb: '109, 40, 217',
    gradientEnd: '#c084fc',
  },
  {
    id: 'fuchsia',
    label: 'Fuchsia',
    color: '#d946ef',
    rgb: '217, 70, 239',
    gradientEnd: '#f0abfc',
  },
  {
    id: 'rose',
    label: 'Rose',
    color: '#f5365c',
    rgb: '245, 54, 92',
    gradientEnd: '#f56036',
  },
  {
    id: 'crimson',
    label: 'Crimson',
    color: '#dc2626',
    rgb: '220, 38, 38',
    gradientEnd: '#f87171',
  },
  {
    id: 'orange',
    label: 'Orange',
    color: '#fb6340',
    rgb: '251, 99, 64',
    gradientEnd: '#fbb140',
  },
  {
    id: 'amber',
    label: 'Amber',
    color: '#f59e0b',
    rgb: '245, 158, 11',
    gradientEnd: '#fbbf24',
  },
  {
    id: 'lime',
    label: 'Lime',
    color: '#84cc16',
    rgb: '132, 204, 22',
    gradientEnd: '#bef264',
  },
  {
    id: 'green',
    label: 'Green',
    color: '#2dce89',
    rgb: '45, 206, 137',
    gradientEnd: '#2dcecc',
  },
  {
    id: 'forest',
    label: 'Forest',
    color: '#15803d',
    rgb: '21, 128, 61',
    gradientEnd: '#4ade80',
  },
  {
    id: 'teal',
    label: 'Teal',
    color: '#14b8a6',
    rgb: '20, 184, 166',
    gradientEnd: '#5eead4',
  },
  {
    id: 'cyan',
    label: 'Cyan',
    color: '#11cdef',
    rgb: '17, 205, 239',
    gradientEnd: '#1171ef',
  },
  {
    id: 'sky',
    label: 'Sky',
    color: '#0ea5e9',
    rgb: '14, 165, 233',
    gradientEnd: '#7dd3fc',
  },
  {
    id: 'navy',
    label: 'Navy',
    color: '#344767',
    rgb: '52, 71, 103',
    gradientEnd: '#212229',
  },
  {
    id: 'slate',
    label: 'Slate',
    color: '#475569',
    rgb: '71, 85, 105',
    gradientEnd: '#94a3b8',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    color: '#1e3a5f',
    rgb: '30, 58, 95',
    gradientEnd: '#3b82f6',
  },
];

/** Map legacy theme ids (from older builds) to current ids. */
const LEGACY_THEME_IDS = {
  success: 'green',
  info: 'cyan',
  warning: 'orange',
  danger: 'rose',
  dark: 'navy',
};

export const DEFAULT_THEME = {
  colorId: 'default',
  mode: 'light',
  customColor: DEFAULT_CUSTOM_COLOR,
};

export function normalizeHexColor(value, fallback = '') {
  const raw = String(value || '').trim();
  const expanded =
    /^#[0-9a-f]{3}$/i.test(raw) ?
      `#${raw
        .slice(1)
        .split('')
        .map((char) => char + char)
        .join('')}`
    : raw;
  return /^#[0-9a-f]{6}$/i.test(expanded) ? expanded.toLowerCase() : fallback;
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex, DEFAULT_CUSTOM_COLOR);
  return [1, 3, 5].map((offset) => parseInt(normalized.slice(offset, offset + 2), 16));
}

function mixWithWhite(rgb, amount = 0.28) {
  return rgb.map((channel) => Math.round(channel + (255 - channel) * amount));
}

function rgbToHex(rgb) {
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export function getColorTheme(colorId, customColor = DEFAULT_CUSTOM_COLOR) {
  if (colorId === CUSTOM_THEME_ID) {
    const color = normalizeHexColor(customColor, DEFAULT_CUSTOM_COLOR);
    const rgb = hexToRgb(color);
    return {
      id: CUSTOM_THEME_ID,
      label: 'Custom',
      color,
      rgb: rgb.join(', '),
      gradientEnd: rgbToHex(mixWithWhite(rgb)),
      headerColor: color,
      swatch: color,
    };
  }
  const resolved = LEGACY_THEME_IDS[colorId] || colorId;
  return COLOR_THEMES.find((t) => t.id === resolved) || COLOR_THEMES[0];
}

export function readStoredTheme() {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME };
    const parsed = JSON.parse(raw);
    const customColor = normalizeHexColor(parsed?.customColor, DEFAULT_CUSTOM_COLOR);
    const theme = getColorTheme(parsed?.colorId, customColor);
    const mode = parsed?.mode === 'dark' ? 'dark' : 'light';
    return { colorId: theme.id, mode, customColor };
  } catch {
    return { ...DEFAULT_THEME };
  }
}

export function applyThemeToDom({ colorId, mode, customColor }) {
  const normalizedCustomColor = normalizeHexColor(customColor, DEFAULT_CUSTOM_COLOR);
  const theme = getColorTheme(colorId, normalizedCustomColor);
  const root = document.documentElement;
  const headerColor = theme.headerColor || theme.color;
  const headerGradientEnd = theme.headerGradientEnd || theme.gradientEnd;
  // Keep a known Argon data-color so active text/icon rules apply; paint uses --app-theme.
  const sidenavColor = theme.sidenavColor || 'primary';

  root.style.setProperty('--app-theme', theme.color);
  root.style.setProperty('--app-theme-rgb', theme.rgb);
  root.style.setProperty('--app-theme-gradient-end', theme.gradientEnd);
  root.style.setProperty('--app-header', headerColor);
  root.style.setProperty('--app-header-gradient-end', headerGradientEnd);
  root.setAttribute('data-theme-color', theme.id);

  const isDark = mode === 'dark';
  root.classList.toggle('dark', isDark);
  document.body.classList.toggle('dark-version', isDark);

  const sidenav = document.querySelector('.sidenav');
  if (sidenav) {
    sidenav.setAttribute('data-color', sidenavColor);
  }

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute('content', headerColor);
  }

  try {
    localStorage.setItem(
      THEME_STORAGE_KEY,
      JSON.stringify({ colorId: theme.id, mode, customColor: normalizedCustomColor })
    );
  } catch {
    /* ignore quota / private mode */
  }
}
