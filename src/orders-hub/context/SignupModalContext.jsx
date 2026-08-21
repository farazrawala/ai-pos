import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const SignupModalContext = createContext(null);

export function SignupModalProvider({ children }) {
  const [open, setOpen] = useState(false);

  const openSignup = useCallback(() => setOpen(true), []);
  const closeSignup = useCallback(() => setOpen(false), []);

  const value = useMemo(
    () => ({ open, openSignup, closeSignup }),
    [open, openSignup, closeSignup]
  );

  return <SignupModalContext.Provider value={value}>{children}</SignupModalContext.Provider>;
}

export function useSignupModal() {
  const ctx = useContext(SignupModalContext);
  if (!ctx) {
    throw new Error('useSignupModal must be used within SignupModalProvider');
  }
  return ctx;
}
