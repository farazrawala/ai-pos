import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useReducer,
} from 'react';

const XL_BREAKPOINT = 1200;

const SidenavContext = createContext(null);

function getInitialState() {
  if (typeof window === 'undefined') {
    return { pinned: true, hidden: false };
  }
  return {
    pinned: window.innerWidth >= XL_BREAKPOINT,
    hidden: false,
  };
}

function sidenavReducer(state, action) {
  switch (action.type) {
    case 'toggle': {
      const isDesktop = window.innerWidth >= XL_BREAKPOINT;
      if (isDesktop) {
        if (state.hidden) {
          return { pinned: true, hidden: false };
        }
        return { pinned: false, hidden: true };
      }
      return { pinned: !state.pinned, hidden: false };
    }
    case 'close': {
      const isDesktop = window.innerWidth >= XL_BREAKPOINT;
      if (isDesktop) {
        return { pinned: false, hidden: true };
      }
      return { pinned: false, hidden: false };
    }
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
}

export function SidenavProvider({ children }) {
  const [state, dispatch] = useReducer(sidenavReducer, undefined, getInitialState);
  const { pinned, hidden } = state;

  const layoutClassName = useMemo(
    () => buildLayoutClassName({ pinned, hidden }),
    [pinned, hidden]
  );

  useLayoutEffect(() => {
    syncBodyClasses({ pinned, hidden });
    return () => {
      document.body.classList.remove('g-sidenav-show', 'g-sidenav-pinned', 'g-sidenav-hidden');
    };
  }, [pinned, hidden]);

  const toggle = useCallback(() => {
    dispatch({ type: 'toggle' });
  }, []);

  const close = useCallback(() => {
    dispatch({ type: 'close' });
  }, []);

  const value = useMemo(
    () => ({ toggle, close, pinned, hidden, layoutClassName }),
    [toggle, close, pinned, hidden, layoutClassName]
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
