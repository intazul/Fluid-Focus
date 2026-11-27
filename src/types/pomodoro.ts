export type ThemeMode = 'light' | 'dark';

export type TimerMode = 'countdown' | 'countup';

export type PhaseType = 'focus' | 'shortBreak' | 'longBreak';

export type ClockFormat = 'digital' | 'analogue' | 'both';

export type SoundProfile = 'bell' | 'pulse' | 'double';

export type SweepMode = 'smooth' | 'highbeat' | 'tick';

export type AmbientNoiseMode =
  | 'off'
  | 'rainBirds'
  | 'rain'
  | 'brown'
  | 'gamma40'
  | 'clockTick';

export type AppView = 'dashboard' | 'analytics' | 'settings' | 'edit';

export type DepthRating = 1 | 2 | 3;

export interface CustomPreset {
  id: string;
  name: string;
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
}

export interface UrgeBuckets {
  early: number; // 0-10m startup resistance
  mid: number; // 10-20m mid-block drift
  late: number; // 20m+ late fatigue
}

export interface MonolithRank {
  name: string;
  tier: number;
  minXp: number;
  nextXp: number | null;
}

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  countUpTargetMinutes: number;
  dailyGoalMinutes: number;
  flowtimeRatio: number; // 1 min earned break per N min focused
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  soundEnabled: boolean;
  soundVolume: number; // 0 to 100
  soundProfile: SoundProfile;
  tickSoundEnabled: boolean;
  chimeSequencerEnabled: boolean;
  ambientNoise: AmbientNoiseMode;
  ambientVolume: number; // 0 to 100
  notificationsEnabled: boolean;
  wakeLockEnabled: boolean;
  sweepMode: SweepMode;
  bubblesEnabled: boolean;
  zenFadeEnabled: boolean;
  showDialCaption: boolean;
  breathingPacerEnabled: boolean;
  microMovementEnabled: boolean;
  ultradianTrackerEnabled: boolean;
  ignitionEnabled: boolean;
  gracePauseEnabled: boolean;
  adaptiveLadderEnabled: boolean;
  antiBurnoutEnabled: boolean;
  eclipseModeEnabled: boolean;
  milestoneRipplesEnabled: boolean;
  presenceCheckEnabled: boolean;
  presenceIntervalMinutes: number; // >= 30 minutes
  hapticsEnabled: boolean;
  oledFocusModeEnabled: boolean;
  customPresets: CustomPreset[];
}

export interface PresenceCheckStats {
  confirmed: number;
  missed: number;
}

export interface SessionRecord {
  id: string;
  type: 'focus' | 'break';
  mode: TimerMode;
  source?: 'timer' | 'manual';
  durationSeconds: number;
  completedAt: string;
  distractions?: number;
  urgeBuckets?: UrgeBuckets;
  depthRating?: DepthRating;
  xpEarned?: number;
  presenceChecks?: PresenceCheckStats;
}

export interface XpState {
  totalXp: number;
  /** Accumulated deep concentration seconds toward the next 30-min (+5 XP) milestone */
  carryFocusSeconds: number;
  /** Day keys (YYYY-MM-DD) protected by a 50 XP Streak Freeze Shield */
  shieldedDayKeys: string[];
}

export const XP_INTERVAL_SECONDS = 30 * 60; // 30 minutes
export const XP_PER_INTERVAL = 5;
export const XP_ZERO_URGE_BONUS = 3;
export const XP_PEAK_WINDOW_BONUS = 2;
export const STREAK_SHIELD_COST_XP = 50;
export const ULTRADIAN_CYCLE_SECONDS = 90 * 60; // 90 minutes
export const MIN_PRESENCE_INTERVAL_MINUTES = 30;
export const MAX_PRESENCE_INTERVAL_MINUTES = 240;
export const PRESENCE_RESPONSE_WINDOW_SECONDS = 120;

export const ADAPTIVE_LADDER_MINUTES = [15, 25, 35, 45] as const;

export const DEFAULT_CUSTOM_PRESETS: CustomPreset[] = [
  {
    id: 'preset-sprint',
    name: 'Code Sprint',
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
  },
  {
    id: 'preset-writing',
    name: 'Deep Writing',
    focusMinutes: 50,
    shortBreakMinutes: 10,
    longBreakMinutes: 25,
  },
  {
    id: 'preset-study',
    name: 'Study Block',
    focusMinutes: 40,
    shortBreakMinutes: 8,
    longBreakMinutes: 20,
  },
];

export const DEFAULT_SETTINGS: PomodoroSettings = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  countUpTargetMinutes: 50,
  dailyGoalMinutes: 150,
  flowtimeRatio: 5,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundEnabled: true,
  soundVolume: 70,
  soundProfile: 'bell',
  tickSoundEnabled: false,
  chimeSequencerEnabled: true,
  ambientNoise: 'rainBirds',
  ambientVolume: 40,
  notificationsEnabled: false,
  wakeLockEnabled: true,
  sweepMode: 'smooth',
  bubblesEnabled: true,
  zenFadeEnabled: true,
  showDialCaption: true,
  breathingPacerEnabled: true,
  microMovementEnabled: true,
  gracePauseEnabled: true,
  ultradianTrackerEnabled: true,
  ignitionEnabled: true,
  adaptiveLadderEnabled: false,
  antiBurnoutEnabled: true,
  eclipseModeEnabled: false,
  milestoneRipplesEnabled: true,
  presenceCheckEnabled: true,
  presenceIntervalMinutes: 30,
  hapticsEnabled: true,
  oledFocusModeEnabled: false,
  customPresets: DEFAULT_CUSTOM_PRESETS,
};
