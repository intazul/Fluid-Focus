import {
  BarChart3,
  Check,
  Coffee,
  Pencil,
  RotateCcw,
  Settings,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnalyticsPage } from './components/AnalyticsPage';
import { ClockDisplay } from './components/ClockDisplay';
import { EditPage } from './components/EditPage';
import { SettingsPage } from './components/SettingsPage';
import { XpBubbleBurst, XpBurstEvent } from './components/XpBubbleBurst';
import {
  ADAPTIVE_LADDER_MINUTES,
  AppView,
  ClockFormat,
  MIN_PRESENCE_INTERVAL_MINUTES,
  PRESENCE_RESPONSE_WINDOW_SECONDS,
  PhaseType,
  PomodoroSettings,
  STREAK_SHIELD_COST_XP,
  SessionRecord,
  ThemeMode,
  TimerMode,
  ULTRADIAN_CYCLE_SECONDS,
  UrgeBuckets,
  XP_INTERVAL_SECONDS,
  XP_PEAK_WINDOW_BONUS,
  XP_PER_INTERVAL,
  XP_ZERO_URGE_BONUS,
  XpState,
} from './types/pomodoro';
import {
  playCompletionChime,
  playMilestoneChime,
  playPresenceConfirmChime,
  playPresencePromptChime,
  playTickSound,
  playXpRewardChime,
  stopAmbientNoise,
  syncAmbientNoise,
} from './utils/sound';
import {
  computePeakFocusHour,
  getMonolithRank,
  isWithinPeakWindow,
  loadClockFormat,
  loadSessions,
  loadSettings,
  loadTheme,
  loadTimerMode,
  loadXpState,
  saveClockFormat,
  saveSessions,
  saveSettings,
  saveTheme,
  saveTimerMode,
  saveXpState,
  subscribeCrossTabSync,
} from './utils/storage';

const IGNITION_SECONDS = 5 * 60;
const GRACE_PAUSE_SECONDS = 10;

function getInitialView(): AppView {
  try {
    const view = new URLSearchParams(window.location.search).get('view');
    if (view === 'analytics') return 'analytics';
    if (view === 'settings') return 'settings';
    if (view === 'edit') return 'edit';
  } catch {
    // ignore
  }
  return 'dashboard';
}

