import {
  ClockFormat,
  DEFAULT_CUSTOM_PRESETS,
  DEFAULT_SETTINGS,
  MonolithRank,
  PomodoroSettings,
  SessionRecord,
  ThemeMode,
  TimerMode,
  XP_INTERVAL_SECONDS,
  XP_PER_INTERVAL,
  XpState,
} from '../types/pomodoro';

export const STORAGE_KEYS = {
  THEME: 'monolith_pomo_theme',
  SETTINGS: 'monolith_pomo_settings',
  SESSIONS: 'monolith_pomo_sessions',
  INITIALIZED: 'monolith_pomo_initialized',
  LOGS_PURGED: 'monolith_pomo_logs_purged_v1',
  CLOCK_FORMAT: 'monolith_pomo_clock_format',
  TIMER_MODE: 'monolith_pomo_timer_mode',
  XP_STATE: 'monolith_pomo_xp_state',
} as const;

const CHANNEL_NAME = 'monolith_pomodoro_sync';

export function broadcastStateChange(): void {
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel(CHANNEL_NAME);
      ch.postMessage({ type: 'SYNC', at: Date.now() });
      ch.close();
    }
  } catch {
    // ignore
  }
}

export function subscribeCrossTabSync(onSync: () => void): () => void {
  const handleStorage = () => onSync();
  window.addEventListener('storage', handleStorage);

  let channel: BroadcastChannel | null = null;
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = () => onSync();
    }
  } catch {
    channel = null;
  }

  return () => {
    window.removeEventListener('storage', handleStorage);
    if (channel) {
      channel.close();
    }
  };
}

export const MONOLITH_RANKS: MonolithRank[] = [
  { name: 'Initiate', tier: 1, minXp: 0, nextXp: 50 },
  { name: 'Craftsman', tier: 2, minXp: 50, nextXp: 150 },
  { name: 'Architect', tier: 3, minXp: 150, nextXp: 350 },
  { name: 'Warden', tier: 4, minXp: 350, nextXp: 700 },
  { name: 'Sovereign', tier: 5, minXp: 700, nextXp: null },
];

export function getMonolithRank(totalXp: number): MonolithRank {
  for (let i = MONOLITH_RANKS.length - 1; i >= 0; i--) {
    if (totalXp >= MONOLITH_RANKS[i].minXp) {
      return MONOLITH_RANKS[i];
    }
  }
  return MONOLITH_RANKS[0];
}

export function computePeakFocusHour(sessions: SessionRecord[]): number | null {
  const focusList = sessions.filter((s) => s.type === 'focus');
  if (focusList.length < 3) return null;
  const hourBuckets = Array.from({ length: 24 }, () => 0);
  focusList.forEach((s) => {
    const hr = new Date(s.completedAt).getHours();
    hourBuckets[hr] += s.durationSeconds / 60;
  });
  let peakHour: number | null = null;
  let maxMin = 0;
  hourBuckets.forEach((mins, hr) => {
    if (mins > maxMin) {
      maxMin = mins;
      peakHour = hr;
    }
  });
  return peakHour;
}

export function isWithinPeakWindow(peakHour: number | null, date = new Date()): boolean {
  if (peakHour === null) return false;
  const hr = date.getHours();
  const diff = Math.abs(hr - peakHour);
  return diff <= 1 || diff >= 23;
}

export function deriveXpFromSessions(sessions: SessionRecord[]): XpState {
  const totalFocusSec = sessions
    .filter((s) => s.type === 'focus')
    .reduce((sum, s) => sum + s.durationSeconds, 0);
  const completedMilestones = Math.floor(totalFocusSec / XP_INTERVAL_SECONDS);
  return {
    totalXp: completedMilestones * XP_PER_INTERVAL,
    carryFocusSeconds: totalFocusSec % XP_INTERVAL_SECONDS,
    shieldedDayKeys: [],
  };
}

export function loadXpState(fallbackSessions: SessionRecord[]): XpState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.XP_STATE);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<XpState>;
      if (typeof parsed.totalXp === 'number' && typeof parsed.carryFocusSeconds === 'number') {
        return {
          totalXp: Math.max(0, parsed.totalXp),
          carryFocusSeconds: Math.max(0, parsed.carryFocusSeconds % XP_INTERVAL_SECONDS),
          shieldedDayKeys: Array.isArray(parsed.shieldedDayKeys) ? parsed.shieldedDayKeys : [],
        };
      }
    }
  } catch {
    // ignore
  }
  const derived = deriveXpFromSessions(fallbackSessions);
  saveXpState(derived);
  return derived;
}

export function saveXpState(xpState: XpState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.XP_STATE, JSON.stringify(xpState));
    broadcastStateChange();
  } catch {
    // ignore
  }
}

export function loadTheme(): ThemeMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // ignore
  }
  return 'light';
}

export function saveTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    broadcastStateChange();
  } catch {
    // ignore
  }
}

export function clampPresenceMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return 30;
  return Math.max(30, Math.min(240, Math.round(minutes)));
}

export function loadSettings(): PomodoroSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PomodoroSettings> & { smoothSweep?: boolean };
      const migratedSweep =
        parsed.sweepMode ??
        (typeof parsed.smoothSweep === 'boolean'
          ? parsed.smoothSweep
            ? 'smooth'
            : 'tick'
          : DEFAULT_SETTINGS.sweepMode);
      const customPresets =
        Array.isArray(parsed.customPresets) && parsed.customPresets.length > 0
          ? parsed.customPresets
          : DEFAULT_CUSTOM_PRESETS;
      const merged = { ...DEFAULT_SETTINGS, ...parsed, sweepMode: migratedSweep, customPresets };
      return {
        ...merged,
        presenceIntervalMinutes: clampPresenceMinutes(merged.presenceIntervalMinutes),
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: PomodoroSettings): void {
  try {
    const sanitized: PomodoroSettings = {
      ...settings,
      presenceIntervalMinutes: clampPresenceMinutes(settings.presenceIntervalMinutes),
    };
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(sanitized));
    broadcastStateChange();
  } catch {
    // ignore
  }
}

export function loadClockFormat(): ClockFormat {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLOCK_FORMAT);
    if (raw === 'digital' || raw === 'analogue' || raw === 'both') return raw;
  } catch {
    // ignore
  }
  return 'both';
}

export function saveClockFormat(format: ClockFormat): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CLOCK_FORMAT, format);
    broadcastStateChange();
  } catch {
    // ignore
  }
}

export function loadTimerMode(): TimerMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TIMER_MODE);
    if (raw === 'countdown' || raw === 'countup') return raw;
  } catch {
    // ignore
  }
  return 'countdown';
}

export function saveTimerMode(mode: TimerMode): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TIMER_MODE, mode);
    broadcastStateChange();
  } catch {
    // ignore
  }
}

export function loadSessions(): SessionRecord[] {
  try {
    const purged = localStorage.getItem(STORAGE_KEYS.LOGS_PURGED);
    if (!purged) {
      localStorage.setItem(STORAGE_KEYS.LOGS_PURGED, 'true');
      localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([]));
      localStorage.setItem(
        STORAGE_KEYS.XP_STATE,
        JSON.stringify({ totalXp: 0, carryFocusSeconds: 0, shieldedDayKeys: [] }),
      );
      return [];
    }
    const raw = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (raw) {
      return JSON.parse(raw) as SessionRecord[];
    }
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify([]));
  } catch {
    // ignore
  }
  return [];
}

export function saveSessions(sessions: SessionRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INITIALIZED, 'true');
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    broadcastStateChange();
  } catch {
    // ignore
  }
}
