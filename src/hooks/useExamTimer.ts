import { useState, useEffect, useRef, useCallback } from 'react';

interface UseExamTimerOptions {
  initialMinutes?: number;
  autoStart?: boolean;
  onExpire?: () => void;
}

export function useExamTimer({ initialMinutes = 60, autoStart = true, onExpire }: UseExamTimerOptions = {}) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(initialMinutes * 60);
  const [isRunning, setIsRunning] = useState<boolean>(autoStart);
  const [isFinished, setIsFinished] = useState<boolean>(false);
  
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const startTimer = useCallback(() => {
    setSecondsRemaining(initialMinutes * 60);
    setIsRunning(true);
    setIsFinished(false);
  }, [initialMinutes]);

  const stopTimer = useCallback(() => {
    setIsRunning(false);
  }, []);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsRunning(false);
          setIsFinished(true);
          if (onExpireRef.current) {
            onExpireRef.current();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const timeUsedSeconds = initialMinutes * 60 - secondsRemaining;

  return {
    secondsRemaining,
    timeUsedSeconds,
    isRunning,
    isFinished,
    startTimer,
    stopTimer
  };
}
