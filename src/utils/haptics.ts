export type HapticKind = 'light' | 'medium' | 'confirm' | 'complete';

const HAPTIC_PATTERNS: Record<HapticKind, number | number[]> = {
  light: 12,
  medium: 24,
  confirm: [18, 45, 28],
  complete: [28, 60, 42],
};

export function triggerHaptic(kind: HapticKind, enabled = true): void {
  if (!enabled) return;
  try {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(HAPTIC_PATTERNS[kind]);
    }
  } catch {
    // ignore unsupported environments
  }
}
