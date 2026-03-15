import { useState, useEffect, useRef, useCallback } from 'react';

export function useTimer(limitMinutes = 45) {
  const [elapsed, setElapsed] = useState(0); // seconds
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef(null);

  const limitSeconds = limitMinutes * 60;

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setElapsed(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning]);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const reset = useCallback(() => { setElapsed(0); setIsRunning(false); }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const remaining = Math.max(0, limitSeconds - elapsed);
  const remainingMinutes = Math.floor(remaining / 60);
  const remainingSeconds = remaining % 60;

  const isOvertime = elapsed > limitSeconds;
  const isWarning = !isOvertime && remaining < 5 * 60; // last 5 minutes
  const progress = Math.min(100, (elapsed / limitSeconds) * 100);

  const status = isOvertime ? 'overtime' : isWarning ? 'warning' : 'normal';

  const formatTime = (min, sec) =>
    `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;

  return {
    elapsed,
    minutes,
    seconds,
    remaining,
    remainingMinutes,
    remainingSeconds,
    isRunning,
    isOvertime,
    isWarning,
    status,
    progress,
    start,
    pause,
    reset,
    display: formatTime(minutes, seconds),
    remainingDisplay: formatTime(remainingMinutes, remainingSeconds),
  };
}
