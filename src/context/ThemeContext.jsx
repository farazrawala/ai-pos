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
  const [storedTheme] = useState(() => readStoredTheme());
  const [colorId, setColorIdState] = useState(storedTheme.colorId);
  const [customColor, setCustomColorState] = useState(storedTheme.customColor);
  const [mode, setModeState] = useState(storedTheme.mode);
  const [panelOpen, setPanelOpen] = useState(false);

  useLayoutEffect(() => {
    applyThemeToDom({ colorId, mode, customColor });
  }, [colorId, mode, customColor]);

  useEffect(() => {
    const syncSidenav = () => applyThemeToDom({ colorId, mode, customColor });
    // Sidebar mounts after auth layout; re-apply data-color when DOM settles.
    const id = window.setTimeout(syncSidenav, 0);
    return () => window.clearTimeout(id);
  }, [colorId, mode, customColor]);

  const setColorId = useCallback((next) => {
    setColorIdState(next);
  }, []);

  const setCustomColor = useCallback((next) => {
    setCustomColorState(next);
    setColorIdState('custom');
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
      customColor,
      mode,
      isDark: mode === 'dark',
      colorThemes: COLOR_THEMES,
      setColorId,
      setCustomColor,
      setMode,
      toggleMode,
      panelOpen,
      openPanel,
      closePanel,
      togglePanel,
    }),
    [
      colorId,
      customColor,
      mode,
      setColorId,
      setCustomColor,
      setMode,
      toggleMode,
      panelOpen,
      openPanel,
      closePanel,
      togglePanel,
    ]
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
    customColor: DEFAULT_THEME.customColor,
    mode: DEFAULT_THEME.mode,
    isDark: false,
    colorThemes: COLOR_THEMES,
    setColorId: () => {},
    setCustomColor: () => {},
    setMode: () => {},
    toggleMode: () => {},
    panelOpen: false,
    openPanel: () => {},
    closePanel: () => {},
    togglePanel: () => {},
  };
}