function formatTitleTime(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export default function App() {
  const [view, setView] = useState<AppView>(() => getInitialView());
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [settings, setSettings] = useState<PomodoroSettings>(() => loadSettings());
  const [clockFormat, setClockFormat] = useState<ClockFormat>(() => loadClockFormat());
  const [timerMode, setTimerMode] = useState<TimerMode>(() => loadTimerMode());
  const [sessions, setSessions] = useState<SessionRecord[]>(() => loadSessions());
  const [xpState, setXpState] = useState<XpState>(() => loadXpState(loadSessions()));

  const [phase, setPhase] = useState<PhaseType>('focus');
  const [completedRounds, setCompletedRounds] = useState<number>(0);
  const [consecutiveFocusBlocks, setConsecutiveFocusBlocks] = useState<number>(0);
  const [recoveryPromptReason, setRecoveryPromptReason] = useState<
    'burnout' | 'ultradian' | null
  >(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isIgnition, setIsIgnition] = useState<boolean>(false);
  const [customBreakSeconds, setCustomBreakSeconds] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [ultradianSeconds, setUltradianSeconds] = useState<number>(0);
  const [graceSecondsRemaining, setGraceSecondsRemaining] = useState<number | null>(null);
  const [resetNonce, setResetNonce] = useState<number>(0);
  const [isZenDimmed, setIsZenDimmed] = useState<boolean>(false);
  const [isAmbientPreviewing, setIsAmbientPreviewing] = useState<boolean>(false);

  const [distractions, setDistractions] = useState<number>(0);
  const [xpBursts, setXpBursts] = useState<XpBurstEvent[]>([]);
  const [pendingPresenceCheck, setPendingPresenceCheck] = useState<{
    checkpoint: number;
    secondsLeft: number;
    pausedForAfk: boolean;
    deferredCompletion: boolean;
  } | null>(null);
  const [presenceConfirmedCount, setPresenceConfirmedCount] = useState<number>(0);

  const lastTimestampRef = useRef<number | null>(null);
  const elapsedRef = useRef<number>(0);
  const ultradianRef = useRef<number>(0);
  const ultradianPromptShownRef = useRef<boolean>(false);
  const lastSecondRef = useRef<number>(0);
  const lastBeatRef = useRef<number>(0);
  const ignitionBonusSecondsRef = useRef<number>(0);
  const sessionXpRef = useRef<number>(0);
  const urgeBucketsRef = useRef<UrgeBuckets>({ early: 0, mid: 0, late: 0 });
  const lastPromptedCheckpointRef = useRef<number>(0);
  const presenceConfirmedRef = useRef<number>(0);
  const presenceMissedRef = useRef<number>(0);
  const xpCarryRef = useRef<number>(xpState.carryFocusSeconds);
  const totalXpRef = useRef<number>(xpState.totalXp);
  const shieldedDaysRef = useRef<string[]>(xpState.shieldedDayKeys ?? []);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  useEffect(() => {
    totalXpRef.current = xpState.totalXp;
    xpCarryRef.current = xpState.carryFocusSeconds;
    shieldedDaysRef.current = xpState.shieldedDayKeys ?? [];
  }, [xpState]);

  // Sync Tailwind dark class & Android theme-color meta tag
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#000000' : '#ffffff');
    }
  }, [theme]);

  // Enforce portrait orientation on Android / mobile handhelds
  const enforceMobilePortraitFullscreen = useCallback(() => {
    if (typeof window === 'undefined') return;
    const isTouchHandheld =
      window.matchMedia('(pointer: coarse)').matches || /android/i.test(navigator.userAgent);
    if (!isTouchHandheld) return;

    const orientation = window.screen?.orientation as
      | (ScreenOrientation & { lock?: (mode: string) => Promise<void> })
      | undefined;

    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      void document.documentElement
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() => orientation?.lock?.('portrait').catch(() => {}))
        .catch(() => {
          orientation?.lock?.('portrait').catch(() => {});
        });
    } else {
      orientation?.lock?.('portrait').catch(() => {});
    }
  }, []);

  // Real-time cross-tab synchronization
  useEffect(() => {
    return subscribeCrossTabSync(() => {
      const nextSessions = loadSessions();
      setTheme(loadTheme());
      setSettings(loadSettings());
      setClockFormat(loadClockFormat());
      setSessions(nextSessions);
      setXpState(loadXpState(nextSessions));
    });
  }, []);


  const peakHour = useMemo(() => computePeakFocusHour(sessions), [sessions]);
  const isPeakWindow = useMemo(() => isWithinPeakWindow(peakHour), [peakHour]);
  const monolithRank = useMemo(() => getMonolithRank(xpState.totalXp), [xpState.totalXp]);

  const triggerXpBubble = useCallback(
    (amount: number, label = '30m Deep Concentration') => {
      const burstId = Date.now() + Math.floor(Math.random() * 10000);
      setXpBursts((prev) => [...prev, { id: burstId, amount, label }]);
      if (settings.soundEnabled) {
        playXpRewardChime(settings.soundVolume);
      }
      window.setTimeout(() => {
        setXpBursts((prev) => prev.filter((b) => b.id !== burstId));
      }, 2500);
    },
    [settings.soundEnabled, settings.soundVolume],
  );

  const awardBonusXp = useCallback(
    (amount: number, label: string, delayMs = 0) => {
      const nextTotal = totalXpRef.current + amount;
      totalXpRef.current = nextTotal;
      sessionXpRef.current += amount;
      const updatedXp: XpState = {
        totalXp: nextTotal,
        carryFocusSeconds: xpCarryRef.current,
        shieldedDayKeys: shieldedDaysRef.current,
      };
      setXpState(updatedXp);
      saveXpState(updatedXp);

      if (delayMs > 0) {
        window.setTimeout(() => triggerXpBubble(amount, label), delayMs);
      } else {
        triggerXpBubble(amount, label);
      }
    },
    [triggerXpBubble],
  );

  // 10-Second Grace Pause Buffer countdown when paused mid-focus
  useEffect(() => {
    if (isRunning || graceSecondsRemaining === null) return;
    if (graceSecondsRemaining <= 0) {
      setGraceSecondsRemaining(null);
      return;
    }
    const id = window.setInterval(() => {
      setGraceSecondsRemaining((prev) => (prev !== null && prev > 1 ? prev - 1 : null));
    }, 1000);
    return () => window.clearInterval(id);
  }, [graceSecondsRemaining, isRunning]);

  // Presence Check-In 120s grace countdown -> auto-pauses timer if user is AFK
  useEffect(() => {
    if (!pendingPresenceCheck || pendingPresenceCheck.pausedForAfk) return;
    const id = window.setInterval(() => {
      setPendingPresenceCheck((prev) => {
        if (!prev || prev.pausedForAfk) return prev;
        if (prev.secondsLeft <= 1) {
          presenceMissedRef.current += 1;
          setIsRunning(false);
          return { ...prev, secondsLeft: 0, pausedForAfk: true };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [pendingPresenceCheck]);

  const triggerPresenceAlert = useCallback(
    (_checkpoint: number) => {
      if (settings.soundEnabled) {
        playPresencePromptChime(settings.soundVolume);
      }
    },
    [settings.soundEnabled, settings.soundVolume],
  );

  const handleToggleRun = useCallback(() => {
    if (pendingPresenceCheck?.pausedForAfk || pendingPresenceCheck?.deferredCompletion) {
      return;
    }
    const nextRunning = !isRunning;
    if (nextRunning) {
      setGraceSecondsRemaining(null);
      enforceMobilePortraitFullscreen();
    } else if (settings.gracePauseEnabled && phase === 'focus' && elapsedRef.current > 0) {
      setGraceSecondsRemaining(GRACE_PAUSE_SECONDS);
    }
    setIsRunning(nextRunning);
  }, [
    enforceMobilePortraitFullscreen,
    isRunning,
    pendingPresenceCheck?.deferredCompletion,
    pendingPresenceCheck?.pausedForAfk,
    phase,
    settings.gracePauseEnabled,
  ]);

  // Wake Lock API while timer is running
  useEffect(() => {
    if (!isRunning || !settings.wakeLockEnabled) {
      if (wakeLockRef.current) {
        void wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      return;
    }

    let cancelled = false;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> };
    };
    if (nav.wakeLock) {
      void nav.wakeLock
        .request('screen')
        .then((sentinel) => {
          if (cancelled) {
            void sentinel.release().catch(() => {});
          } else {
            wakeLockRef.current = sentinel;
          }
        })
        .catch(() => {});
    }

    return () => {
      cancelled = true;
      if (wakeLockRef.current) {
        void wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [isRunning, settings.wakeLockEnabled]);

  useEffect(() => {
    if (view !== 'settings' && isAmbientPreviewing) {
      setIsAmbientPreviewing(false);
    }
  }, [isAmbientPreviewing, view]);

  // Generative ambient soundscape lifecycle (active timer or Settings preview)
  useEffect(() => {
    const shouldPlay = isRunning || (view === 'settings' && isAmbientPreviewing);
    syncAmbientNoise(settings.ambientNoise, shouldPlay, settings.ambientVolume);
  }, [isAmbientPreviewing, isRunning, settings.ambientNoise, settings.ambientVolume, view]);

  useEffect(() => {
    return () => stopAmbientNoise();
  }, []);

  // Zen Auto-Fade Chrome while running
  useEffect(() => {
    if (view !== 'dashboard' || !isRunning || !settings.zenFadeEnabled) {
      setIsZenDimmed(false);
      return;
    }

    let timerId = window.setTimeout(() => setIsZenDimmed(true), 4500);
    const wakeChrome = () => {
      setIsZenDimmed(false);
      window.clearTimeout(timerId);
      timerId = window.setTimeout(() => setIsZenDimmed(true), 4500);
    };

    window.addEventListener('pointermove', wakeChrome, { passive: true });
    window.addEventListener('pointerdown', wakeChrome, { passive: true });

    return () => {
      window.clearTimeout(timerId);
      window.removeEventListener('pointermove', wakeChrome);
      window.removeEventListener('pointerdown', wakeChrome);
    };
  }, [isRunning, settings.zenFadeEnabled, view]);

  const getPhaseTotalSeconds = useCallback(
    (targetPhase: PhaseType): number => {
      if (isIgnition && targetPhase === 'focus') return IGNITION_SECONDS;
      if (targetPhase === 'focus') {
        if (settings.adaptiveLadderEnabled && timerMode === 'countdown') {
          const ladderMin =
            ADAPTIVE_LADDER_MINUTES[completedRounds % ADAPTIVE_LADDER_MINUTES.length];
          return ladderMin * 60;
        }
        return settings.focusMinutes * 60;
      }
      if (customBreakSeconds !== null) return customBreakSeconds;
      if (targetPhase === 'shortBreak') return settings.shortBreakMinutes * 60;
      return settings.longBreakMinutes * 60;
    },
    [
      completedRounds,
      customBreakSeconds,
      isIgnition,
      settings.adaptiveLadderEnabled,
      settings.focusMinutes,
      settings.longBreakMinutes,
      settings.shortBreakMinutes,
      timerMode,
    ],
  );

  const appendSession = useCallback(
    (type: 'focus' | 'break', modeUsed: TimerMode, durationSec: number): string | null => {
      const cleanSec = Math.round(durationSec);
      if (cleanSec < 5) return null;
      const newId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const totalChecks = presenceConfirmedRef.current + presenceMissedRef.current;
      const newRecord: SessionRecord = {
        id: newId,
        type,
        mode: modeUsed,
        durationSeconds: cleanSec,
        completedAt: new Date().toISOString(),
        ...(type === 'focus'
          ? {
              distractions,
              urgeBuckets: { ...urgeBucketsRef.current },
              xpEarned: sessionXpRef.current,
              ...(totalChecks > 0
                ? {
                    presenceChecks: {
                      confirmed: presenceConfirmedRef.current,
                      missed: presenceMissedRef.current,
                    },
                  }
                : {}),
            }
          : {}),
      };
      setSessions((prev) => {
        const next = [newRecord, ...prev];
        saveSessions(next);
        return next;
      });
      return newId;
    },
    [distractions],
  );

  const evaluateCompletionXpBonuses = useCallback(
    (durationSec: number) => {
      let delay = 0;
      if (durationSec >= 25 * 60 && distractions === 0) {
        awardBonusXp(XP_ZERO_URGE_BONUS, 'Zero-Urge Purity', delay);
        delay += 550;
      }
      if (durationSec >= 15 * 60 && isPeakWindow) {
        awardBonusXp(XP_PEAK_WINDOW_BONUS, 'Peak Window Bonus', delay);
      }
    },
    [awardBonusXp, distractions, isPeakWindow],
  );

  const handleMilestoneQuarter = useCallback(
    (quarterIndex: number) => {
      if (phase === 'focus' && settings.soundEnabled && settings.chimeSequencerEnabled) {
        playMilestoneChime(quarterIndex, settings.soundVolume);
      }
    },
    [phase, settings.chimeSequencerEnabled, settings.soundEnabled, settings.soundVolume],
  );

  const handleCountdownComplete = useCallback(() => {
    const pitchStep = settings.chimeSequencerEnabled
      ? completedRounds % settings.longBreakInterval
      : 0;

    // Seamless Zeigarnik roll-over from 5-min Ignition into full Focus block
    if (isIgnition && phase === 'focus') {
      ignitionBonusSecondsRef.current += IGNITION_SECONDS;
      setIsIgnition(false);
      elapsedRef.current = 0;
      lastSecondRef.current = 0;
      lastBeatRef.current = 0;
      setElapsedSeconds(0);
      setGraceSecondsRemaining(null);
      lastTimestampRef.current = Date.now();
      if (settings.soundEnabled) {
        playCompletionChime('focus', settings.soundProfile, settings.soundVolume, pitchStep);
      }
      return;
    }

    if (settings.soundEnabled) {
      playCompletionChime(
        phase === 'focus' ? 'focus' : 'break',
        settings.soundProfile,
        settings.soundVolume,
        pitchStep,
      );
    }

    const totalSec =
      getPhaseTotalSeconds(phase) + (phase === 'focus' ? ignitionBonusSecondsRef.current : 0);

    if (phase === 'focus') {
      evaluateCompletionXpBonuses(totalSec);
    }

    appendSession(phase === 'focus' ? 'focus' : 'break', 'countdown', totalSec);

    elapsedRef.current = 0;
    lastSecondRef.current = 0;
    lastBeatRef.current = 0;
    ignitionBonusSecondsRef.current = 0;
    sessionXpRef.current = 0;
    urgeBucketsRef.current = { early: 0, mid: 0, late: 0 };
    lastPromptedCheckpointRef.current = 0;
    presenceConfirmedRef.current = 0;
    presenceMissedRef.current = 0;
    setPresenceConfirmedCount(0);
    setPendingPresenceCheck(null);
    setElapsedSeconds(0);
    setGraceSecondsRemaining(null);
    lastTimestampRef.current = null;
    setCustomBreakSeconds(null);

    if (phase === 'focus') {
      setDistractions(0);
      const nextRounds = completedRounds + 1;
      setCompletedRounds(nextRounds);

      const nextConsecutive = consecutiveFocusBlocks + 1;
      setConsecutiveFocusBlocks(nextConsecutive);
      if (settings.antiBurnoutEnabled && nextConsecutive >= 3) {
        setRecoveryPromptReason('burnout');
      } else if (
        settings.ultradianTrackerEnabled &&
        ultradianRef.current >= ULTRADIAN_CYCLE_SECONDS &&
        !ultradianPromptShownRef.current
      ) {
        ultradianPromptShownRef.current = true;
        setRecoveryPromptReason('ultradian');
      }

      const nextPhase: PhaseType =
        nextRounds % settings.longBreakInterval === 0 ? 'longBreak' : 'shortBreak';
      setPhase(nextPhase);
      setIsRunning(settings.autoStartBreaks);
    } else {
      setConsecutiveFocusBlocks(0);
      setRecoveryPromptReason(null);
      ultradianRef.current = 0;
      ultradianPromptShownRef.current = false;
      setUltradianSeconds(0);
      setPhase('focus');
      setIsRunning(settings.autoStartFocus);
    }
  }, [
    appendSession,
    completedRounds,
    consecutiveFocusBlocks,
    evaluateCompletionXpBonuses,
    getPhaseTotalSeconds,
    isIgnition,
    phase,
    settings.antiBurnoutEnabled,
    settings.autoStartBreaks,
    settings.autoStartFocus,
    settings.chimeSequencerEnabled,
    settings.longBreakInterval,
    settings.soundEnabled,
    settings.soundProfile,
    settings.soundVolume,
    settings.ultradianTrackerEnabled,
  ]);

  const handleConfirmPresence = useCallback(() => {
    if (!pendingPresenceCheck) return;
    presenceConfirmedRef.current += 1;
    setPresenceConfirmedCount(presenceConfirmedRef.current);
    const shouldComplete = pendingPresenceCheck.deferredCompletion;
    const wasPausedForAfk = pendingPresenceCheck.pausedForAfk;
    setPendingPresenceCheck(null);
    if (settings.soundEnabled) {
      playPresenceConfirmChime(settings.soundVolume);
    }
    if (shouldComplete) {
      handleCountdownComplete();
    } else if (wasPausedForAfk) {
      lastTimestampRef.current = Date.now();
      setIsRunning(true);
    }
  }, [
    handleCountdownComplete,
    pendingPresenceCheck,
    settings.soundEnabled,
    settings.soundVolume,
  ]);

  // High-precision timer loop + continuous 30-min (+5 XP) tracker + ultradian cycle + sweep ticks
  useEffect(() => {
    if (!isRunning) {
      lastTimestampRef.current = null;
      return;
    }

    lastTimestampRef.current = Date.now();
    let rafId = 0;

    const advanceTime = () => {
      const now = Date.now();
      const last = lastTimestampRef.current ?? now;
      const dt = Math.max(0, (now - last) / 1000);
      lastTimestampRef.current = now;

      // Accumulate deep concentration XP & Ultradian 90-minute cycle when focusing
      if (phase === 'focus' && dt > 0) {
        ultradianRef.current += dt;
        if (
          settings.ultradianTrackerEnabled &&
          ultradianRef.current >= ULTRADIAN_CYCLE_SECONDS &&
          !ultradianPromptShownRef.current
        ) {
          ultradianPromptShownRef.current = true;
          setRecoveryPromptReason('ultradian');
        }

        let nextCarry = xpCarryRef.current + dt;
        if (nextCarry >= XP_INTERVAL_SECONDS) {
          const earnedCount = Math.floor(nextCarry / XP_INTERVAL_SECONDS);
          const xpDelta = earnedCount * XP_PER_INTERVAL;
          nextCarry = nextCarry % XP_INTERVAL_SECONDS;
          const nextTotal = totalXpRef.current + xpDelta;
          totalXpRef.current = nextTotal;
          xpCarryRef.current = nextCarry;
          sessionXpRef.current += xpDelta;
          const updatedXp: XpState = {
            totalXp: nextTotal,
            carryFocusSeconds: nextCarry,
            shieldedDayKeys: shieldedDaysRef.current,
          };
          setXpState(updatedXp);
          saveXpState(updatedXp);
          triggerXpBubble(xpDelta, '30m Deep Concentration');
        } else {
          xpCarryRef.current = nextCarry;
        }
      }

      const nextElapsed = elapsedRef.current + dt;
      const presenceIntervalSec =
        Math.max(MIN_PRESENCE_INTERVAL_MINUTES, settings.presenceIntervalMinutes) * 60;

      if (timerMode === 'countdown' || phase !== 'focus') {
        const total = getPhaseTotalSeconds(phase);
        if (nextElapsed >= total) {
          if (phase === 'focus' && !isIgnition && settings.presenceCheckEnabled) {
            const totalFocusForCheck = total + ignitionBonusSecondsRef.current;
            const reachedCheckpoint = Math.floor(totalFocusForCheck / presenceIntervalSec);
            if (reachedCheckpoint >= 1 && reachedCheckpoint > lastPromptedCheckpointRef.current) {
              lastPromptedCheckpointRef.current = reachedCheckpoint;
              elapsedRef.current = total;
              setElapsedSeconds(total);
              setIsRunning(false);
              setPendingPresenceCheck({
                checkpoint: reachedCheckpoint,
                secondsLeft: PRESENCE_RESPONSE_WINDOW_SECONDS,
                pausedForAfk: false,
                deferredCompletion: true,
              });
              triggerPresenceAlert(reachedCheckpoint);
              return false;
            }
          }
          handleCountdownComplete();
          return false;
        }
      }

      if (phase === 'focus' && !isIgnition && settings.presenceCheckEnabled) {
        const totalFocusForCheck = nextElapsed + ignitionBonusSecondsRef.current;
        const checkpoint = Math.floor(totalFocusForCheck / presenceIntervalSec);
        if (checkpoint >= 1 && checkpoint > lastPromptedCheckpointRef.current) {
          lastPromptedCheckpointRef.current = checkpoint;
          setPendingPresenceCheck({
            checkpoint,
            secondsLeft: PRESENCE_RESPONSE_WINDOW_SECONDS,
            pausedForAfk: false,
            deferredCompletion: false,
          });
          triggerPresenceAlert(checkpoint);
        }
      }

      const wholeSec = Math.floor(nextElapsed);
      if (settings.sweepMode === 'highbeat') {
        const beat = Math.floor(nextElapsed * 5);
        if (beat > lastBeatRef.current) {
          lastBeatRef.current = beat;
          if (settings.tickSoundEnabled) {
            playTickSound(settings.soundVolume, beat % 5 === 0);
          }
        }
      }

      if (wholeSec > lastSecondRef.current) {
        lastSecondRef.current = wholeSec;
        if (phase === 'focus') {
          setUltradianSeconds(ultradianRef.current);
        }
        if (settings.tickSoundEnabled && settings.sweepMode !== 'highbeat') {
          playTickSound(settings.soundVolume, true);
        }
        if (phase === 'focus' && wholeSec % 15 === 0) {
          const updatedXp: XpState = {
            totalXp: totalXpRef.current,
            carryFocusSeconds: xpCarryRef.current,
            shieldedDayKeys: shieldedDaysRef.current,
          };
          setXpState(updatedXp);
          saveXpState(updatedXp);
        }
      }

      elapsedRef.current = nextElapsed;
      setElapsedSeconds(nextElapsed);
      return true;
    };

    const tickFrame = () => {
      const keepGoing = advanceTime();
      if (keepGoing) {
        rafId = requestAnimationFrame(tickFrame);
      }
    };

    rafId = requestAnimationFrame(tickFrame);

    const bgInterval = window.setInterval(() => {
      advanceTime();
    }, 200);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearInterval(bgInterval);
    };
  }, [
    getPhaseTotalSeconds,
    handleCountdownComplete,
    isIgnition,
    isRunning,
    phase,
    settings.presenceCheckEnabled,
    settings.presenceIntervalMinutes,
    settings.soundVolume,
    settings.sweepMode,
    settings.tickSoundEnabled,
    settings.ultradianTrackerEnabled,
    timerMode,
    triggerPresenceAlert,
    triggerXpBubble,
  ]);

  const isCountingDown = timerMode === 'countdown' || phase !== 'focus';
  const phaseTotalSeconds = getPhaseTotalSeconds(phase);
  const displaySeconds = isCountingDown
    ? Math.max(0, Math.ceil(phaseTotalSeconds - elapsedSeconds))
    : Math.floor(elapsedSeconds);

  const rawFractional = isCountingDown
    ? Math.max(0, phaseTotalSeconds - elapsedSeconds)
    : elapsedSeconds;

  const fractionalSeconds =
    settings.sweepMode === 'smooth'
      ? rawFractional
      : settings.sweepMode === 'highbeat'
        ? Math.floor(rawFractional * 5) / 5
        : isCountingDown
          ? Math.ceil(rawFractional)
          : Math.floor(rawFractional);

  const progress = isCountingDown
    ? Math.min(1, elapsedSeconds / Math.max(1, phaseTotalSeconds))
    : Math.min(1, elapsedSeconds / Math.max(60, settings.countUpTargetMinutes * 60));

  const ultradianProgress = Math.min(1, ultradianSeconds / ULTRADIAN_CYCLE_SECONDS);

  const earnedBreakSeconds =
    timerMode === 'countup' && phase === 'focus'
      ? Math.floor(elapsedSeconds / Math.max(2, settings.flowtimeRatio))
      : 0;
  const earnedBreakMinutes = Math.round(earnedBreakSeconds / 60);

  // Sync browser tab title
  useEffect(() => {
    if (view === 'analytics') {
      document.title = 'Analytics — Monolith Pomodoro';
      return;
    }
    if (view === 'settings') {
      document.title = 'Settings — Monolith Pomodoro';
      return;
    }
    if (view === 'edit') {
      document.title = 'Edit — Monolith Pomodoro';
      return;
    }
    if (isRunning) {
      const label = isIgnition
        ? 'Ignition'
        : phase === 'focus'
          ? 'Focus'
          : phase === 'shortBreak'
            ? 'Short Break'
            : 'Long Break';
      document.title = `${formatTitleTime(displaySeconds)} · ${label} — Monolith Pomodoro`;
    } else {
      document.title = 'Monolith Pomodoro';
    }
  }, [displaySeconds, isIgnition, isRunning, phase, view]);

  const handleReset = useCallback(() => {
    setIsRunning(false);
    setIsIgnition(false);
    setCustomBreakSeconds(null);
    setGraceSecondsRemaining(null);
    elapsedRef.current = 0;
    lastSecondRef.current = 0;
    lastBeatRef.current = 0;
    ignitionBonusSecondsRef.current = 0;
    sessionXpRef.current = 0;
    urgeBucketsRef.current = { early: 0, mid: 0, late: 0 };
    lastPromptedCheckpointRef.current = 0;
    presenceConfirmedRef.current = 0;
    presenceMissedRef.current = 0;
    setPresenceConfirmedCount(0);
    setPendingPresenceCheck(null);
    setElapsedSeconds(0);
    setDistractions(0);
    lastTimestampRef.current = null;
    if (phase !== 'focus') {
      setPhase('focus');
      setConsecutiveFocusBlocks(0);
      ultradianRef.current = 0;
      ultradianPromptShownRef.current = false;
      setUltradianSeconds(0);
    }
    setResetNonce((n) => n + 1);
  }, [phase]);

  const handleSwitchMode = (nextMode: TimerMode) => {
    if (nextMode === timerMode) return;
    setIsRunning(false);
    setIsIgnition(false);
    setCustomBreakSeconds(null);
    setGraceSecondsRemaining(null);
    elapsedRef.current = 0;
    lastSecondRef.current = 0;
    lastBeatRef.current = 0;
    ignitionBonusSecondsRef.current = 0;
    sessionXpRef.current = 0;
    urgeBucketsRef.current = { early: 0, mid: 0, late: 0 };
    lastPromptedCheckpointRef.current = 0;
    presenceConfirmedRef.current = 0;
    presenceMissedRef.current = 0;
    setPresenceConfirmedCount(0);
    setPendingPresenceCheck(null);
    setElapsedSeconds(0);
    setDistractions(0);
    lastTimestampRef.current = null;
    setPhase('focus');
    setTimerMode(nextMode);
    saveTimerMode(nextMode);
  };

  const handleStartIgnition = () => {
    setView('dashboard');
    setTimerMode('countdown');
    saveTimerMode('countdown');
    setPhase('focus');
    setIsIgnition(true);
    setCustomBreakSeconds(null);
    setGraceSecondsRemaining(null);
    elapsedRef.current = 0;
    lastSecondRef.current = 0;
    lastBeatRef.current = 0;
    ignitionBonusSecondsRef.current = 0;
    sessionXpRef.current = 0;
    urgeBucketsRef.current = { early: 0, mid: 0, late: 0 };
    lastPromptedCheckpointRef.current = 0;
    presenceConfirmedRef.current = 0;
    presenceMissedRef.current = 0;
    setPresenceConfirmedCount(0);
    setPendingPresenceCheck(null);
    setElapsedSeconds(0);
    setDistractions(0);
    lastTimestampRef.current = Date.now();
    setIsRunning(true);
  };

  const handleSelectCountdownPhase = (targetPhase: PhaseType) => {
    setIsRunning(false);
    setIsIgnition(false);
    setCustomBreakSeconds(null);
    setGraceSecondsRemaining(null);
    elapsedRef.current = 0;
    lastSecondRef.current = 0;
    lastBeatRef.current = 0;
    ignitionBonusSecondsRef.current = 0;
    sessionXpRef.current = 0;
    urgeBucketsRef.current = { early: 0, mid: 0, late: 0 };
    lastPromptedCheckpointRef.current = 0;
    presenceConfirmedRef.current = 0;
    presenceMissedRef.current = 0;
    setPresenceConfirmedCount(0);
    setPendingPresenceCheck(null);
    setElapsedSeconds(0);
    setDistractions(0);
    lastTimestampRef.current = null;
    setPhase(targetPhase);
    setResetNonce((n) => n + 1);
  };

  const handleUpdatePhaseMinutes = (targetPhase: PhaseType, nextMinutes: number) => {
    const bounds =
      targetPhase === 'focus'
        ? { min: 1, max: 180 }
        : targetPhase === 'shortBreak'
          ? { min: 1, max: 60 }
          : { min: 1, max: 90 };
    const clean = Math.max(bounds.min, Math.min(bounds.max, Math.round(nextMinutes) || bounds.min));

    const updated: PomodoroSettings = {
      ...settings,
      ...(targetPhase === 'focus'
        ? { focusMinutes: clean, adaptiveLadderEnabled: false }
        : targetPhase === 'shortBreak'
          ? { shortBreakMinutes: clean }
          : { longBreakMinutes: clean }),
    };
    setSettings(updated);
    saveSettings(updated);

    if (targetPhase === phase && !isRunning) {
      setIsIgnition(false);
      setCustomBreakSeconds(null);
      setGraceSecondsRemaining(null);
      elapsedRef.current = 0;
      lastSecondRef.current = 0;
      lastBeatRef.current = 0;
      lastPromptedCheckpointRef.current = 0;
      presenceConfirmedRef.current = 0;
      presenceMissedRef.current = 0;
      setPresenceConfirmedCount(0);
      setPendingPresenceCheck(null);
      setElapsedSeconds(0);
      setResetNonce((n) => n + 1);
    }
  };

  const handleFinishCountUp = (startEarnedBreak: boolean) => {
    const totalSec = elapsedSeconds + ignitionBonusSecondsRef.current;
    if (totalSec >= 5) {
      evaluateCompletionXpBonuses(totalSec);
      appendSession('focus', 'countup', totalSec);
    }

    const earnedBreakSec = Math.max(
      60,
      Math.floor(totalSec / Math.max(2, settings.flowtimeRatio)),
    );

    setIsRunning(false);
    setIsIgnition(false);
    setGraceSecondsRemaining(null);
    elapsedRef.current = 0;
    lastSecondRef.current = 0;
    lastBeatRef.current = 0;
    ignitionBonusSecondsRef.current = 0;
    sessionXpRef.current = 0;
    urgeBucketsRef.current = { early: 0, mid: 0, late: 0 };
    lastPromptedCheckpointRef.current = 0;
    presenceConfirmedRef.current = 0;
    presenceMissedRef.current = 0;
    setPresenceConfirmedCount(0);
    setPendingPresenceCheck(null);
    setElapsedSeconds(0);
    setDistractions(0);
    lastTimestampRef.current = null;
    setResetNonce((n) => n + 1);

    if (startEarnedBreak && totalSec >= 60) {
      setConsecutiveFocusBlocks(0);
      setRecoveryPromptReason(null);
      ultradianRef.current = 0;
      ultradianPromptShownRef.current = false;
      setUltradianSeconds(0);
      setCustomBreakSeconds(earnedBreakSec);
      setPhase('shortBreak');
      setIsRunning(true);
    } else if (totalSec >= 60) {
      const nextConsecutive = consecutiveFocusBlocks + 1;
      setConsecutiveFocusBlocks(nextConsecutive);
      if (settings.antiBurnoutEnabled && nextConsecutive >= 3) {
        setRecoveryPromptReason('burnout');
      } else if (
        settings.ultradianTrackerEnabled &&
        ultradianRef.current >= ULTRADIAN_CYCLE_SECONDS &&
        !ultradianPromptShownRef.current
      ) {
        ultradianPromptShownRef.current = true;
        setRecoveryPromptReason('ultradian');
      }
    }
  };

  const handleStartRecoveryBreak = () => {
    setRecoveryPromptReason(null);
    setConsecutiveFocusBlocks(0);
    setGraceSecondsRemaining(null);
    ultradianRef.current = 0;
    ultradianPromptShownRef.current = false;
    setUltradianSeconds(0);
    setCustomBreakSeconds(10 * 60);
    elapsedRef.current = 0;
    lastSecondRef.current = 0;
    lastBeatRef.current = 0;
    setElapsedSeconds(0);
    setPhase('shortBreak');
    lastTimestampRef.current = Date.now();
    setIsRunning(true);
  };

  const handleLogDistraction = useCallback(() => {
    if (phase !== 'focus') return;
    const sec = elapsedRef.current;
    if (sec < 600) {
      urgeBucketsRef.current.early += 1;
    } else if (sec < 1200) {
      urgeBucketsRef.current.mid += 1;
    } else {
      urgeBucketsRef.current.late += 1;
    }
    setDistractions((d) => d + 1);
  }, [phase]);

  const handleActivateStreakShield = useCallback((targetDayKey: string) => {
    if (totalXpRef.current < STREAK_SHIELD_COST_XP) return;
    if (shieldedDaysRef.current.includes(targetDayKey)) return;

    const nextTotal = totalXpRef.current - STREAK_SHIELD_COST_XP;
    const nextShielded = [...shieldedDaysRef.current, targetDayKey];
    totalXpRef.current = nextTotal;
    shieldedDaysRef.current = nextShielded;

    const updatedXp: XpState = {
      totalXp: nextTotal,
      carryFocusSeconds: xpCarryRef.current,
      shieldedDayKeys: nextShielded,
    };
    setXpState(updatedXp);
    saveXpState(updatedXp);
  }, []);

  const handleChangeTheme = (nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    saveTheme(nextTheme);
  };

  const handleChangeClockFormat = (fmt: ClockFormat) => {
    setClockFormat(fmt);
    saveClockFormat(fmt);
  };

  const handleUpdateSettings = (next: PomodoroSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  const handleClearHistory = () => {
    setSessions([]);
    saveSessions([]);
    const clearedXp: XpState = { totalXp: 0, carryFocusSeconds: 0, shieldedDayKeys: [] };
    setXpState(clearedXp);
    saveXpState(clearedXp);
  };

  const handleAddStudiedSession = useCallback(
    (minutes: number, completedAtIso: string) => {
      const cleanMin = Math.max(1, Math.min(720, Math.round(minutes)));
      const newRecord: SessionRecord = {
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'focus',
        mode: 'countup',
        source: 'manual',
        durationSeconds: cleanMin * 60,
        completedAt: completedAtIso,
        xpEarned: 0,
      };
      setSessions((prev) => {
        const next = [newRecord, ...prev].sort(
          (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime(),
        );
        saveSessions(next);
        return next;
      });
    },
    [],
  );

  const handleDeleteSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      saveSessions(next);
      return next;
    });
  }, []);

  const chromeOpacityClass = isZenDimmed ? 'opacity-15 hover:opacity-100' : 'opacity-100';
  const xpProgressPct = Math.min(
    100,
    Math.round((xpState.carryFocusSeconds / XP_INTERVAL_SECONDS) * 100),
  );

  return (
    <>
      <AnimatePresence mode="wait">
        {view === 'analytics' && (
          <motion.div
            key="view-analytics"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <AnalyticsPage
              sessions={sessions}
              settings={settings}
              theme={theme}
              xpState={xpState}
              onActivateStreakShield={handleActivateStreakShield}
              onAddStudiedSession={handleAddStudiedSession}
              onDeleteSession={handleDeleteSession}
              onNavigate={setView}
              onClearHistory={handleClearHistory}
            />
          </motion.div>
        )}

        {view === 'settings' && (
          <motion.div
            key="view-settings"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <SettingsPage
              theme={theme}
              onChangeTheme={handleChangeTheme}
              clockFormat={clockFormat}
              onChangeClockFormat={handleChangeClockFormat}
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              sessions={sessions}
              xpState={xpState}
              onStartIgnition={handleStartIgnition}
              isAmbientPreviewing={isAmbientPreviewing}
              onToggleAmbientPreview={() => setIsAmbientPreviewing((p) => !p)}
              onPreviewXpBurst={() => triggerXpBubble(5, '30m Deep Concentration')}
              onNavigate={setView}
              onResetAllData={handleClearHistory}
            />
          </motion.div>
        )}

        {view === 'edit' && (
          <motion.div
            key="view-edit"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <EditPage
              timerMode={timerMode}
              phase={phase}
              settings={settings}
              onSwitchMode={handleSwitchMode}
              onSelectCountdownPhase={handleSelectCountdownPhase}
              onUpdatePhaseMinutes={handleUpdatePhaseMinutes}
              onUpdateSettings={handleUpdateSettings}
              onResetCountdownDefaults={() => {
                handleUpdateSettings({
                  ...settings,
                  focusMinutes: 25,
                  shortBreakMinutes: 5,
                  longBreakMinutes: 15,
                  adaptiveLadderEnabled: false,
                });
                if (!isRunning) {
                  setIsIgnition(false);
                  setCustomBreakSeconds(null);
                  setGraceSecondsRemaining(null);
                  elapsedRef.current = 0;
                  lastSecondRef.current = 0;
                  lastBeatRef.current = 0;
                  setElapsedSeconds(0);
                  setResetNonce((n) => n + 1);
                }
              }}
              onResetCountUpDefaults={() =>
                handleUpdateSettings({
                  ...settings,
                  countUpTargetMinutes: 50,
                  dailyGoalMinutes: 150,
                })
              }
              onBack={() => setView('dashboard')}
            />
          </motion.div>
        )}

        {view === 'dashboard' && (
          <motion.div
            key="view-dashboard"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-dvh w-full overflow-hidden bg-white dark:bg-black text-black dark:text-white transition-colors duration-200 atelier-grid-bg"
          >
            {/* Top-Left Corner: Extreme High-Contrast Settings & Analytics Icons */}
            <div
              className={`fixed top-[max(1rem,env(safe-area-inset-top))] left-4 sm:top-6 sm:left-6 z-30 flex items-center gap-2.5 transition-opacity duration-500 ${chromeOpacityClass}`}
            >
              <motion.button
                type="button"
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.93 }}
                transition={{ duration: 0.14 }}
                onClick={() => setView('settings')}
                aria-label="Open settings"
                title="Settings"
                className="w-10 h-10 inline-flex items-center justify-center rounded-xl border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white transition-colors cursor-pointer shadow-[0_6px_18px_rgba(0,0,0,0.12)] dark:shadow-[0_6px_18px_rgba(255,255,255,0.08)]"
              >
                <Settings className="w-4 h-4" />
              </motion.button>

              <motion.button
                type="button"
                whileHover={{ scale: 1.07 }}
                whileTap={{ scale: 0.93 }}
                transition={{ duration: 0.14 }}
                onClick={() => setView('analytics')}
                aria-label="Open analytics"
                title="Analytics"
                className="w-10 h-10 inline-flex items-center justify-center rounded-xl border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white transition-colors cursor-pointer shadow-[0_6px_18px_rgba(0,0,0,0.12)] dark:shadow-[0_6px_18px_rgba(255,255,255,0.08)]"
              >
                <BarChart3 className="w-4 h-4" />
              </motion.button>
            </div>

            {/* Top-Right: Unboxed Quiet XP & Rank Readout */}
            <div
              className={`fixed top-[max(1.25rem,calc(env(safe-area-inset-top)+0.25rem))] right-4 sm:top-7 sm:right-6 z-30 text-right transition-opacity duration-500 ${chromeOpacityClass}`}
              title={`${Math.floor(xpState.carryFocusSeconds / 60)}/30m toward next +5 XP`}
            >
              <div className="text-xs sm:text-sm font-bold font-mono-tabular tracking-tight text-black dark:text-white">
                {xpState.totalXp} XP · {monolithRank.name}
              </div>
              <div className="mt-1.5 w-20 h-[3px] bg-black/15 dark:bg-white/25 ml-auto overflow-hidden rounded-full">
                <motion.div
                  className="h-full bg-black dark:bg-white"
                  initial={false}
                  animate={{ width: `${xpProgressPct}%` }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>

            {/* Zero-scroll Centered Dashboard Viewport */}
            <main className="relative z-10 h-full w-full flex flex-col items-center justify-between px-4 sm:px-6 pt-[max(4rem,calc(env(safe-area-inset-top)+3.25rem))] pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pt-7 sm:pb-7">
              {/* Top Mode Control + Single Edit Button */}
              <div
                className={`flex flex-wrap items-center justify-center gap-2.5 shrink-0 transition-opacity duration-500 ${chromeOpacityClass}`}
              >
                <div
                  className="inline-flex p-1 rounded-xl border-2 border-black dark:border-white bg-white dark:bg-black shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_24px_rgba(255,255,255,0.06)]"
                  role="group"
                  aria-label="Timer counting mode"
                >
                  {(
                    [
                      { id: 'countdown' as TimerMode, label: 'Countdown' },
                      { id: 'countup' as TimerMode, label: 'Count Up' },
                    ] as const
                  ).map((opt) => {
                    const active = timerMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSwitchMode(opt.id)}
                        className={`relative px-4 py-1.5 text-xs font-bold tracking-wide rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                          active
                            ? 'text-white dark:text-black'
                            : 'text-black dark:text-white hover:opacity-70'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="timer-mode-pill"
                            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                            className="absolute inset-0 rounded-lg bg-black dark:bg-white"
                          />
                        )}
                        <span className="relative z-10">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.94 }}
                  transition={{ duration: 0.14 }}
                  onClick={() => setView('edit')}
                  aria-label={
                    timerMode === 'countdown'
                      ? 'Edit countdown session times'
                      : 'Set count up goal'
                  }
                  className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white text-xs font-bold tracking-wide transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_24px_rgba(255,255,255,0.06)]"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </motion.button>
              </div>

              {/* Center Clock Stage (Bigger, Minimal, Rotating) */}
              <div className="flex items-center justify-center min-h-0 py-1">
                <ClockDisplay
                  format={clockFormat}
                  mode={timerMode}
                  phase={phase}
                  theme={theme}
                  isRunning={isRunning}
                  isIgnition={isIgnition}
                  onToggleRun={handleToggleRun}
                  resetNonce={resetNonce}
                  displaySeconds={displaySeconds}
                  elapsedSeconds={elapsedSeconds}
                  fractionalSeconds={fractionalSeconds}
                  progress={progress}
                  ultradianProgress={ultradianProgress}
                  completedRounds={completedRounds}
                  longBreakInterval={settings.longBreakInterval}
                  countUpTargetMinutes={settings.countUpTargetMinutes}
                  earnedBreakMinutes={earnedBreakMinutes}
                  distractions={distractions}
                  graceSecondsRemaining={graceSecondsRemaining}
                  isPeakWindow={isPeakWindow}
                  adaptiveLadderActive={
                    settings.adaptiveLadderEnabled && timerMode === 'countdown'
                  }
                  bubblesEnabled={settings.bubblesEnabled}
                  showDialCaption={settings.showDialCaption}
                  breathingPacerEnabled={settings.breathingPacerEnabled}
                  microMovementEnabled={settings.microMovementEnabled}
                  ultradianTrackerEnabled={settings.ultradianTrackerEnabled}
                  eclipseModeEnabled={settings.eclipseModeEnabled}
                  milestoneRipplesEnabled={settings.milestoneRipplesEnabled}
                  presencePending={Boolean(pendingPresenceCheck)}
                  presenceConfirmedCount={presenceConfirmedCount}
                  onMilestoneQuarter={handleMilestoneQuarter}
                />
              </div>

              {/* Bottom Symmetric High-Contrast Control Bar */}
              <div
                className={`w-full max-w-xl flex flex-col items-center gap-2 shrink-0 transition-opacity duration-500 ${
                  pendingPresenceCheck ? 'opacity-100' : chromeOpacityClass
                }`}
              >
                <AnimatePresence mode="wait">
                  {pendingPresenceCheck ? (
                    <motion.div
                      key={`presence-check-${pendingPresenceCheck.checkpoint}`}
                      initial={{ opacity: 0, y: 10, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.96 }}
                      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                      className="w-full max-w-md rounded-2xl border-2 border-black dark:border-white bg-white dark:bg-black px-4 py-3 shadow-[0_18px_48px_rgba(0,0,0,0.16)] dark:shadow-[0_18px_48px_rgba(255,255,255,0.14)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider">
                            <ShieldCheck className="w-4 h-4 shrink-0" />
                            <span>
                              {pendingPresenceCheck.checkpoint *
                                Math.max(
                                  MIN_PRESENCE_INTERVAL_MINUTES,
                                  settings.presenceIntervalMinutes,
                                )}
                              m Presence Check-In
                            </span>
                          </div>
                          <div className="text-[11px] font-mono-tabular text-black/75 dark:text-white/80 mt-0.5">
                            {pendingPresenceCheck.pausedForAfk
                              ? 'Timer auto-paused · Tap to confirm & resume'
                              : pendingPresenceCheck.deferredCompletion
                                ? `Session ready · Confirm within ${pendingPresenceCheck.secondsLeft}s`
                                : `Tap within ${pendingPresenceCheck.secondsLeft}s to stay active`}
                          </div>
                        </div>

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.94 }}
                          onClick={handleConfirmPresence}
                          className="h-10 px-4 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white text-xs font-extrabold tracking-wide transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Check className="w-4 h-4" />
                          <span>
                            {pendingPresenceCheck.deferredCompletion
                              ? "I'm Present · Complete"
                              : pendingPresenceCheck.pausedForAfk
                                ? "I'm Present · Resume"
                                : "I'm Present"}
                          </span>
                        </motion.button>
                      </div>

                      {!pendingPresenceCheck.pausedForAfk && (
                        <div className="mt-2.5 h-1.5 w-full rounded-full border border-black dark:border-white overflow-hidden">
                          <div
                            className="h-full bg-black dark:bg-white transition-[width] duration-1000 linear"
                            style={{
                              width: `${Math.max(
                                0,
                                Math.min(
                                  100,
                                  (pendingPresenceCheck.secondsLeft /
                                    PRESENCE_RESPONSE_WINDOW_SECONDS) *
                                    100,
                                ),
                              )}%`,
                            }}
                          />
                        </div>
                      )}
                    </motion.div>
                  ) : recoveryPromptReason ? (
                    <motion.div
                      key="recovery-guard"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="flex flex-wrap items-center justify-center gap-2.5 px-4 py-2 rounded-xl border-2 border-black dark:border-white bg-white dark:bg-black text-xs"
                    >
                      <span className="font-semibold">
                        {recoveryPromptReason === 'ultradian'
                          ? '90m Ultradian cycle complete. Take a restorative break?'
                          : '3+ deep blocks without recovery. Screen-away break?'}
                      </span>
                      <button
                        type="button"
                        onClick={handleStartRecoveryBreak}
                        className="px-3 py-1.5 rounded-lg border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black font-bold hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white transition-colors cursor-pointer"
                      >
                        10m Recovery
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecoveryPromptReason(null)}
                        className="px-3 py-1.5 rounded-lg border-2 border-black dark:border-white bg-white text-black dark:bg-black dark:text-white font-semibold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer"
                      >
                        Continue
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="action-icons"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.16 }}
                      className="w-full flex flex-wrap items-center justify-center gap-2"
                    >
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.07 }}
                        whileTap={{ scale: 0.92 }}
                        transition={{ duration: 0.14 }}
                        onClick={handleReset}
                        aria-label="Reset timer"
                        title="Reset"
                        className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-black dark:border-white bg-white text-black dark:bg-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reset</span>
                      </motion.button>

                      {phase === 'focus' && (isRunning || elapsedSeconds > 0) && (
                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.04 }}
                          whileTap={{ scale: 0.92 }}
                          transition={{ duration: 0.14 }}
                          onClick={handleLogDistraction}
                          aria-label="Log distraction urge"
                          title="Log distraction urge"
                          className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black text-xs font-bold font-mono-tabular hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <span>Urges: {distractions}</span>
                        </motion.button>
                      )}

                      {timerMode === 'countup' && phase === 'focus' && elapsedSeconds >= 5 && (
                        <>
                          {earnedBreakMinutes >= 1 && (
                            <motion.button
                              type="button"
                              whileHover={{ scale: 1.04 }}
                              whileTap={{ scale: 0.94 }}
                              transition={{ duration: 0.14 }}
                              onClick={() => handleFinishCountUp(true)}
                              aria-label="Start earned Flowtime break"
                              title={`Take ${earnedBreakMinutes}m Earned Break`}
                              className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                            >
                              <Coffee className="w-3.5 h-3.5" />
                              <span>{earnedBreakMinutes}m Break</span>
                            </motion.button>
                          )}
                          <motion.button
                            type="button"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.92 }}
                            transition={{ duration: 0.14 }}
                            onClick={() => handleFinishCountUp(false)}
                            aria-label="Finish and log focus session"
                            title="Finish & Log Session"
                            className="h-9 px-3.5 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black text-xs font-bold hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Finish</span>
                          </motion.button>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="text-xs font-semibold tracking-wide text-black/75 dark:text-white/80 select-none text-center">
                  {pendingPresenceCheck
                    ? 'Presence verification active · Tap button above to confirm'
                    : isRunning
                      ? settings.presenceCheckEnabled && phase === 'focus' && !isIgnition
                        ? `Click clock to pause · Check-in every ${settings.presenceIntervalMinutes}m`
                        : 'Click clock to pause'
                      : 'Click clock to start'}
                </div>
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Spring-Animated +5/+3/+2 XP Rising Bubble Burst */}
      <XpBubbleBurst bursts={xpBursts} />

      {/* Mobile Handheld Portrait-Only Guard (hidden on desktop and mobile portrait) */}
      <div className="portrait-lock-overlay fixed inset-0 z-[100] flex-col items-center justify-center gap-4 bg-white dark:bg-black text-black dark:text-white p-8 text-center">
        <div className="w-14 h-14 rounded-2xl border-2 border-black dark:border-white flex items-center justify-center">
          <Smartphone className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <div className="text-base font-extrabold tracking-tight">Portrait Mode Only</div>
          <p className="text-xs text-black/70 dark:text-white/75 max-w-xs">
            Rotate your Android device upright to continue your focus session.
          </p>
        </div>
      </div>
    </>
  );
}
