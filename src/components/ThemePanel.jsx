import { useEffect, useState } from 'react';
import { FaMoon, FaSun, FaXmark } from 'react-icons/fa6';
import NavIcon from './NavIcon.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { CUSTOM_THEME_ID, DEFAULT_CUSTOM_COLOR, normalizeHexColor } from '../config/themes.js';

const ThemePanel = () => {
  const {
    panelOpen,
    closePanel,
    colorId,
    setColorId,
    customColor,
    setCustomColor,
    mode,
    setMode,
    colorThemes,
    colorSaveStatus,
  } = useTheme();
  const [customColorInput, setCustomColorInput] = useState(customColor);

  useEffect(() => {
    setCustomColorInput(customColor);
  }, [customColor]);

  useEffect(() => {
    if (!panelOpen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') closePanel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelOpen, closePanel]);

  if (!panelOpen) return null;

  return (
    <>
      <button
        type="button"
        className="theme-panel-backdrop"
        aria-label="Close theme settings"
        onClick={closePanel}
      />
      <aside className="theme-panel" role="dialog" aria-modal="true" aria-label="Theme settings">
        <div className="theme-panel-header">
          <div>
            <h6 className="mb-0 font-weight-bold">Appearance</h6>
            <p className="text-xs text-secondary mb-0 mt-1">Colors &amp; display mode</p>
          </div>
          <button
            type="button"
            className="btn btn-link text-secondary p-0 mb-0"
            aria-label="Close"
            onClick={closePanel}
          >
            <NavIcon icon={FaXmark} size={18} />
          </button>
        </div>

        <div className="theme-panel-body">
          <p className="theme-panel-section-title">Color theme</p>
          <div className="theme-color-grid" role="listbox" aria-label="Color theme">
            {colorThemes.map((theme) => {
              const active = theme.id === colorId;
              return (
                <button
                  key={theme.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`theme-color-btn${active ? ' is-active' : ''}`}
                  onClick={() => setColorId(theme.id)}
                >
                  <span
                    className="theme-color-swatch"
                    style={{ backgroundColor: theme.swatch || theme.color }}
                    aria-hidden
                  />
                  <span className="theme-color-label">{theme.label}</span>
                </button>
              );
            })}
          </div>

          <div className={`theme-custom-color${colorId === CUSTOM_THEME_ID ? ' is-active' : ''}`}>
            <label htmlFor="theme-custom-color-picker">Custom color</label>
            <div className="theme-custom-color-controls">
              <input
                id="theme-custom-color-picker"
                type="color"
                value={normalizeHexColor(customColor, DEFAULT_CUSTOM_COLOR)}
                onChange={(event) => setCustomColor(event.target.value)}
                aria-label="Choose a custom theme color"
              />
              <input
                type="text"
                value={customColorInput}
                maxLength={7}
                spellCheck="false"
                aria-label="Custom theme color hex value"
                onChange={(event) => {
                  const next = event.target.value;
                  setCustomColorInput(next);
                  const validColor = normalizeHexColor(next);
                  if (validColor) setCustomColor(validColor);
                }}
                onBlur={() =>
                  setCustomColorInput(normalizeHexColor(customColor, DEFAULT_CUSTOM_COLOR))
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            </div>
          </div>

          <p className="theme-panel-section-title mt-4">Display mode</p>
          <div className="theme-mode-row" role="group" aria-label="Display mode">
            <button
              type="button"
              className={`theme-mode-btn${mode === 'light' ? ' is-active' : ''}`}
              onClick={() => setMode('light')}
            >
              <NavIcon icon={FaSun} className="me-1" size={13} />
              Light
            </button>
            <button
              type="button"
              className={`theme-mode-btn${mode === 'dark' ? ' is-active' : ''}`}
              onClick={() => setMode('dark')}
            >
              <NavIcon icon={FaMoon} className="me-1" size={13} />
              Dark
            </button>
          </div>

          <p className="theme-panel-hint">
            {colorSaveStatus === 'saving' || colorSaveStatus === 'pending'
              ? 'Saving color to your company…'
              : colorSaveStatus === 'error'
                ? 'Color applied locally, but could not be saved to your company.'
                : 'Color is saved to your company and applies across the whole app.'}
          </p>
        </div>
      </aside>
    </>
  );
};

export default ThemePanel;
