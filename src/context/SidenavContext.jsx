import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
} from 'react';

const XL_BREAKPOINT = 1200;

const SidenavContext = createContext(null);

export function isDesktopViewport() {
  return typeof window !== 'undefined' && window.innerWidth >= XL_BREAKPOINT;
}

function getInitialState() {
  const isDesktop = isDesktopViewport();
  return {
    pinned: isDesktop,
    hidden: false,
  };
}

function sidenavReducer(state, action) {
  switch (action.type) {
    case 'toggle': {
      if (isDesktopViewport()) {
        if (state.hidden) {
          return { pinned: true, hidden: false };
        }
        return { pinned: false, hidden: true };
      }
      return { pinned: !state.pinned, hidden: false };
    }
    case 'close': {
      if (isDesktopViewport()) {
        return { pinned: false, hidden: true };
      }
      return { pinned: false, hidden: false };
    }
    case 'openMobile':
      return { pinned: true, hidden: false };
    case 'syncDesktop':
      return { pinned: true, hidden: false };
    case 'syncMobile':
      return { pinned: false, hidden: false };
    default:
      return state;
  }
}

function buildLayoutClassName({ pinned, hidden }) {
  return ['g-sidenav-show', 'bg-gray-100', pinned && 'g-sidenav-pinned', hidden && 'g-sidenav-hidden']
    .filter(Boolean)
    .join(' ');
}

function syncBodyClasses({ pinned, hidden }) {
  const body = document.body;
  body.classList.add('g-sidenav-show');
  body.classList.toggle('g-sidenav-pinned', pinned);
  body.classList.toggle('g-sidenav-hidden', hidden);
  body.classList.toggle('g-sidenav-mobile-open', pinned && !isDesktopViewport());
}

export function SidenavProvider({ children }) {
  const [state, dispatch] = useReducer(sidenavReducer, undefined, getInitialState);
  const { pinned, hidden } = state;
  const mobileMenuOpen = pinned && !isDesktopViewport();

  const layoutClassName = useMemo(
    () => buildLayoutClassName({ pinned, hidden }),
    [pinned, hidden]
  );

  useLayoutEffect(() => {
    syncBodyClasses({ pinned, hidden });
    return () => {
      document.body.classList.remove(
        'g-sidenav-show',
        'g-sidenav-pinned',
        'g-sidenav-hidden',
        'g-sidenav-mobile-open'
      );
    };
  }, [pinned, hidden]);

  useLayoutEffect(() => {
    if (!isDesktopViewport()) {
      dispatch({ type: 'syncMobile' });
    }
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (isDesktopViewport()) {
        dispatch({ type: 'syncDesktop' });
      } else {
        dispatch({ type: 'syncMobile' });
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  const toggle = useCallback(() => {
    dispatch({ type: 'toggle' });
  }, []);

  const close = useCallback(() => {
    dispatch({ type: 'close' });
  }, []);

  const value = useMemo(
    () => ({ toggle, close, pinned, hidden, mobileMenuOpen, layoutClassName }),
    [toggle, close, pinned, hidden, mobileMenuOpen, layoutClassName]
  );

  return <SidenavContext.Provider value={value}>{children}</SidenavContext.Provider>;
}

export function useSidenav() {
  const ctx = useContext(SidenavContext);
  if (!ctx) {
    throw new Error('useSidenav must be used within SidenavProvider');
  }
  return ctx;
}
