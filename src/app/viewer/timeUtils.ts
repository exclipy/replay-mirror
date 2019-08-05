export function delayToTimeMs(delayMs: number, now: Date, timeStarted: Date): number {
  return now.getTime() - timeStarted.getTime() - delayMs;
}

export function timeToDelayMs(timeMs: number, now: Date, timeStarted: Date): number {
  return now.getTime() - timeStarted.getTime() - timeMs;
}
