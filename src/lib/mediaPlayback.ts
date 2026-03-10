let current: HTMLMediaElement | null = null;

export function registerPlaying(el: HTMLMediaElement) {
  if (current && current !== el) {
    current.pause();
  }
  current = el;
}

export function unregisterPlaying(el: HTMLMediaElement) {
  if (current === el) {
    current = null;
  }
}

export function getCurrent(): HTMLMediaElement | null {
  return current;
}
