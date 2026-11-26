import { ArrowLeft, Check, Minus, Plus, RotateCcw, ShieldCheck } from 'lucide-react';
import {
  MAX_PRESENCE_INTERVAL_MINUTES,
  MIN_PRESENCE_INTERVAL_MINUTES,
  PhaseType,
  PomodoroSettings,
  TimerMode,
} from '../types/pomodoro';

interface EditPageProps {
  timerMode: TimerMode;
  phase: PhaseType;
  settings: PomodoroSettings;
  onSwitchMode: (mode: TimerMode) => void;
  onSelectCountdownPhase: (phase: PhaseType) => void;
  onUpdatePhaseMinutes: (phase: PhaseType, minutes: number) => void;
  onUpdateSettings: (next: PomodoroSettings) => void;
  onResetCountdownDefaults: () => void;
  onResetCountUpDefaults: () => void;
  onBack: () => void;
}

const bwSolidBtn =
  'border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0';

const bwOptionBtn = (active: boolean) =>
  `border-2 border-black dark:border-white transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
    active
      ? 'bg-black text-white dark:bg-white dark:text-black font-bold'
      : 'bg-white text-black dark:bg-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-semibold'
  }`;

export function EditPage({
  timerMode,
  phase,
  settings,
  onSwitchMode,
  onSelectCountdownPhase,
  onUpdatePhaseMinutes,
  onUpdateSettings,
  onResetCountdownDefaults,
  onResetCountUpDefaults,
  onBack,
}: EditPageProps) {
  const countdownRows = [
    {
      id: 'focus' as PhaseType,
      label: 'Focus Session',
      desc: 'Deep uninterrupted work block',
      minutes: settings.focusMinutes,
      step: 5,
      max: 180,
      presets: [15, 25, 45, 60],
    },
    {
      id: 'shortBreak' as PhaseType,
      label: 'Short Break',
      desc: 'Brief screen-free reset between rounds',
      minutes: settings.shortBreakMinutes,
      step: 1,
      max: 60,
      presets: [3, 5, 10, 15],
    },
    {
      id: 'longBreak' as PhaseType,
      label: 'Long Break',
      desc: `Extended recovery every ${settings.longBreakInterval} rounds`,
      minutes: settings.longBreakMinutes,
      step: 5,
      max: 90,
      presets: [10, 15, 20, 30],
    },
  ] as const;

  const countUpGoals = [
    {
      id: 'sessionGoal' as const,
      label: 'Session Goal',
      desc: 'Fills the clock ring and fluid wave to 100% when reached',
      value: settings.countUpTargetMinutes,
      min: 1,
      max: 240,
      step: 5,
      presets: [25, 45, 50, 90],
      onUpdate: (next: number) =>
        onUpdateSettings({
          ...settings,
          countUpTargetMinutes: Math.max(1, Math.min(240, Math.round(next) || 1)),
        }),
    },
    {
      id: 'dailyGoal' as const,
      label: 'Daily Focus Goal',
      desc: 'Tracks your daily target completion across Analytics',
      value: settings.dailyGoalMinutes,
      min: 15,
      max: 720,
      step: 15,
      presets: [90, 120, 150, 240],
      onUpdate: (next: number) =>
        onUpdateSettings({
          ...settings,
          dailyGoalMinutes: Math.max(15, Math.min(720, Math.round(next) || 15)),
        }),
    },
  ] as const;

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-white dark:bg-black text-black dark:text-white transition-colors duration-200 flex flex-col">
      {/* Full-Screen Dedicated Edit Header (Back · Title · Reset) */}
      <header className="border-b-2 border-black dark:border-white pt-[env(safe-area-inset-top)]">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <button
            type="button"
            onClick={onBack}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-bold ${bwSolidBtn}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <h1 className="min-w-0 truncate text-base sm:text-lg font-bold tracking-tight">
            {timerMode === 'countdown' ? 'Edit Session Times' : 'Set Count Up Goal'}
          </h1>

          <button
            type="button"
            onClick={
              timerMode === 'countdown' ? onResetCountdownDefaults : onResetCountUpDefaults
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs font-bold rounded-lg ${bwSolidBtn}`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {timerMode === 'countdown' ? 'Reset 25 / 5 / 15' : 'Reset 50m / 150m'}
            </span>
            <span className="sm:hidden">Reset</span>
          </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-8 py-7 sm:py-10 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-7 flex flex-col justify-between">
        <div className="space-y-7">
          {/* Mode Switcher Bar inside Full-Screen Edit */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-black/15 dark:border-white/20">
            <p className="text-xs sm:text-sm text-black/75 dark:text-white/80">
              {timerMode === 'countdown'
                ? 'Choose an active phase and customize each session duration.'
                : 'Set your open-ended session goal and daily focus target.'}
            </p>

            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Edit mode">
              <button
                type="button"
                onClick={() => onSwitchMode('countdown')}
                className={`px-3.5 py-2 text-xs rounded-lg ${bwOptionBtn(
                  timerMode === 'countdown',
                )}`}
              >
                Countdown Times
              </button>
              <button
                type="button"
                onClick={() => onSwitchMode('countup')}
                className={`px-3.5 py-2 text-xs rounded-lg ${bwOptionBtn(
                  timerMode === 'countup',
                )}`}
              >
                Count Up Goal
              </button>
            </div>
          </div>

          {timerMode === 'countdown' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {countdownRows.map((row) => {
                const isActivePhase = phase === row.id;
                return (
                  <div
                    key={row.id}
                    className={`min-w-0 rounded-2xl p-5 space-y-4 transition-colors ${
                      isActivePhase
                        ? 'border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black'
                        : 'border-2 border-black dark:border-white bg-white text-black dark:bg-black dark:text-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="text-base font-bold">{row.label}</h2>
                        <p
                          className={`text-xs mt-0.5 ${
                            isActivePhase
                              ? 'text-white/80 dark:text-black/75'
                              : 'text-black/65 dark:text-white/70'
                          }`}
                        >
                          {row.desc}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectCountdownPhase(row.id)}
                        className={`px-2.5 py-1 text-[11px] rounded-lg border-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                          isActivePhase
                            ? 'border-white dark:border-black bg-white text-black dark:bg-black dark:text-white font-bold'
                            : 'border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white font-semibold'
                        }`}
                      >
                        {isActivePhase ? 'Active' : 'Use Now'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Decrease ${row.label}`}
                        onClick={() => onUpdatePhaseMinutes(row.id, row.minutes - row.step)}
                        className={`w-10 h-10 inline-flex items-center justify-center rounded-xl border-2 transition-colors cursor-pointer shrink-0 ${
                          isActivePhase
                            ? 'border-white dark:border-black bg-white text-black dark:bg-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black'
                            : 'border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white'
                        }`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <div
                        className={`flex-1 min-w-0 inline-flex items-center justify-center h-10 px-3 rounded-xl border-2 ${
                          isActivePhase
                            ? 'border-white dark:border-black bg-black text-white dark:bg-white dark:text-black'
                            : 'border-black dark:border-white bg-white text-black dark:bg-black dark:text-white'
                        }`}
                      >
                        <input
                          type="number"
                          min={1}
                          max={row.max}
                          value={row.minutes}
                          aria-label={`${row.label} minutes`}
                          onChange={(e) =>
                            onUpdatePhaseMinutes(row.id, Number(e.target.value) || 1)
                          }
                          className="w-16 text-center text-base font-bold font-mono-tabular bg-transparent focus:outline-none"
                        />
                        <span className="text-xs font-mono-tabular font-semibold opacity-75">
                          min
                        </span>
                      </div>

                      <button
                        type="button"
                        aria-label={`Increase ${row.label}`}
                        onClick={() => onUpdatePhaseMinutes(row.id, row.minutes + row.step)}
                        className={`w-10 h-10 inline-flex items-center justify-center rounded-xl border-2 transition-colors cursor-pointer shrink-0 ${
                          isActivePhase
                            ? 'border-white dark:border-black bg-white text-black dark:bg-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black'
                            : 'border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {row.presets.map((qm) => {
                        const isSelected = row.minutes === qm;
                        return (
                          <button
                            key={qm}
                            type="button"
                            onClick={() => onUpdatePhaseMinutes(row.id, qm)}
                            className={`flex-1 py-2 px-2 text-xs font-mono-tabular rounded-lg border-2 transition-colors cursor-pointer ${
                              isActivePhase
                                ? isSelected
                                  ? 'border-white dark:border-black bg-white text-black dark:bg-black dark:text-white font-bold'
                                  : 'border-white/70 dark:border-black/70 bg-transparent text-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white font-semibold'
                                : isSelected
                                  ? 'border-black dark:border-white bg-black text-white dark:bg-white dark:text-black font-bold'
                                  : 'border-black dark:border-white bg-white text-black dark:bg-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-semibold'
                            }`}
                          >
                            {qm}m
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {countUpGoals.map((goal, idx) => {
                const isPrimary = idx === 0;
                return (
                  <div
                    key={goal.id}
                    className={`min-w-0 rounded-2xl p-5 sm:p-6 space-y-4 ${
                      isPrimary
                        ? 'border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black'
                        : 'border-2 border-black dark:border-white bg-white text-black dark:bg-black dark:text-white'
                    }`}
                  >
                    <div>
                      <h2 className="text-base font-bold">{goal.label}</h2>
                      <p
                        className={`text-xs mt-0.5 ${
                          isPrimary
                            ? 'text-white/80 dark:text-black/75'
                            : 'text-black/65 dark:text-white/70'
                        }`}
                      >
                        {goal.desc}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        aria-label={`Decrease ${goal.label}`}
                        onClick={() => goal.onUpdate(goal.value - goal.step)}
                        className={`w-10 h-10 inline-flex items-center justify-center rounded-xl border-2 transition-colors cursor-pointer shrink-0 ${
                          isPrimary
                            ? 'border-white dark:border-black bg-white text-black dark:bg-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black'
                            : 'border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white'
                        }`}
                      >
                        <Minus className="w-4 h-4" />
                      </button>

                      <div
                        className={`flex-1 min-w-0 inline-flex items-center justify-center h-10 px-3 rounded-xl border-2 ${
                          isPrimary
                            ? 'border-white dark:border-black bg-black text-white dark:bg-white dark:text-black'
                            : 'border-black dark:border-white bg-white text-black dark:bg-black dark:text-white'
                        }`}
                      >
                        <input
                          type="number"
                          min={goal.min}
                          max={goal.max}
                          value={goal.value}
                          aria-label={`${goal.label} minutes`}
                          onChange={(e) => goal.onUpdate(Number(e.target.value) || goal.min)}
                          className="w-16 text-center text-base font-bold font-mono-tabular bg-transparent focus:outline-none"
                        />
                        <span className="text-xs font-mono-tabular font-semibold opacity-75">
                          min
                        </span>
                      </div>

                      <button
                        type="button"
                        aria-label={`Increase ${goal.label}`}
                        onClick={() => goal.onUpdate(goal.value + goal.step)}
                        className={`w-10 h-10 inline-flex items-center justify-center rounded-xl border-2 transition-colors cursor-pointer shrink-0 ${
                          isPrimary
                            ? 'border-white dark:border-black bg-white text-black dark:bg-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black'
                            : 'border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {goal.presets.map((qm) => {
                        const isSelected = goal.value === qm;
                        return (
                          <button
                            key={qm}
                            type="button"
                            onClick={() => goal.onUpdate(qm)}
                            className={`flex-1 py-2 px-2 text-xs font-mono-tabular rounded-lg border-2 transition-colors cursor-pointer ${
                              isPrimary
                                ? isSelected
                                  ? 'border-white dark:border-black bg-white text-black dark:bg-black dark:text-white font-bold'
                                  : 'border-white/70 dark:border-black/70 bg-transparent text-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white font-semibold'
                                : isSelected
                                  ? 'border-black dark:border-white bg-black text-white dark:bg-white dark:text-black font-bold'
                                  : 'border-black dark:border-white bg-white text-black dark:bg-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-semibold'
                            }`}
                          >
                            {qm}m
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Presence Verification Check-In Card (Shared for both Countdown & Count Up) */}
          <section className="min-w-0 rounded-2xl border-2 border-black dark:border-white bg-white dark:bg-black p-5 sm:p-6 space-y-5 shadow-[0_14px_40px_rgba(0,0,0,0.06)] dark:shadow-[0_14px_40px_rgba(255,255,255,0.05)]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 text-base font-bold">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Presence Check-In Verification</span>
                </div>
                <p className="text-xs text-black/70 dark:text-white/75 mt-1">
                  Prompts you to tap &ldquo;I&rsquo;m Present&rdquo; every{' '}
                  <span className="font-mono-tabular font-bold">
                    {settings.presenceIntervalMinutes}m
                  </span>{' '}
                  (30m minimum) during both Countdown and Count Up focus sessions.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={settings.presenceCheckEnabled}
                onClick={() =>
                  onUpdateSettings({
                    ...settings,
                    presenceCheckEnabled: !settings.presenceCheckEnabled,
                  })
                }
                className={`px-4 py-2 text-xs rounded-xl ${bwOptionBtn(
                  settings.presenceCheckEnabled,
                )}`}
              >
                {settings.presenceCheckEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {settings.presenceCheckEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center pt-4 border-t border-black/15 dark:border-white/20">
                <div className="md:col-span-5 flex items-center gap-2.5">
                  <button
                    type="button"
                    aria-label="Decrease presence interval"
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        presenceIntervalMinutes: Math.max(
                          MIN_PRESENCE_INTERVAL_MINUTES,
                          settings.presenceIntervalMinutes - 5,
                        ),
                      })
                    }
                    className={`w-10 h-10 inline-flex items-center justify-center rounded-xl ${bwSolidBtn}`}
                  >
                    <Minus className="w-4 h-4" />
                  </button>

                  <div className="flex-1 min-w-0 inline-flex items-center justify-center h-10 px-3 rounded-xl border-2 border-black dark:border-white bg-white text-black dark:bg-black dark:text-white">
                    <input
                      type="number"
                      min={MIN_PRESENCE_INTERVAL_MINUTES}
                      max={MAX_PRESENCE_INTERVAL_MINUTES}
                      value={settings.presenceIntervalMinutes}
                      aria-label="Presence check-in interval minutes"
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        const clean = Number.isFinite(raw)
                          ? Math.max(
                              MIN_PRESENCE_INTERVAL_MINUTES,
                              Math.min(MAX_PRESENCE_INTERVAL_MINUTES, Math.round(raw)),
                            )
                          : MIN_PRESENCE_INTERVAL_MINUTES;
                        onUpdateSettings({
                          ...settings,
                          presenceIntervalMinutes: clean,
                        });
                      }}
                      className="w-16 text-center text-base font-bold font-mono-tabular bg-transparent focus:outline-none"
                    />
                    <span className="text-xs font-mono-tabular font-semibold opacity-75">
                      min
                    </span>
                  </div>

                  <button
                    type="button"
                    aria-label="Increase presence interval"
                    onClick={() =>
                      onUpdateSettings({
                        ...settings,
                        presenceIntervalMinutes: Math.min(
                          MAX_PRESENCE_INTERVAL_MINUTES,
                          settings.presenceIntervalMinutes + 5,
                        ),
                      })
                    }
                    className={`w-10 h-10 inline-flex items-center justify-center rounded-xl ${bwSolidBtn}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <div className="md:col-span-7 flex flex-wrap gap-2">
                  {[30, 45, 60, 90, 120].map((pm) => {
                    const selected = settings.presenceIntervalMinutes === pm;
                    return (
                      <button
                        key={pm}
                        type="button"
                        onClick={() =>
                          onUpdateSettings({
                            ...settings,
                            presenceIntervalMinutes: pm,
                          })
                        }
                        className={`flex-1 min-w-[54px] py-2 px-2.5 text-xs font-mono-tabular rounded-lg ${bwOptionBtn(
                          selected,
                        )}`}
                      >
                        {pm}m
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="pt-6 border-t border-black/15 dark:border-white/20 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-black/65 dark:text-white/70">
            All changes save automatically.
          </span>
          <button
            type="button"
            onClick={onBack}
            className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold rounded-xl ${bwSolidBtn}`}
          >
            <Check className="w-4 h-4" />
            <span>Done &amp; Return to Clock</span>
          </button>
        </div>
      </main>
    </div>
  );
}
