import { useState } from 'react';
import { useEffect } from 'react';
import type { AppStateStatus } from 'react-native';
import { AppState } from 'react-native';

export const useIsForeground = (): boolean => {
  const [isForeground, setIsForeground] = useState(true);

  useEffect(() => {
    const onChange = (state: AppStateStatus): void => {
      setIsForeground(state === 'active');
    };
    const myEventListener = AppState.addEventListener('change', onChange);
    return () => myEventListener.remove();
  }, [setIsForeground]);

  return isForeground;
};