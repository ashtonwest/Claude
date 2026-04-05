import { useEffect, useRef, useState, useCallback } from 'react';
import { timing } from '../constants/theme';

interface UseAutoHideReturn {
  visible: boolean;
  onInteraction: () => void;
}

export function useAutoHide(timeout: number = timing.overlayAutoHide): UseAutoHideReturn {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setVisible(false);
    }, timeout);
  }, [timeout]);

  const onInteraction = useCallback(() => {
    setVisible(true);
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    resetTimer();
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [resetTimer]);

  return { visible, onInteraction };
}
