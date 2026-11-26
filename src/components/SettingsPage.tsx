import {
  ArrowLeft,
  Download,
  Flame,
  Minus,
  Play,
  Plus,
  RotateCcw,
  Square,
  Volume2,
} from 'lucide-react';
import { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import {
  ADAPTIVE_LADDER_MINUTES,
  AmbientNoiseMode,
  AppView,
  ClockFormat,
  CustomPreset,
  DEFAULT_CUSTOM_PRESETS,
  DEFAULT_SETTINGS,
  MAX_PRESENCE_INTERVAL_MINUTES,
  MIN_PRESENCE_INTERVAL_MINUTES,
  PomodoroSettings,
  SessionRecord,
  SoundProfile,
  SweepMode,
  ThemeMode,
  XP_INTERVAL_SECONDS,
  XpState,
} from '../types/pomodoro';
import { playCompletionChime } from '../utils/sound';
import { getMonolithRank } from '../utils/storage';

interface SettingsPageProps {
  theme: ThemeMode;
  onChangeTheme: (theme: ThemeMode) => void;
  clockFormat: ClockFormat;
  onChangeClockFormat: (format: ClockFormat) => void;
  settings: PomodoroSettings;
  onUpdateSettings: (next: PomodoroSettings) => void;
  sessions: SessionRecord[];
  xpState: XpState;
  onStartIgnition: () => void;
  isAmbientPreviewing: boolean;
  onToggleAmbientPreview: () => void;
  onPreviewXpBurst: () => void;
  onNavigate: (view: AppView) => void;
  onResetAllData: () => void;
}

type SettingsTab = 'all' | 'clock' | 'intervals' | 'habits' | 'sound';

const bwSolidBtn =
  'border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0';

const bwOptionBtn = (active: boolean) =>
  `border-2 border-black dark:border-white transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
    active
      ? 'bg-black text-white dark:bg-white dark:text-black font-bold'
      : 'bg-white text-black dark:bg-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-semibold'
  }`;

export function SettingsPage({
  theme,
  onChangeTheme,
  clockFormat,
  onChangeClockFormat,
  settings,
  onUpdateSettings,
  sessions,
  xpState,
  onStartIgnition,
  isAmbientPreviewing,
  onToggleAmbientPreview,
  onPreviewXpBurst,
  onNavigate,
  onResetAllData,
}: SettingsPageProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('all');
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  const updateField = <K extends keyof PomodoroSettings>(
    key: K,
    value: PomodoroSettings[K],
  ) => {
    onUpdateSettings({
      ...settings,
      [key]: value,
    });
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      theme,
      clockFormat,
      settings,
      sessions,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'monolith-pomodoro-backup.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const ToggleRow = ({
    title,
    desc,
    checked,
    onToggle,
  }: {
    title: string;
    desc: string;
    checked: boolean;
    onToggle: () => void;
  }) => (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-black/60 dark:text-white/60 mt-0.5">{desc}</div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className={`relative w-12 h-6 rounded-full border-2 border-black dark:border-white transition-colors shrink-0 cursor-pointer ${
          checked
            ? 'bg-black dark:bg-white'
            : 'bg-white dark:bg-black'
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full transition-transform ${
            checked
              ? 'translate-x-6 bg-white dark:bg-black'
              : 'translate-x-1 bg-black dark:bg-white'
          }`}
        />
      </button>
    </div>
  );

  const StepperField = ({
    label,
    value,
    min,
    max,
    step = 1,
    unit = 'm',
    onChange,
  }: {
    label: string;
    value: number;
    min: number;
    max: number;
    step?: number;
    unit?: string;
    onChange: (next: number) => void;
  }) => {
    const clamp = (n: number) => Math.max(min, Math.min(max, n));
    return (
      <div className="min-w-0 rounded-xl border border-black/15 dark:border-white/20 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-black/80 dark:text-white/80">{label}</span>
          <span className="font-mono-tabular text-black/55 dark:text-white/55">{unit}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            aria-label={`Decrease ${label}`}
            onClick={() => onChange(clamp(value - step))}
            className={`w-9 h-9 inline-flex items-center justify-center rounded-lg ${bwSolidBtn}`}
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <input
            type="number"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
            className="w-full min-w-0 h-9 px-2 text-center text-sm font-bold font-mono-tabular rounded-lg border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white focus:outline-none"
          />
          <button
            type="button"
            aria-label={`Increase ${label}`}
            onClick={() => onChange(clamp(value + step))}
            className={`w-9 h-9 inline-flex items-center justify-center rounded-lg ${bwSolidBtn}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const showClock = activeTab === 'all' || activeTab === 'clock';
  const showIntervals = activeTab === 'all' || activeTab === 'intervals';
  const showHabits = activeTab === 'all' || activeTab === 'habits';
  const showSound = activeTab === 'all' || activeTab === 'sound';

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-white dark:bg-black text-black dark:text-white transition-colors duration-200">
      {/* Minimal Dedicated Settings Top Bar (Back · Title · Reset) */}
      <header className="border-b border-black/15 dark:border-white/20 pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-bold ${bwSolidBtn}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>

          <h1 className="text-base sm:text-lg font-bold tracking-tight whitespace-nowrap shrink-0">
            Settings
          </h1>

          <button
            type="button"
            onClick={() => onUpdateSettings(DEFAULT_SETTINGS)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold rounded-lg ${bwSolidBtn}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Defaults
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-8 py-6 sm:py-9 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-7">
        {/* Category Switcher Strip (Pure Black & White Contrasting Buttons) */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-black/10 dark:border-white/15">
          <p className="text-xs sm:text-sm text-black/65 dark:text-white/65">
            Changes save instantly and apply to your clock and focus sessions.
          </p>

          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Settings categories">
            {(
              [
                { id: 'all', label: 'All Settings' },
                { id: 'clock', label: 'Clock & Contrast' },
                { id: 'intervals', label: 'Timers & Profiles' },
                { id: 'habits', label: 'Focus Habits' },
                { id: 'sound', label: 'Sound & Data' },
              ] as { id: SettingsTab; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 text-xs rounded-lg ${bwOptionBtn(activeTab === tab.id)}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 01. Clock & Visual Contrast */}
        {showClock && (
          <section className="rounded-2xl border border-black/15 dark:border-white/20 p-5 sm:p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">01. Clock &amp; Visual Contrast</h2>
                <p className="text-xs text-black/60 dark:text-white/60 mt-0.5">
                  High-contrast theme polarity, dial format, sweep cadence, and clock animations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onChangeTheme(theme === 'light' ? 'dark' : 'light')}
                className={`px-3.5 py-2 text-xs font-bold rounded-lg ${bwSolidBtn}`}
              >
                Invert Polarity ({theme === 'light' ? 'Black' : 'Light'})
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="min-w-0 lg:col-span-6 space-y-5">
                <div>
                  <div className="text-xs font-semibold text-black/75 dark:text-white/75 mb-2">
                    Contrast Theme
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onChangeTheme('light')}
                      className={`flex-1 px-3 py-2.5 text-xs rounded-lg ${bwOptionBtn(theme === 'light')}`}
                    >
                      Light Theme
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeTheme('dark')}
                      className={`flex-1 px-3 py-2.5 text-xs rounded-lg ${bwOptionBtn(theme === 'dark')}`}
                    >
                      Black Theme
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-black/75 dark:text-white/75 mb-2">
                    Clock Display Format
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(['digital', 'analogue', 'both'] as ClockFormat[]).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => onChangeClockFormat(fmt)}
                        className={`flex-1 px-3 py-2.5 text-xs rounded-lg capitalize ${bwOptionBtn(
                          clockFormat === fmt,
                        )}`}
                      >
                        {fmt === 'both' ? 'Both' : fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-black/75 dark:text-white/75 mb-2">
                    Escapement Sweep Cadence
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'smooth', label: 'Smooth (60fps)' },
                        { id: 'highbeat', label: 'High-Beat (5Hz)' },
                        { id: 'tick', label: 'Tick (1Hz)' },
                      ] as { id: SweepMode; label: string }[]
                    ).map((mode) => (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => updateField('sweepMode', mode.id)}
                        className={`flex-1 px-3 py-2.5 text-xs rounded-lg ${bwOptionBtn(
                          settings.sweepMode === mode.id,
                        )}`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="min-w-0 lg:col-span-6 lg:border-l lg:border-black/10 lg:dark:border-white/15 lg:pl-6 divide-y divide-black/10 dark:divide-white/10">
                <ToggleRow
                  title="Halfway Polarity Eclipse"
                  desc="Invert the clock's black-and-white polarity after passing 50% focus"
                  checked={settings.eclipseModeEnabled}
                  onToggle={() =>
                    updateField('eclipseModeEnabled', !settings.eclipseModeEnabled)
                  }
                />
                <ToggleRow
                  title="Quarter-Milestone Shockwave Ripples"
                  desc="Pulse a monochrome bezel ring at 25%, 50%, and 75% completion"
                  checked={settings.milestoneRipplesEnabled}
                  onToggle={() =>
                    updateField('milestoneRipplesEnabled', !settings.milestoneRipplesEnabled)
                  }
                />
                <ToggleRow
                  title="Ascending Fluid Micro-Bubbles"
                  desc="Float inverted micro-bubbles inside the fluid wave while running"
                  checked={settings.bubblesEnabled}
                  onToggle={() => updateField('bubblesEnabled', !settings.bubblesEnabled)}
                />
                <ToggleRow
                  title="Zen Auto-Fade Chrome"
                  desc="Dim corner buttons after 4.5s of inactivity while timing"
                  checked={settings.zenFadeEnabled}
                  onToggle={() => updateField('zenFadeEnabled', !settings.zenFadeEnabled)}
                />
                <ToggleRow
                  title="Dial Caption & Percentage"
                  desc="Show phase label, round count, and completion % inside the dial"
                  checked={settings.showDialCaption}
                  onToggle={() => updateField('showDialCaption', !settings.showDialCaption)}
                />
              </div>
            </div>
          </section>
        )}

        {/* 02. Timers, Daily Targets & Custom Profiles */}
        {showIntervals && (
          <section className="rounded-2xl border border-black/15 dark:border-white/20 p-5 sm:p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">02. Timers, Targets &amp; Profiles</h2>
                <p className="text-xs text-black/60 dark:text-white/60 mt-0.5">
                  Dial in focus blocks, breaks, daily goals, and save up to 3 custom profiles.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {[
                  { label: '15 / 3 / 10', f: 15, s: 3, l: 10 },
                  { label: '25 / 5 / 15', f: 25, s: 5, l: 15 },
                  { label: '50 / 10 / 25', f: 50, s: 10, l: 25 },
                  { label: '90 / 20 / 30', f: 90, s: 20, l: 30 },
                ].map((preset) => {
                  const active =
                    settings.focusMinutes === preset.f &&
                    settings.shortBreakMinutes === preset.s &&
                    settings.longBreakMinutes === preset.l;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        onUpdateSettings({
                          ...settings,
                          focusMinutes: preset.f,
                          shortBreakMinutes: preset.s,
                          longBreakMinutes: preset.l,
                        })
                      }
                      className={`px-3 py-1.5 text-xs font-mono-tabular rounded-lg ${bwOptionBtn(
                        active,
                      )}`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              <StepperField
                label="Focus Duration"
                value={settings.focusMinutes}
                min={1}
                max={180}
                step={5}
                unit="min"
                onChange={(v) => updateField('focusMinutes', v)}
              />
              <StepperField
                label="Short Break"
                value={settings.shortBreakMinutes}
                min={1}
                max={60}
                unit="min"
                onChange={(v) => updateField('shortBreakMinutes', v)}
              />
              <StepperField
                label="Long Break"
                value={settings.longBreakMinutes}
                min={1}
                max={90}
                step={5}
                unit="min"
                onChange={(v) => updateField('longBreakMinutes', v)}
              />
              <StepperField
                label="Long Break After"
                value={settings.longBreakInterval}
                min={2}
                max={12}
                unit="rounds"
                onChange={(v) => updateField('longBreakInterval', v)}
              />
              <StepperField
                label="Count-Up Target"
                value={settings.countUpTargetMinutes}
                min={5}
                max={240}
                step={5}
                unit="min"
                onChange={(v) => updateField('countUpTargetMinutes', v)}
              />
              <StepperField
                label="Daily Focus Goal"
                value={settings.dailyGoalMinutes}
                min={15}
                max={720}
                step={15}
                unit="min"
                onChange={(v) => updateField('dailyGoalMinutes', v)}
              />
              <StepperField
                label="Earned Break Ratio"
                value={settings.flowtimeRatio}
                min={2}
                max={15}
                unit="1m / Nm"
                onChange={(v) => updateField('flowtimeRatio', v)}
              />
            </div>

            <div className="pt-5 border-t border-black/10 dark:border-white/15 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Saved Interval Profiles</div>
                  <div className="text-xs text-black/60 dark:text-white/60">
                    Edit any profile name, apply its timings, or overwrite it with your current setup.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateField('customPresets', DEFAULT_CUSTOM_PRESETS)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg ${bwSolidBtn}`}
                >
                  Reset Profiles
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {settings.customPresets.map((preset: CustomPreset) => {
                  const isActive =
                    settings.focusMinutes === preset.focusMinutes &&
                    settings.shortBreakMinutes === preset.shortBreakMinutes &&
                    settings.longBreakMinutes === preset.longBreakMinutes;

                  return (
                    <div
                      key={preset.id}
                      className={`min-w-0 rounded-xl border p-4 space-y-3 ${
                        isActive
                          ? 'border-2 border-black dark:border-white'
                          : 'border-black/15 dark:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          maxLength={22}
                          value={preset.name}
                          aria-label={`Rename preset ${preset.name}`}
                          onChange={(e) => {
                            const nextPresets = settings.customPresets.map((p) =>
                              p.id === preset.id ? { ...p, name: e.target.value } : p,
                            );
                            updateField('customPresets', nextPresets);
                          }}
                          className="w-full min-w-0 text-sm font-semibold bg-transparent border-b border-black/15 dark:border-white/20 focus:border-black dark:focus:border-white focus:outline-none py-0.5"
                        />
                        <span className="text-xs font-bold font-mono-tabular shrink-0">
                          {preset.focusMinutes}/{preset.shortBreakMinutes}/{preset.longBreakMinutes}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateSettings({
                              ...settings,
                              focusMinutes: preset.focusMinutes,
                              shortBreakMinutes: preset.shortBreakMinutes,
                              longBreakMinutes: preset.longBreakMinutes,
                            })
                          }
                          className={`px-3 py-2 text-xs rounded-lg ${bwOptionBtn(isActive)}`}
                        >
                          {isActive ? 'Active' : 'Apply'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const nextPresets = settings.customPresets.map((p) =>
                              p.id === preset.id
                                ? {
                                    ...p,
                                    focusMinutes: settings.focusMinutes,
                                    shortBreakMinutes: settings.shortBreakMinutes,
                                    longBreakMinutes: settings.longBreakMinutes,
                                  }
                                : p,
                            );
                            updateField('customPresets', nextPresets);
                          }}
                          className={`px-3 py-2 text-xs font-bold rounded-lg ${bwSolidBtn}`}
                        >
                          Save Current
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* 03. Focus Habits & XP Mastery */}
        {showHabits && (
          <section className="rounded-2xl border border-black/15 dark:border-white/20 p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-black/10 dark:border-white/15">
              <div>
                <h2 className="text-base font-bold">03. Focus Habits &amp; XP Mastery</h2>
                <p className="text-xs text-black/60 dark:text-white/60 mt-0.5">
                  +5 XP per 30m concentration · +3 XP Zero-Urge bonus · +2 XP Peak Window bonus.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="text-right font-mono-tabular mr-1">
                  <div className="text-sm font-bold">
                    {xpState.totalXp} XP · {getMonolithRank(xpState.totalXp).name}
                  </div>
                  <div className="text-[11px] text-black/60 dark:text-white/60">
                    {Math.floor(xpState.carryFocusSeconds / 60)}/
                    {Math.round(XP_INTERVAL_SECONDS / 60)}m to next +5 XP
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onStartIgnition}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg ${bwSolidBtn}`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Start 5m Ignition</span>
                </button>
                <button
                  type="button"
                  onClick={onPreviewXpBurst}
                  className={`px-3.5 py-2 text-xs font-bold rounded-lg ${bwSolidBtn}`}
                >
                  Preview +5 Bubble
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 divide-y lg:divide-y-0 divide-black/10 dark:divide-white/10">
              <div className="divide-y divide-black/10 dark:divide-white/10">
                <ToggleRow
                  title="Adaptive Warm-Up Ladder"
                  desc={`Scale Countdown blocks progressively (${ADAPTIVE_LADDER_MINUTES.join('m → ')}m)`}
                  checked={settings.adaptiveLadderEnabled}
                  onToggle={() =>
                    updateField('adaptiveLadderEnabled', !settings.adaptiveLadderEnabled)
                  }
                />
                <ToggleRow
                  title="Anti-Burnout Recovery Guard"
                  desc="Suggest a 10m screen-away break after 3 consecutive deep blocks"
                  checked={settings.antiBurnoutEnabled}
                  onToggle={() => updateField('antiBurnoutEnabled', !settings.antiBurnoutEnabled)}
                />
                <ToggleRow
                  title="5-Minute Ignition Start"
                  desc="Show quick 5-minute warm-up action that rolls into full focus"
                  checked={settings.ignitionEnabled}
                  onToggle={() => updateField('ignitionEnabled', !settings.ignitionEnabled)}
                />
                <ToggleRow
                  title="10-Second Grace Pause Buffer"
                  desc="Display a 10s recovery window on pause to preserve deep momentum"
                  checked={settings.gracePauseEnabled}
                  onToggle={() => updateField('gracePauseEnabled', !settings.gracePauseEnabled)}
                />
              </div>

              <div className="divide-y divide-black/10 dark:divide-white/10">
                <ToggleRow
                  title="Guided Break Breathing Pacer"
                  desc="Sync the draining break wave to 4s inhale and 6s exhale breathing"
                  checked={settings.breathingPacerEnabled}
                  onToggle={() =>
                    updateField('breathingPacerEnabled', !settings.breathingPacerEnabled)
                  }
                />
                <ToggleRow
                  title="Micro-Movement Break Prompts"
                  desc="Rotate ergonomic posture and 20-20-20 distant gaze cues every 60s on break"
                  checked={settings.microMovementEnabled}
                  onToggle={() =>
                    updateField('microMovementEnabled', !settings.microMovementEnabled)
                  }
                />
                <ToggleRow
                  title="Ultradian 90-Minute Cycle Tracker"
                  desc="Trace cumulative 90m biological focus on the outer dial arc"
                  checked={settings.ultradianTrackerEnabled}
                  onToggle={() =>
                    updateField('ultradianTrackerEnabled', !settings.ultradianTrackerEnabled)
                  }
                />
                <ToggleRow
                  title="Periodic Presence Check-In"
                  desc={`Require a tap every ${settings.presenceIntervalMinutes}m (min 30m) in Countdown & Count Up`}
                  checked={settings.presenceCheckEnabled}
                  onToggle={() =>
                    updateField('presenceCheckEnabled', !settings.presenceCheckEnabled)
                  }
                />
              </div>
            </div>

            {settings.presenceCheckEnabled && (
              <div className="pt-4 border-t border-black/10 dark:border-white/15 grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
                <div className="md:col-span-5">
                  <StepperField
                    label="Presence Check-In Interval"
                    value={settings.presenceIntervalMinutes}
                    min={MIN_PRESENCE_INTERVAL_MINUTES}
                    max={MAX_PRESENCE_INTERVAL_MINUTES}
                    step={5}
                    unit="min (≥30m)"
                    onChange={(v) => updateField('presenceIntervalMinutes', v)}
                  />
                </div>
                <div className="md:col-span-7 space-y-2">
                  <div className="text-xs font-semibold text-black/75 dark:text-white/75">
                    Quick Verification Intervals
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[30, 45, 60, 90, 120].map((pm) => (
                      <button
                        key={pm}
                        type="button"
                        onClick={() => updateField('presenceIntervalMinutes', pm)}
                        className={`flex-1 min-w-[54px] px-3 py-2 text-xs font-mono-tabular rounded-lg ${bwOptionBtn(
                          settings.presenceIntervalMinutes === pm,
                        )}`}
                      >
                        {pm}m
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* 04. Acoustics, Automation & Session Backup */}
        {showSound && (
          <section className="rounded-2xl border border-black/15 dark:border-white/20 p-5 sm:p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold">04. Acoustics, Automation &amp; Data</h2>
              <p className="text-xs text-black/60 dark:text-white/60 mt-0.5">
                Auto-transitions, chimes, generative soundscapes, and local backup controls.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Automation & Chime Toggles */}
              <div className="min-w-0 lg:col-span-6 divide-y divide-black/10 dark:divide-white/10">
                <ToggleRow
                  title="Auto-start Breaks"
                  desc="Begin break immediately when a focus session finishes"
                  checked={settings.autoStartBreaks}
                  onToggle={() => updateField('autoStartBreaks', !settings.autoStartBreaks)}
                />
                <ToggleRow
                  title="Auto-start Next Focus"
                  desc="Begin the next focus block automatically after a break"
                  checked={settings.autoStartFocus}
                  onToggle={() => updateField('autoStartFocus', !settings.autoStartFocus)}
                />
                <ToggleRow
                  title="Keep Screen Awake"
                  desc="Prevent display sleep during active sessions via Wake Lock API"
                  checked={settings.wakeLockEnabled}
                  onToggle={() => updateField('wakeLockEnabled', !settings.wakeLockEnabled)}
                />
                <ToggleRow
                  title="Completion Chime"
                  desc="Play harmonic chime when any interval completes"
                  checked={settings.soundEnabled}
                  onToggle={() => updateField('soundEnabled', !settings.soundEnabled)}
                />
                <ToggleRow
                  title="Milestone & Rising Chime Sequencer"
                  desc="Play subtle quarter chimes (25/50/75%) and ascend chime pitch across rounds"
                  checked={settings.chimeSequencerEnabled}
                  onToggle={() =>
                    updateField('chimeSequencerEnabled', !settings.chimeSequencerEnabled)
                  }
                />
                <ToggleRow
                  title="Mechanical Second Tick"
                  desc="Play a crisp watchmaker tick on each elapsed second"
                  checked={settings.tickSoundEnabled}
                  onToggle={() => updateField('tickSoundEnabled', !settings.tickSoundEnabled)}
                />
              </div>

              {/* Right Column: Sound Controls & Data Actions */}
              <div className="min-w-0 lg:col-span-6 lg:border-l lg:border-black/10 lg:dark:border-white/15 lg:pl-6 space-y-5">
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-black/75 dark:text-white/75">
                      Chime Tone Profile
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        playCompletionChime('focus', settings.soundProfile, settings.soundVolume)
                      }
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg ${bwSolidBtn}`}
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      Test Chime
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { id: 'bell', label: 'Bell' },
                        { id: 'pulse', label: 'Pulse' },
                        { id: 'double', label: 'Double' },
                      ] as { id: SoundProfile; label: string }[]
                    ).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          updateField('soundProfile', p.id);
                          playCompletionChime('focus', p.id, settings.soundVolume);
                        }}
                        className={`flex-1 px-3 py-2 text-xs rounded-lg ${bwOptionBtn(
                          settings.soundProfile === p.id,
                        )}`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="font-semibold text-black/75 dark:text-white/75">
                      Chime Volume
                    </span>
                    <span className="font-mono-tabular font-bold">{settings.soundVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={settings.soundVolume}
                    onChange={(e) => updateField('soundVolume', Number(e.target.value))}
                    className="w-full accent-black dark:accent-white cursor-pointer"
                  />
                </div>

                <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <span className="text-xs font-semibold text-black/75 dark:text-white/75">
                        Background Nature &amp; Soft Music Soundscape
                      </span>
                      <button
                        type="button"
                        disabled={settings.ambientNoise === 'off'}
                        onClick={onToggleAmbientPreview}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed ${bwSolidBtn}`}
                      >
                        {isAmbientPreviewing ? (
                          <>
                            <Square className="w-3 h-3" />
                            <span>Stop Preview</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            <span>Preview Soundscape</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { id: 'rainBirds', label: 'Rain & Birds Music' },
                          { id: 'rain', label: 'Soft Rain' },
                          { id: 'brown', label: 'Brown Noise' },
                          { id: 'gamma40', label: '40Hz Gamma' },
                          { id: 'off', label: 'Off' },
                        ] as { id: AmbientNoiseMode; label: string }[]
                      ).map((amb) => (
                        <button
                          key={amb.id}
                          type="button"
                          onClick={() => updateField('ambientNoise', amb.id)}
                          className={`flex-auto px-3 py-2 text-xs rounded-lg ${bwOptionBtn(
                            settings.ambientNoise === amb.id,
                          )}`}
                        >
                          {amb.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-2">
                      <span className="font-semibold text-black/75 dark:text-white/75">
                        Background Soundscape Volume
                      </span>
                      <span className="font-mono-tabular font-bold">{settings.ambientVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={settings.ambientVolume}
                      onChange={(e) => updateField('ambientVolume', Number(e.target.value))}
                      className="w-full accent-black dark:accent-white cursor-pointer"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-black/10 dark:border-white/10 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold">Local Session Data</span>
                    <span className="text-xs font-mono-tabular text-black/60 dark:text-white/60">
                      {sessions.length} sessions stored
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!isInstalled && (isInstallable || isIOS) && (
                      <button
                        type="button"
                        onClick={() => {
                          if (isInstallable) {
                            void install();
                          } else {
                            setShowIOSGuide(true);
                          }
                        }}
                        className={`flex-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg ${bwSolidBtn}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>{isIOS ? 'Install on Home Screen' : 'Install Android App'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleExportJson}
                      className={`flex-auto px-3 py-2 text-xs font-bold rounded-lg ${bwSolidBtn}`}
                    >
                      Export JSON
                    </button>
                    <button
                      type="button"
                      onClick={onResetAllData}
                      className={`flex-auto px-3 py-2 text-xs font-bold rounded-lg ${bwSolidBtn}`}
                    >
                      Clear History
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white p-6 space-y-4">
            <h3 className="text-base font-bold">Install Portrait Fullscreen App</h3>
            <p className="text-xs text-black/75 dark:text-white/80 leading-relaxed">
              1. Tap the <strong>Share</strong> button in your mobile browser bar.
              <br />
              2. Tap <strong>Add to Home Screen</strong> to launch fullscreen with no bar.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className={`w-full py-2.5 text-xs font-bold rounded-xl ${bwSolidBtn}`}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
