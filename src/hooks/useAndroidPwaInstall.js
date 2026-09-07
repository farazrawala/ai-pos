import { useCallback, useEffect, useState } from 'react';
import {
  getDeferredInstallPrompt,
  promptAndroidInstall,
  shouldShowAndroidInstallButton,
  subscribeAndroidInstallPrompt,
} from '../utils/androidPwaInstall.js';

export function useAndroidPwaInstall() {
  const [canInstall, setCanInstall] = useState(() =>
    shouldShowAndroidInstallButton(getDeferredInstallPrompt())
  );
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const sync = (prompt) => setCanInstall(shouldShowAndroidInstallButton(prompt));
    const unsubscribe = subscribeAndroidInstallPrompt(sync);
    const onResize = () => sync(getDeferredInstallPrompt());
    window.addEventListener('resize', onResize);
    return () => {
      unsubscribe();
      window.removeEventListener('resize', onResize);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    setInstalling(true);
    try {
      await promptAndroidInstall();
    } finally {
      setInstalling(false);
      setCanInstall(shouldShowAndroidInstallButton(getDeferredInstallPrompt()));
    }
  }, []);

  return { canInstall, installing, promptInstall };
}
