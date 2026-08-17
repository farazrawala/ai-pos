import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  applyThemeToDom,
  COLOR_THEMES,
  CUSTOM_THEME_ID,
  DEFAULT_THEME,
  getColorTheme,
  normalizeHexColor,
  readStoredTheme,
} from '../config/themes.js';
import { getCompanyFromApiBody, patchCompanyThemeColor } from '../features/company/companyAPI.js';
import { selectCompany, selectCompanyId, setCompany } from '../features/user/userSlice.js';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const dispatch = useDispatch();
  const company = useSelector(selectCompany);
  const companyId = useSelector(selectCompanyId);
  const [storedTheme] = useState(() => readStoredTheme());
  const [colorId, setColorIdState] = useState(storedTheme.colorId);
  const [customColor, setCustomColorState] = useState(storedTheme.customColor);
  const [mode, setModeState] = useState(storedTheme.mode);
  const [panelOpen, setPanelOpen] = useState(false);
  const [colorSaveStatus, setColorSaveStatus] = useState('idle');
  const colorChangedByUserRef = useRef(false);

  useLayoutEffect(() => {
    applyThemeToDom({ colorId, mode, customColor });
  }, [colorId, mode, customColor]);

  useEffect(() => {
    const syncSidenav = () => applyThemeToDom({ colorId, mode, customColor });
    // Sidebar mounts after auth layout; re-apply data-color when DOM settles.
    const id = window.setTimeout(syncSidenav, 0);
    return () => window.clearTimeout(id);
  }, [colorId, mode, customColor]);

  useEffect(() => {
    if (colorChangedByUserRef.current) return;
    const companyColor = normalizeHexColor(company?.theme_color);
    if (!companyColor) return;

    const preset = COLOR_THEMES.find((theme) => normalizeHexColor(theme.color) === companyColor);
    if (preset) {
      setColorIdState(preset.id);
    } else {
      setCustomColorState(companyColor);
      setColorIdState(CUSTOM_THEME_ID);
    }
    setColorSaveStatus('saved');
  }, [company?.theme_color]);

  useEffect(() => {
    if (!colorChangedByUserRef.current || !companyId) return undefined;

    const resolvedColor = normalizeHexColor(getColorTheme(colorId, customColor).color);
    const savedColor = normalizeHexColor(company?.theme_color);
    if (!resolvedColor) return undefined;
    if (resolvedColor === savedColor) {
      colorChangedByUserRef.current = false;
      setColorSaveStatus('saved');
      return undefined;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setColorSaveStatus('saving');
      patchCompanyThemeColor(companyId, resolvedColor)
        .then((body) => {
          if (cancelled) return;
          const updatedCompany = getCompanyFromApiBody(body);
          dispatch(
            setCompany({
              ...(company || {}),
              ...(updatedCompany && typeof updatedCompany === 'object' ? updatedCompany : {}),
              theme_color: resolvedColor,
            })
          );
          colorChangedByUserRef.current = false;
          setColorSaveStatus('saved');
        })
        .catch(() => {
          if (!cancelled) setColorSaveStatus('error');
        });
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [colorId, customColor, companyId, company, dispatch]);

  const setColorId = useCallback((next) => {
    colorChangedByUserRef.current = true;
    setColorSaveStatus('pending');
    setColorIdState(next);
  }, []);

  const setCustomColor = useCallback((next) => {
    colorChangedByUserRef.current = true;
    setColorSaveStatus('pending');
    setCustomColorState(next);
    setColorIdState(CUSTOM_THEME_ID);
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
      colorSaveStatus,
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
      colorSaveStatus,
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
  return (
    useContext(ThemeContext) || {
      colorId: DEFAULT_THEME.colorId,
      customColor: DEFAULT_THEME.customColor,
      mode: DEFAULT_THEME.mode,
      isDark: false,
      colorThemes: COLOR_THEMES,
      colorSaveStatus: 'idle',
      setColorId: () => {},
      setCustomColor: () => {},
      setMode: () => {},
      toggleMode: () => {},
      panelOpen: false,
      openPanel: () => {},
      closePanel: () => {},
      togglePanel: () => {},
    }
  );
}
