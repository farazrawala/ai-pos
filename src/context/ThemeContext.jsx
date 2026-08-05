import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {
  applyThemeToDom,
  COLOR_THEMES,
  DEFAULT_THEME,
  readStoredTheme,
} from '../config/themes.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [colorId, setColorIdState] = useState(() => readStoredTheme().colorId);
  const [mode, setModeState] = useState(() => readStoredTheme().mode);
  const [panelOpen, setPanelOpen] = useState(false);

  useLayoutEffect(() => {
    applyThemeToDom({ colorId, mode });
  }, [colorId, mode]);

  useEffect(() => {
    const syncSidenav = () => applyThemeToDom({ colorId, mode });
    // Sidebar mounts after auth layout; re-apply data-color when DOM settles.
    const id = window.setTimeout(syncSidenav, 0);
    return () => window.clearTimeout(id);
  }, [colorId, mode]);

  const setColorId = useCallback((next) => {
    setColorIdState(next);
  }, []);

  const setMode = useCallback((next) => {
    setModeState(next === 'dark' ? 'dark' : 'light');
  }, []);

  const toggleMode = useCallback(() => {
    setModeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const openPanel = useCallback(() => setPanelOpen(true), []);
  const closePanel = useCallback(() => setPanelOpen(false), []);
  const togglePanel = useCallback(() => setPanelOpen((v) => !v), []);

  const value = useMemo(
    () => ({
      colorId,
      mode,
      isDark: mode === 'dark',
      colorThemes: COLOR_THEMES,
      setColorId,
      setMode,
      toggleMode,
      panelOpen,
      openPanel,
      closePanel,
      togglePanel,
    }),
    [colorId, mode, setColorId, setMode, toggleMode, panelOpen, openPanel, closePanel, togglePanel]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

/** Safe for components that may render outside ThemeProvider (returns defaults). */
export function useThemeOptional() {
  return useContext(ThemeContext) || {
    colorId: DEFAULT_THEME.colorId,
    mode: DEFAULT_THEME.mode,
    isDark: false,
    colorThemes: COLOR_THEMES,
    setColorId: () => {},
    setMode: () => {},
    toggleMode: () => {},
    panelOpen: false,
    openPanel: () => {},
    closePanel: () => {},
    togglePanel: () => {},
  };
}
