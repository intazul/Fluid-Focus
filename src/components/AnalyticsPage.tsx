import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Minus,
  Plus,
  Printer,
  Shield,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AppView,
  PomodoroSettings,
  STREAK_SHIELD_COST_XP,
  SessionRecord,
  ThemeMode,
  XpState,
} from '../types/pomodoro';
import { computePeakFocusHour, getMonolithRank, MONOLITH_RANKS } from '../utils/storage';

interface AnalyticsPageProps {
  sessions: SessionRecord[];
  settings: PomodoroSettings;
  theme: ThemeMode;
  xpState: XpState;
  currentDayKey?: string;
  onActivateStreakShield?: (targetDayKey: string) => void;
  onAddStudiedSession?: (minutes: number, completedAtIso: string) => void;
  onDeleteSession?: (sessionId: string) => void;
  onNavigate: (view: AppView) => void;
  onClearHistory: () => void;
}

type AnalyticsRange = 'daily' | 'weekly' | 'monthly';
type LedgerFilter = 'all' | 'focus' | 'break' | 'countdown' | 'countup';

interface ChartBucket {
  key: string;
  label: string;
  subLabel?: string;
  focusMinutes: number;
  measuredMinutes: number;
  manualMinutes: number;
  breakMinutes: number;
  focusCount: number;
  breakCount: number;
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfWeekMonday(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDurationMinutes(totalMinutes: number): string {
  const rounded = Math.max(0, Math.round(totalMinutes));
  if (rounded < 60) return `${rounded}m`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatAxisTick(totalMinutes: number): string {
  if (totalMinutes <= 0) return '0m';
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const h = totalMinutes / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

function formatDateLabel(date: Date): string {
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === -1) return 'Yesterday';
  return target.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const startStr = monday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = sunday.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${startStr} – ${endStr}`;
}

export function AnalyticsPage({
  sessions,
  settings,
  theme,
  xpState,
  currentDayKey,
  onActivateStreakShield,
  onAddStudiedSession,
  onDeleteSession,
  onNavigate,
  onClearHistory,
}: AnalyticsPageProps) {
  const [range, setRange] = useState<AnalyticsRange>('weekly');
  const [offset, setOffset] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredPolarHour, setHoveredPolarHour] = useState<number | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<LedgerFilter>('all');
  const [showAllLedger, setShowAllLedger] = useState(false);
  const [debriefCopied, setDebriefCopied] = useState(false);

  const [showAddStudied, setShowAddStudied] = useState(false);
  const [studiedMinutes, setStudiedMinutes] = useState(45);
  const [studiedDate, setStudiedDate] = useState(() => currentDayKey || toDayKey(new Date()));
  const [studiedTime, setStudiedTime] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [studiedFeedback, setStudiedFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (currentDayKey) {
      setStudiedDate((prev) => (prev < currentDayKey ? prev : currentDayKey));
    }
  }, [currentDayKey]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartContainerWidth, setChartContainerWidth] = useState(720);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setChartContainerWidth(next);
    };
    updateWidth();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setChartContainerWidth(Math.round(w));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const bwSolidBtn =
    'border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black hover:bg-white hover:text-black dark:hover:bg-black dark:hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0';

  const bwOptionBtn = (active: boolean) =>
    `border-2 border-black dark:border-white transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
      active
        ? 'bg-black text-white dark:bg-white dark:text-black font-bold'
        : 'bg-white text-black dark:bg-black dark:text-white hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black font-semibold'
    }`;

  const monolithRank = useMemo(() => getMonolithRank(xpState.totalXp), [xpState.totalXp]);
  const globalPeakHour = useMemo(() => computePeakFocusHour(sessions), [sessions]);

  const { buckets, periodLabel, periodSessions, prevPeriodFocusMinutes, prevLeadingFocusMinutes } = useMemo(() => {
    const now = new Date();

    if (range === 'daily') {
      const targetDay = startOfDay(now);
      targetDay.setDate(targetDay.getDate() + offset);
      const nextDay = new Date(targetDay);
      nextDay.setDate(targetDay.getDate() + 1);
      const prevDay = new Date(targetDay);
      prevDay.setDate(targetDay.getDate() - 1);

      const daySessions = sessions.filter((s) => {
        const t = new Date(s.completedAt).getTime();
        return t >= targetDay.getTime() && t < nextDay.getTime();
      });
      const prevDaySessions = sessions.filter((s) => {
        const t = new Date(s.completedAt).getTime();
        return t >= prevDay.getTime() && t < targetDay.getTime();
      });

      const slots: ChartBucket[] = Array.from({ length: 12 }, (_, idx) => {
        const startHour = idx * 2;
        return {
          key: `h-${startHour}`,
          label: `${String(startHour).padStart(2, '0')}h`,
          subLabel: `${String(startHour).padStart(2, '0')}:00–${String(startHour + 2).padStart(2, '0')}:00`,
          focusMinutes: 0,
          measuredMinutes: 0,
          manualMinutes: 0,
          breakMinutes: 0,
          focusCount: 0,
          breakCount: 0,
        };
      });

      daySessions.forEach((s) => {
        const hr = new Date(s.completedAt).getHours();
        const slotIdx = Math.min(11, Math.floor(hr / 2));
        const mins = s.durationSeconds / 60;
        if (s.type === 'focus') {
          slots[slotIdx].focusMinutes += mins;
          if (s.source === 'manual') {
            slots[slotIdx].manualMinutes += mins;
          } else {
            slots[slotIdx].measuredMinutes += mins;
          }
          slots[slotIdx].focusCount += 1;
        } else {
          slots[slotIdx].breakMinutes += mins;
          slots[slotIdx].breakCount += 1;
        }
      });

      let prevFocusMin = 0;
      let prevLastSlotMin = 0;
      prevDaySessions.forEach((s) => {
        if (s.type !== 'focus') return;
        const mins = s.durationSeconds / 60;
        prevFocusMin += mins;
        if (new Date(s.completedAt).getHours() >= 22) {
          prevLastSlotMin += mins;
        }
      });

      return {
        buckets: slots,
        periodLabel: formatDateLabel(targetDay),
        periodSessions: daySessions,
        prevPeriodFocusMinutes: prevFocusMin,
        prevLeadingFocusMinutes: prevLastSlotMin,
      };
    }

    if (range === 'weekly') {
      const weekStart = startOfWeekMonday(now);
      weekStart.setDate(weekStart.getDate() + offset * 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const prevWeekStart = new Date(weekStart);
      prevWeekStart.setDate(weekStart.getDate() - 7);

      const weekSessions = sessions.filter((s) => {
        const t = new Date(s.completedAt).getTime();
        return t >= weekStart.getTime() && t < weekEnd.getTime();
      });
      const prevWeekSessions = sessions.filter((s) => {
        const t = new Date(s.completedAt).getTime();
        return t >= prevWeekStart.getTime() && t < weekStart.getTime();
      });

      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const days: ChartBucket[] = Array.from({ length: 7 }, (_, idx) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + idx);
        return {
          key: `d-${idx}`,
          label: dayNames[idx],
          subLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
          focusMinutes: 0,
          measuredMinutes: 0,
          manualMinutes: 0,
          breakMinutes: 0,
          focusCount: 0,
          breakCount: 0,
        };
      });

      weekSessions.forEach((s) => {
        const d = new Date(s.completedAt);
        const dayIdx = (d.getDay() + 6) % 7;
        const mins = s.durationSeconds / 60;
        if (s.type === 'focus') {
          days[dayIdx].focusMinutes += mins;
          if (s.source === 'manual') {
            days[dayIdx].manualMinutes += mins;
          } else {
            days[dayIdx].measuredMinutes += mins;
          }
          days[dayIdx].focusCount += 1;
        } else {
          days[dayIdx].breakMinutes += mins;
          days[dayIdx].breakCount += 1;
        }
      });

      let prevFocusMin = 0;
      let prevSundayMin = 0;
      prevWeekSessions.forEach((s) => {
        if (s.type !== 'focus') return;
        const mins = s.durationSeconds / 60;
        prevFocusMin += mins;
        if ((new Date(s.completedAt).getDay() + 6) % 7 === 6) {
          prevSundayMin += mins;
        }
      });

      return {
        buckets: days,
        periodLabel: formatWeekLabel(weekStart),
        periodSessions: weekSessions,
        prevPeriodFocusMinutes: prevFocusMin,
        prevLeadingFocusMinutes: prevSundayMin,
      };
    }

    // 30-day rolling window
    const endDay = startOfDay(now);
    endDay.setDate(endDay.getDate() + offset * 30 + 1);
    const startDay = new Date(endDay);
    startDay.setDate(endDay.getDate() - 30);
    const prevStartDay = new Date(startDay);
    prevStartDay.setDate(startDay.getDate() - 30);

    const monthSessions = sessions.filter((s) => {
      const t = new Date(s.completedAt).getTime();
      return t >= startDay.getTime() && t < endDay.getTime();
    });
    const prevMonthSessions = sessions.filter((s) => {
      const t = new Date(s.completedAt).getTime();
      return t >= prevStartDay.getTime() && t < startDay.getTime();
    });

    const dayBuckets: ChartBucket[] = Array.from({ length: 30 }, (_, idx) => {
      const d = new Date(startDay);
      d.setDate(startDay.getDate() + idx);
      return {
        key: toDayKey(d),
        label: idx % 5 === 0 || idx === 29 ? String(d.getDate()) : '',
        subLabel: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        focusMinutes: 0,
        measuredMinutes: 0,
        manualMinutes: 0,
        breakMinutes: 0,
        focusCount: 0,
        breakCount: 0,
      };
    });

    const bucketMap = new Map(dayBuckets.map((b) => [b.key, b]));
    monthSessions.forEach((s) => {
      const b = bucketMap.get(toDayKey(new Date(s.completedAt)));
      if (!b) return;
      const mins = s.durationSeconds / 60;
      if (s.type === 'focus') {
        b.focusMinutes += mins;
        if (s.source === 'manual') {
          b.manualMinutes += mins;
        } else {
          b.measuredMinutes += mins;
        }
        b.focusCount += 1;
      } else {
        b.breakMinutes += mins;
        b.breakCount += 1;
      }
    });

    const prevLastDay = new Date(startDay);
    prevLastDay.setDate(startDay.getDate() - 1);
    const prevLastKey = toDayKey(prevLastDay);
    let prevFocusMin = 0;
    let prevLeadingMin = 0;
    prevMonthSessions.forEach((s) => {
      if (s.type !== 'focus') return;
      const mins = s.durationSeconds / 60;
      prevFocusMin += mins;
      if (toDayKey(new Date(s.completedAt)) === prevLastKey) {
        prevLeadingMin += mins;
      }
    });

    const lastDayShown = new Date(endDay);
    lastDayShown.setDate(endDay.getDate() - 1);
    return {
      buckets: dayBuckets,
      periodLabel: `${startDay.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${lastDayShown.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      periodSessions: monthSessions,
      prevPeriodFocusMinutes: prevFocusMin,
      prevLeadingFocusMinutes: prevLeadingMin,
    };
  }, [currentDayKey, range, offset, sessions]);

  const deepMetrics = useMemo(() => {
    const focusList = periodSessions.filter((s) => s.type === 'focus');
    const breakList = periodSessions.filter((s) => s.type === 'break');

    const focusMinutes = focusList.reduce((sum, s) => sum + s.durationSeconds / 60, 0);
    const measuredFocusMinutes = focusList
      .filter((s) => s.source !== 'manual')
      .reduce((sum, s) => sum + s.durationSeconds / 60, 0);
    const manualFocusMinutes = focusList
      .filter((s) => s.source === 'manual')
      .reduce((sum, s) => sum + s.durationSeconds / 60, 0);
    const breakMinutes = breakList.reduce((sum, s) => sum + s.durationSeconds / 60, 0);
    const totalMinutes = focusMinutes + breakMinutes;
    const focusSharePct = totalMinutes > 0 ? Math.round((focusMinutes / totalMinutes) * 100) : 0;

    const countdownFocusMin = focusList
      .filter((s) => s.mode === 'countdown')
      .reduce((sum, s) => sum + s.durationSeconds / 60, 0);
    const countupFocusMin = focusList
      .filter((s) => s.mode === 'countup')
      .reduce((sum, s) => sum + s.durationSeconds / 60, 0);
    const countdownCount = focusList.filter((s) => s.mode === 'countdown').length;
    const countupCount = focusList.filter((s) => s.mode === 'countup').length;

    const timeBlocks = [
      { label: 'Night (00–06)', minutes: 0, count: 0 },
      { label: 'Morning (06–12)', minutes: 0, count: 0 },
      { label: 'Afternoon (12–18)', minutes: 0, count: 0 },
      { label: 'Evening (18–24)', minutes: 0, count: 0 },
    ];
    const hourHistogram = Array.from({ length: 24 }, () => 0);
    const hourDepthSum = Array.from({ length: 24 }, () => 0);
    const hourDepthCount = Array.from({ length: 24 }, () => 0);

    let totalDistractions = 0;
    let ratedFocusSum = 0;
    let ratedFocusCount = 0;
    let presenceConfirmed = 0;
    let presenceMissed = 0;

    const urgeTiming = { early: 0, mid: 0, late: 0 };

    focusList.forEach((s) => {
      const hr = new Date(s.completedAt).getHours();
      const mins = s.durationSeconds / 60;
      hourHistogram[hr] += mins;
      const blockIdx = Math.min(3, Math.floor(hr / 6));
      timeBlocks[blockIdx].minutes += mins;
      timeBlocks[blockIdx].count += 1;

      if (s.presenceChecks) {
        presenceConfirmed += s.presenceChecks.confirmed;
        presenceMissed += s.presenceChecks.missed;
      }

      const urgeCount = s.distractions ?? 0;
      totalDistractions += urgeCount;
      if (s.urgeBuckets) {
        urgeTiming.early += s.urgeBuckets.early;
        urgeTiming.mid += s.urgeBuckets.mid;
        urgeTiming.late += s.urgeBuckets.late;
      } else if (urgeCount > 0) {
        urgeTiming.mid += urgeCount;
      }

      if (s.depthRating) {
        ratedFocusSum += s.depthRating;
        ratedFocusCount += 1;
        hourDepthSum[hr] += s.depthRating;
        hourDepthCount[hr] += 1;
      }
    });

    const hourAvgDepth = hourDepthSum.map((sum, hr) =>
      hourDepthCount[hr] > 0 ? sum / hourDepthCount[hr] : 0,
    );
    const distractionsPerHour =
      focusMinutes > 0 ? totalDistractions / (focusMinutes / 60) : 0;
    const avgDepthScore = ratedFocusCount > 0 ? ratedFocusSum / ratedFocusCount : 0;
    const presenceTotal = presenceConfirmed + presenceMissed;
    const presenceRatePct =
      presenceTotal > 0 ? Math.round((presenceConfirmed / presenceTotal) * 100) : null;

    let peakHour = -1;
    let peakHourMins = 0;
    hourHistogram.forEach((mins, hr) => {
      if (mins > peakHourMins) {
        peakHourMins = mins;
        peakHour = hr;
      }
    });

    const dailyFocusMap = new Map<string, number>();
    sessions.forEach((s) => {
      if (s.type !== 'focus') return;
      const key = toDayKey(new Date(s.completedAt));
      dailyFocusMap.set(key, (dailyFocusMap.get(key) || 0) + s.durationSeconds / 60);
    });

    const shieldedSet = new Set(xpState.shieldedDayKeys ?? []);
    const isDayActive = (key: string) => (dailyFocusMap.get(key) || 0) > 0 || shieldedSet.has(key);

    const today = startOfDay(new Date());
    const todayKey = toDayKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayKey = toDayKey(yesterday);

    let currentStreak = 0;
    const checkDate = new Date(today);
    if (!isDayActive(toDayKey(checkDate))) {
      checkDate.setDate(checkDate.getDate() - 1);
    }
    while (isDayActive(toDayKey(checkDate))) {
      currentStreak += 1;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    const sortedDayKeys = Array.from(
      new Set([...dailyFocusMap.keys(), ...(xpState.shieldedDayKeys ?? [])]),
    ).sort();
    let bestStreak = 0;
    let run = 0;
    let prevTime: number | null = null;
    sortedDayKeys.forEach((key) => {
      const t = new Date(`${key}T00:00:00`).getTime();
      if (prevTime !== null && Math.round((t - prevTime) / 86400000) === 1) {
        run += 1;
      } else {
        run = 1;
      }
      if (run > bestStreak) bestStreak = run;
      prevTime = t;
    });

    const shieldCandidateKey =
      (dailyFocusMap.get(yesterdayKey) || 0) <= 0 && !shieldedSet.has(yesterdayKey)
        ? yesterdayKey
        : !shieldedSet.has(todayKey)
          ? todayKey
          : null;
    const shieldCandidateLabel =
      shieldCandidateKey === yesterdayKey ? 'Yesterday' : shieldCandidateKey === todayKey ? 'Today' : null;

    const todayFocusMinutes = dailyFocusMap.get(todayKey) || 0;
    const yesterdayFocusMinutes = dailyFocusMap.get(yesterdayKey) || 0;
    const todayVsYesterdayPct =
      todayFocusMinutes <= 0 && yesterdayFocusMinutes <= 0
        ? null
        : yesterdayFocusMinutes <= 0
          ? 100
          : todayFocusMinutes <= 0
            ? -100
            : Math.round(
                ((todayFocusMinutes - yesterdayFocusMinutes) / yesterdayFocusMinutes) * 100,
              );
    const goalProgressPct = Math.min(
      100,
      Math.round((todayFocusMinutes / Math.max(1, settings.dailyGoalMinutes)) * 100),
    );

    const heatmapDays = Array.from({ length: 28 }, (_, idx) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (27 - idx));
      const key = toDayKey(d);
      const mins = dailyFocusMap.get(key) || 0;
      return {
        key,
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        minutes: mins,
        shielded: shieldedSet.has(key),
      };
    });

    const rhythmTargetDate =
      range === 'daily'
        ? (() => {
            const d = startOfDay(new Date());
            d.setDate(d.getDate() + offset);
            return d;
          })()
        : today;
    const rhythmDayStart = rhythmTargetDate.getTime();
    const rhythmDayEnd = rhythmDayStart + 86400000;
    const rhythmSegments = sessions
      .filter((s) => {
        const end = new Date(s.completedAt).getTime();
        return end > rhythmDayStart && end <= rhythmDayEnd;
      })
      .map((s) => {
        const end = new Date(s.completedAt).getTime();
        const start = Math.max(rhythmDayStart, end - s.durationSeconds * 1000);
        const startPct = ((start - rhythmDayStart) / 86400000) * 100;
        const widthPct = Math.max(0.75, ((end - start) / 86400000) * 100);
        return {
          id: s.id,
          type: s.type,
          mode: s.mode,
          durationMinutes: Math.round(s.durationSeconds / 60),
          startPct,
          widthPct,
          timeLabel: `${new Date(start).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })} – ${new Date(end).toLocaleTimeString(undefined, {
            hour: '2-digit',
            minute: '2-digit',
          })}`,
        };
      });

    const maxHourMins = Math.max(15, ...hourHistogram);

    return {
      focusMinutes,
      measuredFocusMinutes,
      manualFocusMinutes,
      breakMinutes,
      focusSessions: focusList.length,
      breakSessions: breakList.length,
      focusSharePct,
      countdownFocusMin,
      countupFocusMin,
      countdownCount,
      countupCount,
      timeBlocks,
      hourHistogram,
      hourAvgDepth,
      maxHourMins,
      peakHour,
      totalDistractions,
      urgeTiming,
      distractionsPerHour,
      avgDepthScore,
      presenceConfirmed,
      presenceTotal,
      presenceRatePct,
      currentStreak,
      bestStreak,
      shieldCandidateKey,
      shieldCandidateLabel,
      todayFocusMinutes,
      yesterdayFocusMinutes,
      todayVsYesterdayPct,
      goalProgressPct,
      heatmapDays,
      rhythmDateLabel: formatDateLabel(rhythmTargetDate),
      rhythmSegments,
    };
  }, [currentDayKey, offset, periodSessions, range, sessions, settings.dailyGoalMinutes, xpState.shieldedDayKeys]);

  const filteredLedger = useMemo(() => {
    return periodSessions.filter((s) => {
      if (ledgerFilter === 'all') return true;
      if (ledgerFilter === 'focus' || ledgerFilter === 'break') return s.type === ledgerFilter;
      return s.mode === ledgerFilter;
    });
  }, [periodSessions, ledgerFilter]);

  const todayDebrief = useMemo(() => {
    const todayStart = startOfDay(new Date()).getTime();
    const todayEnd = todayStart + 86400000;
    const todayFocus = sessions.filter((s) => {
      const t = new Date(s.completedAt).getTime();
      return s.type === 'focus' && t >= todayStart && t < todayEnd;
    });
    const todayBreak = sessions.filter((s) => {
      const t = new Date(s.completedAt).getTime();
      return s.type === 'break' && t >= todayStart && t < todayEnd;
    });
    const focusMin = todayFocus.reduce((acc, s) => acc + s.durationSeconds / 60, 0);
    const breakMin = todayBreak.reduce((acc, s) => acc + s.durationSeconds / 60, 0);
    const zeroUrgeCount = todayFocus.filter((s) => (s.distractions ?? 0) === 0).length;
    const purityPct =
      todayFocus.length > 0 ? Math.round((zeroUrgeCount / todayFocus.length) * 100) : 0;
    const urgesToday = todayFocus.reduce((acc, s) => acc + (s.distractions ?? 0), 0);
    const xpToday = todayFocus.reduce((acc, s) => acc + (s.xpEarned ?? 0), 0);
    return {
      focusCount: todayFocus.length,
      focusMin,
      breakMin,
      purityPct,
      urgesToday,
      xpToday,
    };
  }, [currentDayKey, sessions]);

  const handleCopyDebrief = async () => {
    const summary = [
      `Monolith Pomodoro — Daily Debrief (${new Date().toLocaleDateString()})`,
      `Rank: ${monolithRank.name} (${xpState.totalXp} XP)`,
      `Focused: ${formatDurationMinutes(todayDebrief.focusMin)} across ${todayDebrief.focusCount} blocks (${deepMetrics.goalProgressPct}% of ${formatDurationMinutes(settings.dailyGoalMinutes)} goal)`,
      `Recovery Breaks: ${formatDurationMinutes(todayDebrief.breakMin)}`,
      `Zero-Urge Purity: ${todayDebrief.purityPct}% (${todayDebrief.urgesToday} urges logged)`,
      `Personal Peak Hour: ${globalPeakHour !== null ? `${String(globalPeakHour).padStart(2, '0')}:00` : 'Building baseline'}`,
      `Streak: ${deepMetrics.currentStreak}d`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(summary);
      setDebriefCopied(true);
      window.setTimeout(() => setDebriefCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleSubmitStudiedTime = () => {
    if (!onAddStudiedSession) return;
    const cleanMin = Math.max(1, Math.min(720, Math.round(studiedMinutes) || 1));
    const datePart = studiedDate || currentDayKey || toDayKey(new Date());
    const timePart = studiedTime || '12:00';
    const parsed = new Date(`${datePart}T${timePart}:00`);
    const iso = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    onAddStudiedSession(cleanMin, iso);
    setShowAddStudied(false);
    setStudiedFeedback(`Added ${formatDurationMinutes(cleanMin)} studied time`);
    window.setTimeout(() => setStudiedFeedback(null), 2600);
  };

  const handleExportCsv = () => {
    const header = [
      'id',
      'type',
      'mode',
      'source',
      'duration_minutes',
      'distractions',
      'depth_rating',
      'presence_confirmed',
      'presence_missed',
      'xp_earned',
      'completed_at',
    ];
    const rows = sessions.map((s) => [
      s.id,
      s.type,
      s.mode,
      s.source ?? 'timer',
      (s.durationSeconds / 60).toFixed(2),
      s.distractions ?? 0,
      s.depthRating ?? '',
      s.presenceChecks?.confirmed ?? 0,
      s.presenceChecks?.missed ?? 0,
      s.xpEarned ?? 0,
      s.completedAt,
    ]);
    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monolith-pomodoro-sessions-${toDayKey(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Chart Dimensions (1:1 Native Responsive Scale + Wide Dominant Monochrome Bars)
  const maxMinutesRaw = Math.max(
    15,
    ...buckets.map((b) => Math.max(b.focusMinutes, b.breakMinutes)),
  );
  const stepUnit =
    maxMinutesRaw <= 25 ? 5 : maxMinutesRaw <= 90 ? 15 : maxMinutesRaw <= 240 ? 30 : 60;
  const chartMax = Math.ceil(maxMinutesRaw / stepUnit) * stepUnit;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => Math.round(chartMax * r));

  const svgWidth = Math.max(300, chartContainerWidth);
  const isNarrowChart = svgWidth < 540;
  const svgHeight = isNarrowChart ? 360 : 450;
  const padLeft = isNarrowChart ? 42 : 50;
  const padRight = 10;
  const padTop = 58;
  const padBottom = range === 'weekly' && !isNarrowChart ? 48 : 40;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;
  const slotW = plotW / buckets.length;
  const hasAnyBreaks = deepMetrics.breakMinutes > 0;

  const focusBarW = hasAnyBreaks
    ? range === 'monthly'
      ? Math.max(5, Math.floor(slotW * 0.5))
      : Math.min(64, Math.max(16, Math.floor(slotW * 0.54)))
    : range === 'monthly'
      ? Math.max(7, Math.floor(slotW * 0.78))
      : Math.min(92, Math.max(22, Math.floor(slotW * 0.74)));

  const breakBarW = hasAnyBreaks
    ? range === 'monthly'
      ? Math.max(3, Math.floor(slotW * 0.28))
      : Math.min(34, Math.max(10, Math.floor(slotW * 0.28)))
    : 0;

  const barGap = hasAnyBreaks ? (range === 'monthly' ? 1.5 : Math.max(4, Math.round(slotW * 0.06))) : 0;

  const bucketDeltas = useMemo(() => {
    return buckets.map((b, idx) => {
      const prev = idx === 0 ? prevLeadingFocusMinutes : buckets[idx - 1].focusMinutes;
      const curr = b.focusMinutes;
      if (curr <= 0 && prev <= 0) return null;
      if (prev <= 0 && curr > 0) return 100;
      if (prev > 0 && curr <= 0) return -100;
      return Math.round(((curr - prev) / prev) * 100);
    });
  }, [buckets, prevLeadingFocusMinutes]);

  const periodDeltaPct = useMemo(() => {
    const curr = deepMetrics.focusMinutes;
    const prev = prevPeriodFocusMinutes;
    if (curr <= 0 && prev <= 0) return null;
    if (prev <= 0 && curr > 0) return 100;
    if (prev > 0 && curr <= 0) return -100;
    return Math.round(((curr - prev) / prev) * 100);
  }, [deepMetrics.focusMinutes, prevPeriodFocusMinutes]);

  const peakBucketIdx = useMemo(() => {
    let bestIdx = -1;
    let bestVal = 0;
    buckets.forEach((b, i) => {
      if (b.focusMinutes > bestVal) {
        bestVal = b.focusMinutes;
        bestIdx = i;
      }
    });
    return bestIdx;
  }, [buckets]);

  const isDark = theme === 'dark';
  const inkColor = isDark ? '#ffffff' : '#000000';
  const invertedInk = isDark ? '#000000' : '#ffffff';
  const gridColor = isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)';
  const subtleInk = isDark ? 'rgba(255,255,255,0.78)' : 'rgba(0,0,0,0.75)';
  const hatchPatternId = isDark ? 'break-hatch-page-dark' : 'break-hatch-page-light';
  const manualPatternId = isDark ? 'manual-stripe-page-dark' : 'manual-stripe-page-light';

  const getFocusBarX = (idx: number) => {
    const centerX = padLeft + idx * slotW + slotW / 2;
    if (!hasAnyBreaks) return centerX - focusBarW / 2;
    const groupW = focusBarW + barGap + breakBarW;
    return centerX - groupW / 2;
  };

  const trendPathD = useMemo(() => {
    const pts = buckets.map((b, idx) => {
      const centerX = padLeft + idx * slotW + slotW / 2;
      const focusX = hasAnyBreaks
        ? centerX - (focusBarW + barGap + breakBarW) / 2
        : centerX - focusBarW / 2;
      const focusCenterX = focusX + focusBarW / 2;
      const focusH = (b.focusMinutes / chartMax) * plotH;
      const y = focusH > 0 ? padTop + plotH - Math.max(8, focusH) : padTop + plotH;
      return `${idx === 0 ? 'M' : 'L'}${focusCenterX.toFixed(1)},${y.toFixed(1)}`;
    });
    return pts.join(' ');
  }, [barGap, breakBarW, buckets, chartMax, focusBarW, hasAnyBreaks, padLeft, padTop, plotH, slotW]);

  return (
    <div className="min-h-dvh w-full overflow-x-hidden bg-white dark:bg-black text-black dark:text-white transition-colors duration-200">
      {/* Clean High-Contrast 3-Zone Header */}
      <header className="border-b-2 border-black dark:border-white pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-xs font-bold ${bwSolidBtn}`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </button>

          <h1 className="min-w-0 truncate text-base sm:text-lg font-bold tracking-tight">
            <span className="sm:hidden">Analytics</span>
            <span className="hidden sm:inline">Deep Focus Analytics</span>
          </h1>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={sessions.length === 0}
              onClick={handleExportCsv}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-xs font-bold rounded-lg disabled:opacity-35 disabled:cursor-not-allowed ${bwSolidBtn}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg ${bwSolidBtn}`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-6 sm:py-9 pb-[max(2rem,env(safe-area-inset-bottom))] space-y-7">
        {/* Control Toolbar: Range Pill, Period Navigation & Clear Logs */}
        <div className="flex flex-wrap items-center justify-between gap-3.5 pb-5 border-b-2 border-black/15 dark:border-white/20">
          <div className="inline-flex p-1 rounded-xl border-2 border-black dark:border-white bg-white dark:bg-black">
            {(
              [
                { id: 'daily', label: 'Daily' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'monthly', label: '30 Days' },
              ] as { id: AnalyticsRange; label: string }[]
            ).map((item) => {
              const active = range === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setRange(item.id);
                    setOffset(0);
                    setHoveredIndex(null);
                  }}
                  className={`relative px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-white dark:text-black'
                      : 'text-black dark:text-white hover:opacity-70'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="analytics-range-pill"
                      transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                      className="absolute inset-0 rounded-lg bg-black dark:bg-white"
                    />
                  )}
                  <span className="relative z-10">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOffset((v) => v - 1);
                setHoveredIndex(null);
              }}
              aria-label="Previous period"
              className={`w-9 h-9 inline-flex items-center justify-center rounded-lg ${bwSolidBtn}`}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="min-w-0 sm:min-w-[144px] px-1 text-center text-xs sm:text-sm font-bold font-mono-tabular">
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={() => {
                setOffset((v) => Math.min(0, v + 1));
                setHoveredIndex(null);
              }}
              disabled={offset >= 0}
              aria-label="Next period"
              className={`w-9 h-9 inline-flex items-center justify-center rounded-lg disabled:opacity-30 disabled:pointer-events-none ${bwSolidBtn}`}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {offset < 0 && (
              <button
                type="button"
                onClick={() => {
                  setOffset(0);
                  setHoveredIndex(null);
                }}
                className={`px-3 py-2 text-xs font-bold rounded-lg ${bwSolidBtn}`}
              >
                Latest
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={sessions.length === 0}
              onClick={onClearHistory}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg disabled:opacity-35 disabled:cursor-not-allowed ${bwSolidBtn}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Logs</span>
            </button>
          </div>
        </div>

        {/* 1. MAIN HERO VISUALIZATION: Full-Width Animated Bar Chart with Hours+Min Readouts & % Badges */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0 rounded-2xl border-2 border-black dark:border-white bg-white dark:bg-black p-4 sm:p-6 space-y-4 shadow-[0_18px_48px_rgba(0,0,0,0.06)] dark:shadow-[0_18px_48px_rgba(255,255,255,0.05)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-3.5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  Studied Time vs. Break Sessions
                </h2>
                {periodDeltaPct !== null && (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold font-mono-tabular border-2 border-black dark:border-white ${
                      periodDeltaPct >= 0
                        ? 'bg-black text-white dark:bg-white dark:text-black'
                        : 'bg-white text-black dark:bg-black dark:text-white'
                    }`}
                  >
                    <span>
                      {periodDeltaPct > 0
                        ? `▲ +${periodDeltaPct}%`
                        : periodDeltaPct < 0
                          ? `▼ ${periodDeltaPct}%`
                          : '— 0%'}
                    </span>
                    <span className="opacity-75 font-sans font-semibold">
                      vs prev {range === 'daily' ? 'day' : range === 'weekly' ? 'week' : '30d'}
                    </span>
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-black/75 dark:text-white/80 mt-1">
                {range === 'daily'
                  ? 'Fresh daily time by 2-hour slots · Counts in hours above 60m'
                  : range === 'weekly'
                    ? 'Monday through Sunday combined studied total · ▲/▼ % day-over-day'
                    : '30-day rolling combined volume · Tap or hover any bar for % delta'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {onAddStudiedSession && (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowAddStudied((prev) => !prev)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg ${
                    showAddStudied ? bwOptionBtn(false) : bwSolidBtn
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showAddStudied ? 'Close Form' : 'Add Studied Time'}</span>
                </motion.button>
              )}

              <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block w-3.5 h-3.5 bg-black dark:bg-white border border-black dark:border-white rounded-[3px]" />
                  <span>Measured ({formatDurationMinutes(deepMetrics.measuredFocusMinutes)})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-3.5 h-3.5 border-2 border-black dark:border-white rounded-[3px]"
                    style={{
                      backgroundImage: isDark
                        ? 'repeating-linear-gradient(0deg, #ffffff, #ffffff 2px, transparent 2px, transparent 5px)'
                        : 'repeating-linear-gradient(0deg, #000000, #000000 2px, transparent 2px, transparent 5px)',
                    }}
                  />
                  <span>Added ({formatDurationMinutes(deepMetrics.manualFocusMinutes)})</span>
                </div>
                {hasAnyBreaks && (
                  <div className="flex items-center gap-1.5">
                    <span
                      className="inline-block w-3.5 h-3.5 border-2 border-black dark:border-white rounded-[3px]"
                      style={{
                        backgroundImage: isDark
                          ? 'repeating-linear-gradient(-45deg, #ffffff, #ffffff 1.5px, transparent 1.5px, transparent 4.5px)'
                          : 'repeating-linear-gradient(-45deg, #000000, #000000 1.5px, transparent 1.5px, transparent 4.5px)',
                      }}
                    />
                    <span>Breaks ({formatDurationMinutes(deepMetrics.breakMinutes)})</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {studiedFeedback && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black px-3.5 py-2 text-xs font-bold flex items-center justify-between"
              >
                <span>{studiedFeedback}</span>
                <span>Combined in Chart</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {showAddStudied && onAddStudiedSession && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="rounded-xl border-2 border-black dark:border-white p-4 space-y-4 bg-white dark:bg-black">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold">Add Already Studied Time</h3>
                      <p className="text-xs text-black/75 dark:text-white/80">
                        Stacks directly onto your measured focus bars in the chart.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[15, 30, 45, 60, 90, 120].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setStudiedMinutes(preset)}
                          className={`px-2.5 py-1 text-xs rounded-lg font-mono-tabular ${bwOptionBtn(
                            studiedMinutes === preset,
                          )}`}
                        >
                          {formatDurationMinutes(preset)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5">
                        Duration ({formatDurationMinutes(studiedMinutes)})
                      </label>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Decrease studied minutes"
                          onClick={() => setStudiedMinutes((v) => Math.max(1, v - 5))}
                          className={`w-9 h-9 inline-flex items-center justify-center rounded-lg ${bwSolidBtn}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={720}
                          value={studiedMinutes}
                          onChange={(e) =>
                            setStudiedMinutes(
                              Math.max(1, Math.min(720, Number(e.target.value) || 1)),
                            )
                          }
                          className="min-w-0 flex-1 h-9 px-2.5 rounded-lg border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white text-center text-sm font-bold font-mono-tabular"
                        />
                        <button
                          type="button"
                          aria-label="Increase studied minutes"
                          onClick={() => setStudiedMinutes((v) => Math.min(720, v + 5))}
                          className={`w-9 h-9 inline-flex items-center justify-center rounded-lg ${bwSolidBtn}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold uppercase tracking-wider">
                          Date
                        </label>
                        <div className="flex items-center gap-2 text-[11px] font-bold">
                          <button
                            type="button"
                            onClick={() => setStudiedDate(toDayKey(new Date()))}
                            className="underline cursor-pointer"
                          >
                            Today
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const y = new Date();
                              y.setDate(y.getDate() - 1);
                              setStudiedDate(toDayKey(y));
                            }}
                            className="underline cursor-pointer"
                          >
                            Yesterday
                          </button>
                        </div>
                      </div>
                      <input
                        type="date"
                        value={studiedDate}
                        max={toDayKey(new Date())}
                        onChange={(e) => setStudiedDate(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-lg border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white text-xs font-bold font-mono-tabular"
                      />
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[110px]">
                        <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5">
                          Time
                        </label>
                        <input
                          type="time"
                          value={studiedTime}
                          onChange={(e) => setStudiedTime(e.target.value)}
                          className="w-full h-9 px-2.5 rounded-lg border-2 border-black dark:border-white bg-white dark:bg-black text-black dark:text-white text-xs font-bold font-mono-tabular"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSubmitStudiedTime}
                        className={`h-9 px-4 text-xs font-bold rounded-lg ${bwSolidBtn}`}
                      >
                        Add to Chart
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={chartContainerRef} className="relative w-full">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="block w-full h-auto"
              role="img"
              aria-label="Main bar chart comparing studied time and break sessions with percentage change badges"
            >
              <defs>
                <pattern
                  id={hatchPatternId}
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="6"
                    stroke={inkColor}
                    strokeWidth="2.2"
                  />
                </pattern>
                <pattern
                  id={manualPatternId}
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                >
                  <rect width="6" height="6" fill={invertedInk} />
                  <line
                    x1="0"
                    y1="2"
                    x2="6"
                    y2="2"
                    stroke={inkColor}
                    strokeWidth="2.4"
                  />
                </pattern>
              </defs>

              {/* Horizontal Gridlines & Y-Axis (Counts in Hours when >= 60m) */}
              {yTicks.map((val) => {
                const y = padTop + plotH - (val / chartMax) * plotH;
                return (
                  <g key={val}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke={val === 0 ? inkColor : gridColor}
                      strokeWidth={val === 0 ? 2.2 : 1}
                      strokeDasharray={val === 0 ? undefined : '3 5'}
                    />
                    <text
                      x={padLeft - 7}
                      y={y + 4}
                      textAnchor="end"
                      fill={subtleInk}
                      fontSize={isNarrowChart ? '11' : '12'}
                      fontWeight="700"
                      fontFamily="var(--font-mono)"
                    >
                      {formatAxisTick(val)}
                    </text>
                  </g>
                );
              })}

              {/* Animated Trajectory Line connecting Studied Bar Crowns */}
              {deepMetrics.focusMinutes > 0 && (
                <motion.path
                  key={`trend-${range}-${offset}`}
                  d={trendPathD}
                  fill="none"
                  stroke={inkColor}
                  strokeWidth="1.85"
                  strokeDasharray="4 4"
                  initial={{ pathLength: 0, strokeOpacity: 0 }}
                  animate={{ pathLength: 1, strokeOpacity: 0.3 }}
                  transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
                />
              )}

              {buckets.map((bucket, idx) => {
                const centerX = padLeft + idx * slotW + slotW / 2;
                const focusH = (bucket.focusMinutes / chartMax) * plotH;
                const breakH = (bucket.breakMinutes / chartMax) * plotH;
                const focusX = getFocusBarX(idx);
                const breakX = focusX + focusBarW + barGap;
                const baseY = padTop + plotH;
                const isHovered = hoveredIndex === idx;

                const renderedFocusH = focusH > 0 ? Math.max(12, focusH) : 0;
                const renderedBreakH = breakH > 0 ? Math.max(10, breakH) : 0;
                const focusBarY = focusH > 0 ? baseY - renderedFocusH : baseY;

                const measuredRatio =
                  bucket.focusMinutes > 0 ? bucket.measuredMinutes / bucket.focusMinutes : 1;
                const measuredPartH =
                  bucket.measuredMinutes > 0
                    ? bucket.manualMinutes > 0
                      ? Math.max(4, Math.round(renderedFocusH * measuredRatio))
                      : renderedFocusH
                    : 0;
                const manualPartH = Math.max(0, renderedFocusH - measuredPartH);
                const manualBarY = focusBarY;
                const measuredBarY = baseY - measuredPartH;

                const durationStr = formatDurationMinutes(bucket.focusMinutes);
                const showInsideMeasured =
                  range !== 'monthly' &&
                  bucket.focusMinutes >= 1 &&
                  measuredPartH >= 28 &&
                  focusBarW >= (durationStr.length > 3 ? 42 : 30);
                const showInsideManualPill =
                  range !== 'monthly' &&
                  bucket.focusMinutes >= 1 &&
                  !showInsideMeasured &&
                  measuredPartH < 28 &&
                  manualPartH >= 30 &&
                  focusBarW >= 40;
                const showAboveBarLabel =
                  range !== 'monthly' &&
                  bucket.focusMinutes >= 1 &&
                  !showInsideMeasured &&
                  !showInsideManualPill;

                const delta = bucketDeltas[idx];
                const showDeltaInsideGraph =
                  delta !== null &&
                  (range !== 'monthly' || isHovered || idx === peakBucketIdx);

                const isPositive = (delta ?? 0) > 0;
                const isNegative = (delta ?? 0) < 0;
                const deltaText =
                  delta === null
                    ? ''
                    : isPositive
                      ? `▲ +${delta}%`
                      : isNegative
                        ? `▼ ${delta}%`
                        : '0%';

                const badgeWidth = Math.max(isNarrowChart ? 42 : 50, deltaText.length * 6.8 + 12);
                const badgeHeight = 22;
                const breakBarY = breakH > 0 ? baseY - renderedBreakH : baseY;
                const anchorTopY = focusH > 0 ? focusBarY : breakBarY;
                const badgeCenterX = focusH > 0 ? focusX + focusBarW / 2 : centerX;
                const clampedBadgeX = Math.max(
                  padLeft + badgeWidth / 2,
                  Math.min(svgWidth - padRight - badgeWidth / 2, badgeCenterX),
                );
                const badgeOffset = showAboveBarLabel ? 24 : 10;
                const badgeBottomY = Math.max(padTop - 8, anchorTopY - badgeOffset);
                const badgeTopY = badgeBottomY - badgeHeight;

                const barOpacity = hoveredIndex === null || isHovered ? 1 : 0.58;
                const barRadius = range === 'monthly' ? 2 : 5;
                const barAnimDelay = Math.min(idx * 0.035, 0.28);

                return (
                  <g
                    key={`${range}-${offset}-${bucket.key}`}
                    onMouseEnter={() => setHoveredIndex(idx)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => setHoveredIndex(hoveredIndex === idx ? null : idx)}
                    className="cursor-pointer"
                  >
                    {/* Subtle Full-Height Column Slot Guide */}
                    <rect
                      x={padLeft + idx * slotW + 2}
                      y={padTop}
                      width={Math.max(4, slotW - 4)}
                      height={plotH}
                      rx="6"
                      fill={inkColor}
                      fillOpacity={isHovered ? 0.08 : range !== 'monthly' ? 0.035 : 0}
                    />

                    {/* Animated Solid Measured Focus Segment (Bottom) */}
                    {measuredPartH > 0 && (
                      <motion.rect
                        x={focusX}
                        width={focusBarW}
                        rx={manualPartH > 0 ? 0 : barRadius}
                        fill={inkColor}
                        fillOpacity={barOpacity}
                        initial={{ y: baseY, height: 0 }}
                        animate={{ y: measuredBarY, height: measuredPartH }}
                        transition={{ duration: 0.52, delay: barAnimDelay, ease: [0.16, 1, 0.3, 1] }}
                      />
                    )}

                    {/* Animated Added Studied Time Segment (Stacked Top) */}
                    {manualPartH > 0 && (
                      <motion.rect
                        x={focusX}
                        width={focusBarW}
                        rx={barRadius}
                        fill={`url(#${manualPatternId})`}
                        fillOpacity={barOpacity}
                        stroke={inkColor}
                        strokeWidth={range === 'monthly' ? 1.2 : 2}
                        initial={{ y: baseY, height: 0 }}
                        animate={{ y: manualBarY, height: manualPartH }}
                        transition={{
                          duration: 0.52,
                          delay: barAnimDelay + 0.05,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      />
                    )}

                    {/* Divider line when Measured + Added stack in the same bar */}
                    {measuredPartH > 0 && manualPartH > 0 && (
                      <line
                        x1={focusX}
                        y1={measuredBarY}
                        x2={focusX + focusBarW}
                        y2={measuredBarY}
                        stroke={inkColor}
                        strokeWidth="2"
                      />
                    )}

                    {/* Bold Duration Readout Inside Tall Measured Bars (Hours if >60m) */}
                    {showInsideMeasured && (
                      <text
                        x={focusX + focusBarW / 2}
                        y={measuredBarY + 18}
                        textAnchor="middle"
                        fill={invertedInk}
                        fontSize={isNarrowChart ? '10.5' : '12'}
                        fontWeight="800"
                        fontFamily="var(--font-mono)"
                      >
                        {durationStr}
                      </text>
                    )}

                    {/* Inverted Duration Pill Inside Tall Manual-Only Bars */}
                    {showInsideManualPill && (
                      <g>
                        <rect
                          x={focusX + focusBarW / 2 - Math.min(focusBarW / 2 - 2, 22)}
                          y={manualBarY + 5}
                          width={Math.min(focusBarW - 4, 44)}
                          height={18}
                          rx="4"
                          fill={inkColor}
                        />
                        <text
                          x={focusX + focusBarW / 2}
                          y={manualBarY + 14}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={invertedInk}
                          fontSize={isNarrowChart ? '10' : '11'}
                          fontWeight="800"
                          fontFamily="var(--font-mono)"
                        >
                          {durationStr}
                        </text>
                      </g>
                    )}

                    {/* High-Visibility Time Label Above Shorter/Narrow Bars */}
                    {showAboveBarLabel && (
                      <text
                        x={focusX + focusBarW / 2}
                        y={focusBarY - 6}
                        textAnchor="middle"
                        fill={inkColor}
                        fontSize={isNarrowChart ? '10' : '11.5'}
                        fontWeight="800"
                        fontFamily="var(--font-mono)"
                      >
                        {durationStr}
                      </text>
                    )}

                    {/* Hatched Break Bar (shown when breaks exist) */}
                    {hasAnyBreaks &&
                      (breakH > 0 ? (
                        <motion.rect
                          x={breakX}
                          width={breakBarW}
                          rx={range === 'monthly' ? 2 : 4}
                          fill={`url(#${hatchPatternId})`}
                          stroke={inkColor}
                          strokeWidth="1.8"
                          strokeOpacity={barOpacity}
                          initial={{ y: baseY, height: 0 }}
                          animate={{ y: breakBarY, height: renderedBreakH }}
                          transition={{
                            duration: 0.48,
                            delay: barAnimDelay + 0.04,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                        />
                      ) : (
                        <rect
                          x={breakX}
                          y={baseY - 2}
                          width={breakBarW}
                          height={2}
                          fill={inkColor}
                          fillOpacity="0.18"
                        />
                      ))}

                    {/* Trajectory Anchor Dot on Studied Bar Crown */}
                    {focusH > 0 && (
                      <circle
                        cx={focusX + focusBarW / 2}
                        cy={focusBarY}
                        r={isHovered ? 4.5 : 3.2}
                        fill={invertedInk}
                        stroke={inkColor}
                        strokeWidth="2"
                      />
                    )}

                    {/* Crisp Monochrome % Increase/Decrease Indicator Inside the Graph */}
                    {showDeltaInsideGraph && (
                      <motion.g
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: barAnimDelay + 0.14 }}
                      >
                        {focusH > 0 && !showAboveBarLabel && (
                          <line
                            x1={focusX + focusBarW / 2}
                            y1={badgeBottomY}
                            x2={focusX + focusBarW / 2}
                            y2={focusBarY - 3}
                            stroke={inkColor}
                            strokeOpacity="0.45"
                            strokeWidth="1.2"
                          />
                        )}
                        <rect
                          x={clampedBadgeX - badgeWidth / 2}
                          y={badgeTopY}
                          width={badgeWidth}
                          height={badgeHeight}
                          rx="5"
                          fill={isPositive ? inkColor : isDark ? '#000000' : '#ffffff'}
                          stroke={inkColor}
                          strokeWidth="1.5"
                        />
                        <text
                          x={clampedBadgeX}
                          y={badgeTopY + badgeHeight / 2 + 0.5}
                          textAnchor="middle"
                          dominantBaseline="central"
                          fill={isPositive ? invertedInk : inkColor}
                          fontSize={isNarrowChart ? '9.5' : '10.5'}
                          fontWeight="800"
                          fontFamily="var(--font-mono)"
                        >
                          {deltaText}
                        </text>
                      </motion.g>
                    )}

                    {/* X-Axis Labels */}
                    {bucket.label && (
                      <text
                        x={centerX}
                        y={baseY + 21}
                        textAnchor="middle"
                        fill={isHovered ? inkColor : subtleInk}
                        fontSize={isNarrowChart && range === 'daily' ? '10' : '12'}
                        fontWeight="700"
                        fontFamily="var(--font-sans)"
                      >
                        {isNarrowChart && range === 'daily' && idx % 2 === 1
                          ? ''
                          : bucket.label}
                      </text>
                    )}
                    {range === 'weekly' && !isNarrowChart && bucket.subLabel && (
                      <text
                        x={centerX}
                        y={baseY + 38}
                        textAnchor="middle"
                        fill={subtleInk}
                        fontSize="10.5"
                        fontFamily="var(--font-mono)"
                      >
                        {bucket.subLabel}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            {periodSessions.length === 0 && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
                <div className="pointer-events-auto rounded-xl border-2 border-black dark:border-white bg-white dark:bg-black px-5 py-3 text-xs font-bold text-center shadow-[0_12px_32px_rgba(0,0,0,0.08)] dark:shadow-[0_12px_32px_rgba(255,255,255,0.06)] space-y-2.5">
                  <div>No logs in this window yet — complete a focus session or add studied time</div>
                  {onAddStudiedSession && (
                    <button
                      type="button"
                      onClick={() => setShowAddStudied(true)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg ${bwSolidBtn}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Studied Time</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div
              className={`mt-2 min-h-[42px] flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-xl border-2 border-black dark:border-white text-xs transition-colors ${
                hoveredIndex !== null && buckets[hoveredIndex]
                  ? 'bg-black text-white dark:bg-white dark:text-black'
                  : 'bg-white text-black dark:bg-black dark:text-white'
              }`}
            >
              {hoveredIndex !== null && buckets[hoveredIndex] ? (
                <>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-bold">
                      {buckets[hoveredIndex].label || buckets[hoveredIndex].subLabel}
                      {buckets[hoveredIndex].label && buckets[hoveredIndex].subLabel
                        ? ` · ${buckets[hoveredIndex].subLabel}`
                        : ''}
                    </span>
                    {bucketDeltas[hoveredIndex] !== null && (
                      <span className="font-mono-tabular font-extrabold px-2 py-0.5 rounded border border-current">
                        {bucketDeltas[hoveredIndex]! > 0
                          ? `▲ +${bucketDeltas[hoveredIndex]}%`
                          : bucketDeltas[hoveredIndex]! < 0
                            ? `▼ ${bucketDeltas[hoveredIndex]}%`
                            : '0%'}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 font-mono-tabular">
                    <span>
                      Studied:{' '}
                      <strong>{formatDurationMinutes(buckets[hoveredIndex].focusMinutes)}</strong>
                      {buckets[hoveredIndex].manualMinutes > 0
                        ? ` (${formatDurationMinutes(buckets[hoveredIndex].measuredMinutes)} measured + ${formatDurationMinutes(buckets[hoveredIndex].manualMinutes)} added)`
                        : ` (${buckets[hoveredIndex].focusCount})`}
                    </span>
                    <span>
                      Breaks:{' '}
                      <strong>{formatDurationMinutes(buckets[hoveredIndex].breakMinutes)}</strong> (
                      {buckets[hoveredIndex].breakCount})
                    </span>
                  </div>
                </>
              ) : (
                <span className="font-medium text-black/75 dark:text-white/80">
                  Tap or hover any bar to inspect measured + added studied time and % change.
                </span>
              )}
            </div>
          </div>
        </motion.section>

        {/* 2. High-Contrast 4-Card KPI Strip (with Today's Fresh Daily Counter First) */}
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          {/* Primary Inverted High-Contrast Hero Metric: Today's Fresh Measurement */}
          <div className="min-w-0 rounded-2xl border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black p-4 sm:p-5 flex flex-col justify-between gap-2">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-bold uppercase tracking-wider opacity-85">
                Today&apos;s Studied
              </span>
              {deepMetrics.todayVsYesterdayPct !== null && (
                <span className="text-[11px] font-bold font-mono-tabular px-1.5 py-0.5 rounded border border-current">
                  {deepMetrics.todayVsYesterdayPct > 0
                    ? `▲ +${deepMetrics.todayVsYesterdayPct}%`
                    : deepMetrics.todayVsYesterdayPct < 0
                      ? `▼ ${deepMetrics.todayVsYesterdayPct}%`
                      : '0%'}
                </span>
              )}
            </div>
            <div className="text-3xl sm:text-4xl font-bold font-mono-tabular">
              {formatDurationMinutes(deepMetrics.todayFocusMinutes)}
            </div>
            <div className="space-y-1.5">
              <div className="text-xs font-mono-tabular opacity-85">
                {deepMetrics.todayFocusMinutes > 0
                  ? `${deepMetrics.goalProgressPct}% of ${formatDurationMinutes(settings.dailyGoalMinutes)} goal`
                  : `Fresh day · Goal ${formatDurationMinutes(settings.dailyGoalMinutes)}`}
              </div>
              <div className="h-1.5 w-full rounded-full border border-current p-px overflow-hidden">
                <motion.div
                  className="h-full bg-white dark:bg-black rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${deepMetrics.goalProgressPct}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border-2 border-black dark:border-white bg-white dark:bg-black p-4 sm:p-5 flex flex-col justify-between gap-2">
            <div className="text-xs font-bold uppercase tracking-wider text-black/75 dark:text-white/80">
              {range === 'daily' ? 'Selected Day' : range === 'weekly' ? 'Weekly Total' : '30-Day Total'}
            </div>
            <div className="text-3xl sm:text-4xl font-bold font-mono-tabular">
              {formatDurationMinutes(deepMetrics.focusMinutes)}
            </div>
            <div className="text-xs font-mono-tabular text-black/75 dark:text-white/80">
              {deepMetrics.manualFocusMinutes > 0
                ? `${formatDurationMinutes(deepMetrics.measuredFocusMinutes)} + ${formatDurationMinutes(deepMetrics.manualFocusMinutes)} added`
                : `${deepMetrics.focusSessions} sessions · ${deepMetrics.focusSharePct}% focus`}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border-2 border-black dark:border-white bg-white dark:bg-black p-4 sm:p-5 flex flex-col justify-between gap-2">
            <div className="text-xs font-bold uppercase tracking-wider text-black/75 dark:text-white/80">
              Focus Purity &amp; Presence
            </div>
            <div className="text-3xl sm:text-4xl font-bold font-mono-tabular">
              {deepMetrics.presenceRatePct !== null
                ? `${deepMetrics.presenceRatePct}%`
                : `${todayDebrief.purityPct}%`}
            </div>
            <div className="text-xs font-mono-tabular text-black/75 dark:text-white/80">
              {deepMetrics.distractionsPerHour.toFixed(1)} urges/hr ·{' '}
              {deepMetrics.presenceTotal > 0
                ? `${deepMetrics.presenceConfirmed}/${deepMetrics.presenceTotal} present`
                : `${formatDurationMinutes(deepMetrics.breakMinutes)} breaks`}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border-2 border-black dark:border-white bg-white dark:bg-black p-4 sm:p-5 flex flex-col justify-between gap-2">
            <div className="text-xs font-bold uppercase tracking-wider text-black/75 dark:text-white/80">
              Consistency Streak
            </div>
            <div className="text-3xl sm:text-4xl font-bold font-mono-tabular">
              {deepMetrics.currentStreak}d
            </div>
            <div className="text-xs font-mono-tabular text-black/75 dark:text-white/80">
              Best {deepMetrics.bestStreak}d · {xpState.totalXp} XP ({monolithRank.name})
            </div>
          </div>
        </motion.section>

        {/* 3. 24-Hour Polar Clock (4 cols) + Mastery Progression & Streak Shield (8 cols) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="min-w-0 lg:col-span-5 rounded-2xl border-2 border-black dark:border-white p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-bold">24-Hour Polar Clock</h2>
                <p className="text-xs text-black/70 dark:text-white/75 mt-0.5">
                  Hourly focus density.
                </p>
              </div>
              <span className="text-xs font-mono-tabular font-bold px-2.5 py-1 rounded-lg border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black shrink-0">
                {hoveredPolarHour !== null
                  ? `${String(hoveredPolarHour).padStart(2, '0')}:00 · ${formatDurationMinutes(deepMetrics.hourHistogram[hoveredPolarHour])}`
                  : deepMetrics.peakHour >= 0
                    ? `Peak ${String(deepMetrics.peakHour).padStart(2, '0')}:00`
                    : 'No Peak'}
              </span>
            </div>

            <div className="my-4 flex items-center justify-center">
              <svg
                viewBox="0 0 260 260"
                className="block w-full max-w-[240px] h-auto"
                role="img"
                aria-label="24-hour radial focus clock"
              >
                {[38, 64, 90].map((r) => (
                  <circle
                    key={r}
                    cx="130"
                    cy="130"
                    r={r}
                    fill="none"
                    stroke={r === 90 ? inkColor : gridColor}
                    strokeWidth={r === 90 ? 1.5 : 1}
                    strokeOpacity={r === 90 ? 0.85 : 1}
                    strokeDasharray={r === 90 ? undefined : '2 4'}
                  />
                ))}

                {deepMetrics.hourHistogram.map((mins, hr) => {
                  const angleRad = ((hr / 24) * 360 - 90) * (Math.PI / 180);
                  const innerR = 38;
                  const maxLen = 50;
                  const len =
                    mins > 0 ? Math.max(6, (mins / deepMetrics.maxHourMins) * maxLen) : 3;
                  const x1 = 130 + Math.cos(angleRad) * innerR;
                  const y1 = 130 + Math.sin(angleRad) * innerR;
                  const x2 = 130 + Math.cos(angleRad) * (innerR + len);
                  const y2 = 130 + Math.sin(angleRad) * (innerR + len);
                  const isHovered = hoveredPolarHour === hr;
                  return (
                    <g
                      key={hr}
                      onMouseEnter={() => setHoveredPolarHour(hr)}
                      onMouseLeave={() => setHoveredPolarHour(null)}
                      className="cursor-pointer"
                    >
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={inkColor}
                        strokeWidth={isHovered ? 7 : mins > 0 ? 5.2 : 1.75}
                        strokeLinecap="round"
                        strokeOpacity={
                          mins === 0 ? 0.28 : hoveredPolarHour === null || isHovered ? 1 : 0.5
                        }
                      />
                    </g>
                  );
                })}

                {[
                  { label: '00', x: 130, y: 20 },
                  { label: '06', x: 240, y: 130 },
                  { label: '12', x: 130, y: 240 },
                  { label: '18', x: 20, y: 130 },
                ].map((m) => (
                  <text
                    key={m.label}
                    x={m.x}
                    y={m.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={inkColor}
                    fontSize="11.5"
                    fontWeight="700"
                    fontFamily="var(--font-mono)"
                  >
                    {m.label}
                  </text>
                ))}

                {/* High-contrast solid center hub */}
                <circle cx="130" cy="130" r="34" fill={inkColor} />
                <text
                  x="130"
                  y="123"
                  textAnchor="middle"
                  fill={invertedInk}
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="var(--font-sans)"
                >
                  PEAK HOUR
                </text>
                <text
                  x="130"
                  y="140"
                  textAnchor="middle"
                  fill={invertedInk}
                  fontSize="13.5"
                  fontWeight="700"
                  fontFamily="var(--font-mono)"
                >
                  {deepMetrics.peakHour >= 0
                    ? `${String(deepMetrics.peakHour).padStart(2, '0')}:00`
                    : '—'}
                </text>
              </svg>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-7 rounded-2xl border-2 border-black dark:border-white p-5 sm:p-6 flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-black/70 dark:text-white/75">
                  Mastery Progression
                </div>
                <h2 className="text-xl font-bold mt-0.5">{monolithRank.name}</h2>
                <p className="text-xs text-black/75 dark:text-white/80 mt-1 font-mono-tabular">
                  {monolithRank.nextXp !== null
                    ? `${Math.max(0, monolithRank.nextXp - xpState.totalXp)} XP to ${
                        MONOLITH_RANKS[monolithRank.tier]?.name ?? 'Next Rank'
                      }`
                    : 'Highest Monolith Rank achieved'}
                </p>
              </div>

              {/* High-Contrast Monochrome Rank Emblem */}
              <svg
                viewBox="0 0 64 64"
                className="w-16 h-16 shrink-0"
                aria-label={`${monolithRank.name} emblem`}
              >
                <circle
                  cx="32"
                  cy="32"
                  r="28"
                  fill="none"
                  stroke={inkColor}
                  strokeWidth="2"
                />
                {Array.from({ length: monolithRank.tier + 2 }, (_, idx) => {
                  const angle =
                    ((idx / (monolithRank.tier + 2)) * 360 - 90) * (Math.PI / 180);
                  const x = 32 + Math.cos(angle) * 20;
                  const y = 32 + Math.sin(angle) * 20;
                  return (
                    <line
                      key={idx}
                      x1="32"
                      y1="32"
                      x2={x}
                      y2={y}
                      stroke={inkColor}
                      strokeWidth="1.75"
                      strokeOpacity="0.65"
                    />
                  );
                })}
                <polygon
                  points={Array.from({ length: monolithRank.tier + 2 }, (_, idx) => {
                    const angle =
                      ((idx / (monolithRank.tier + 2)) * 360 - 90) * (Math.PI / 180);
                    return `${(32 + Math.cos(angle) * 20).toFixed(1)},${(
                      32 +
                      Math.sin(angle) * 20
                    ).toFixed(1)}`;
                  }).join(' ')}
                  fill="none"
                  stroke={inkColor}
                  strokeWidth="2.2"
                />
                <circle cx="32" cy="32" r="5" fill={inkColor} />
              </svg>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs font-bold font-mono-tabular mb-1.5">
                  <span>{monolithRank.minXp} XP</span>
                  <span>
                    {monolithRank.nextXp !== null ? `${monolithRank.nextXp} XP` : '700+ XP'}
                  </span>
                </div>
                <div className="h-3 w-full rounded-full border-2 border-black dark:border-white p-0.5 overflow-hidden">
                  <motion.div
                    className="h-full bg-black dark:bg-white rounded-full"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${
                        monolithRank.nextXp === null
                          ? 100
                          : Math.min(
                              100,
                              Math.round(
                                ((xpState.totalXp - monolithRank.minXp) /
                                  Math.max(1, monolithRank.nextXp - monolithRank.minXp)) *
                                  100,
                              ),
                            )
                      }%`,
                    }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>

              {onActivateStreakShield && (
                <div className="pt-3 border-t border-black/15 dark:border-white/20 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 shrink-0" />
                      Streak Freeze Shield
                    </div>
                    <div className="text-xs text-black/70 dark:text-white/75 font-mono-tabular">
                      {(xpState.shieldedDayKeys?.length ?? 0)} active · Cost{' '}
                      {STREAK_SHIELD_COST_XP} XP
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={
                      !deepMetrics.shieldCandidateKey ||
                      xpState.totalXp < STREAK_SHIELD_COST_XP
                    }
                    onClick={() => {
                      if (deepMetrics.shieldCandidateKey) {
                        onActivateStreakShield(deepMetrics.shieldCandidateKey);
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-35 disabled:cursor-not-allowed ${bwSolidBtn}`}
                  >
                    {deepMetrics.shieldCandidateLabel
                      ? `Shield ${deepMetrics.shieldCandidateLabel}`
                      : 'Shielded'}
                  </button>
                </div>
              )}
            </div>
          </div>

        </section>

        {/* 4. End-of-Day Debrief */}
        <section className="rounded-2xl border-2 border-black dark:border-white p-5 sm:p-6 flex flex-col justify-between gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">End-of-Day Debrief</h2>
                <p className="text-xs text-black/75 dark:text-white/80 mt-0.5">
                  {new Date().toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  · Personal Peak Window:{' '}
                  <span className="font-mono-tabular font-bold">
                    {globalPeakHour !== null
                      ? `${String(globalPeakHour).padStart(2, '0')}:00`
                      : 'Building'}
                  </span>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopyDebrief()}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg ${bwSolidBtn}`}
                >
                  {debriefCopied ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {debriefCopied ? 'Copied' : 'Copy Summary'}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg ${bwSolidBtn}`}
                >
                  <Printer className="w-3.5 h-3.5" />
                  Print
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="rounded-xl border-2 border-black dark:border-white bg-black text-white dark:bg-white dark:text-black p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide opacity-80">
                  Today Focused
                </div>
                <div className="text-xl font-bold font-mono-tabular mt-1">
                  {formatDurationMinutes(todayDebrief.focusMin)}
                </div>
              </div>
              <div className="rounded-xl border-2 border-black dark:border-white p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-black/75 dark:text-white/80">
                  Zero-Urge Rate
                </div>
                <div className="text-xl font-bold font-mono-tabular mt-1">
                  {todayDebrief.purityPct}%
                </div>
              </div>
              <div className="rounded-xl border-2 border-black dark:border-white p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-black/75 dark:text-white/80">
                  Urges Resisted
                </div>
                <div className="text-xl font-bold font-mono-tabular mt-1">
                  {todayDebrief.urgesToday}
                </div>
              </div>
              <div className="rounded-xl border-2 border-black dark:border-white p-3">
                <div className="text-[11px] font-bold uppercase tracking-wide text-black/75 dark:text-white/80">
                  Session XP
                </div>
                <div className="text-xl font-bold font-mono-tabular mt-1">
                  +{todayDebrief.xpToday} XP
                </div>
              </div>
            </div>
        </section>

        {/* 4. Day Rhythm Timeline Strip & Mode Split */}
        <section className="rounded-2xl border-2 border-black dark:border-white p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold">Day Rhythm Timeline Strip</h2>
              <p className="text-xs text-black/70 dark:text-white/75 mt-0.5">
                Focus blocks (solid) and breaks (hatched) for {deepMetrics.rhythmDateLabel}.
              </p>
            </div>
            <span className="text-xs font-mono-tabular font-bold px-2.5 py-1 rounded-lg border-2 border-black dark:border-white">
              {deepMetrics.rhythmSegments.length} blocks
            </span>
          </div>

          <div>
            <div className="relative h-14 w-full rounded-xl border-2 border-black dark:border-white overflow-hidden bg-white dark:bg-black">
              {[25, 50, 75].map((pct) => (
                <div
                  key={pct}
                  className="absolute top-0 bottom-0 w-px bg-black/20 dark:bg-white/25"
                  style={{ left: `${pct}%` }}
                />
              ))}
              {deepMetrics.rhythmSegments.map((seg) => (
                <div
                  key={seg.id}
                  title={`${seg.type === 'focus' ? 'Focus' : 'Break'} (${formatDurationMinutes(seg.durationMinutes)}) · ${seg.timeLabel}`}
                  className={`absolute top-1.5 bottom-1.5 rounded-[4px] ${
                    seg.type === 'focus'
                      ? 'bg-black dark:bg-white'
                      : 'border-2 border-black dark:border-white'
                  }`}
                  style={{
                    left: `${seg.startPct}%`,
                    width: `${seg.widthPct}%`,
                    backgroundImage:
                      seg.type === 'break'
                        ? isDark
                          ? 'repeating-linear-gradient(-45deg, #ffffff, #ffffff 1.5px, transparent 1.5px, transparent 4px)'
                          : 'repeating-linear-gradient(-45deg, #000000, #000000 1.5px, transparent 1.5px, transparent 4px)'
                        : undefined,
                  }}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs font-bold font-mono-tabular text-black/75 dark:text-white/80 mt-2">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
          </div>

          <div className="pt-4 border-t border-black/15 dark:border-white/20 grid grid-cols-1 md:grid-cols-3 gap-5 items-end">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold">Countdown Mode</span>
                <span className="font-mono-tabular font-semibold">
                  {formatDurationMinutes(deepMetrics.countdownFocusMin)} ·{' '}
                  {deepMetrics.countdownCount}
                </span>
              </div>
              <div className="h-5 w-full rounded-lg border-2 border-black dark:border-white p-0.5 overflow-hidden">
                <motion.div
                  className="h-full bg-black dark:bg-white rounded-[4px]"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${
                      deepMetrics.focusMinutes > 0
                        ? Math.round(
                            (deepMetrics.countdownFocusMin / deepMetrics.focusMinutes) * 100,
                          )
                        : 0
                    }%`,
                  }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold">Count Up Mode</span>
                <span className="font-mono-tabular font-semibold">
                  {formatDurationMinutes(deepMetrics.countupFocusMin)} ·{' '}
                  {deepMetrics.countupCount}
                </span>
              </div>
              <div className="h-5 w-full rounded-lg border-2 border-black dark:border-white p-0.5 overflow-hidden">
                <motion.div
                  className="h-full rounded-[4px] border border-black dark:border-white"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${
                      deepMetrics.focusMinutes > 0
                        ? Math.round(
                            (deepMetrics.countupFocusMin / deepMetrics.focusMinutes) * 100,
                          )
                        : 0
                    }%`,
                  }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    backgroundImage: isDark
                      ? 'repeating-linear-gradient(-45deg, #ffffff, #ffffff 2px, transparent 2px, transparent 5px)'
                      : 'repeating-linear-gradient(-45deg, #000000, #000000 2px, transparent 2px, transparent 5px)',
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-bold">Today&apos;s Daily Target</span>
                <span className="font-mono-tabular font-semibold">
                  {formatDurationMinutes(deepMetrics.todayFocusMinutes)} /{' '}
                  {formatDurationMinutes(settings.dailyGoalMinutes)} ({deepMetrics.goalProgressPct}%)
                </span>
              </div>
              <div className="h-5 w-full rounded-lg border-2 border-black dark:border-white p-0.5 overflow-hidden">
                <motion.div
                  className="h-full bg-black dark:bg-white rounded-[4px]"
                  initial={{ width: 0 }}
                  animate={{ width: `${deepMetrics.goalProgressPct}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 5. 3-Column Behavioral Matrix */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
          <div className="min-w-0 rounded-2xl border-2 border-black dark:border-white p-5 sm:p-6">
            <h2 className="text-base font-bold">Time-of-Day Distribution</h2>
            <p className="text-xs text-black/70 dark:text-white/75 mt-0.5">
              Where your focused effort concentrates across 24 hours.
            </p>

            <div className="mt-5 space-y-4">
              {deepMetrics.timeBlocks.map((block) => {
                const pct =
                  deepMetrics.focusMinutes > 0
                    ? Math.round((block.minutes / deepMetrics.focusMinutes) * 100)
                    : 0;
                return (
                  <div key={block.label}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="font-semibold">{block.label}</span>
                      <span className="font-mono-tabular font-bold">
                        {formatDurationMinutes(block.minutes)} ({pct}%)
                      </span>
                    </div>
                    <div className="h-6 w-full rounded-lg border-2 border-black dark:border-white p-0.5 overflow-hidden bg-white dark:bg-black">
                      <motion.div
                        className="h-full bg-black dark:bg-white rounded-[4px]"
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="min-w-0 rounded-2xl border-2 border-black dark:border-white p-5 sm:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold">Distraction Trigger Timing</h2>
                <span className="text-xs font-mono-tabular font-bold px-2 py-0.5 rounded-md border border-black dark:border-white">
                  {deepMetrics.totalDistractions} urges
                </span>
              </div>
              <p className="text-xs text-black/70 dark:text-white/75 mt-0.5">
                When distraction urges surface inside a focus block.
              </p>

              <div className="mt-5 space-y-4">
                {(
                  [
                    {
                      label: 'Startup Resistance (0–10m)',
                      count: deepMetrics.urgeTiming.early,
                    },
                    {
                      label: 'Mid-Block Drift (10–20m)',
                      count: deepMetrics.urgeTiming.mid,
                    },
                    {
                      label: 'Late Fatigue (20m+)',
                      count: deepMetrics.urgeTiming.late,
                    },
                  ] as const
                ).map((phaseBucket) => {
                  const totalUrgeSum =
                    deepMetrics.urgeTiming.early +
                    deepMetrics.urgeTiming.mid +
                    deepMetrics.urgeTiming.late;
                  const pct =
                    totalUrgeSum > 0
                      ? Math.round((phaseBucket.count / totalUrgeSum) * 100)
                      : 0;
                  return (
                    <div key={phaseBucket.label}>
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="font-semibold">{phaseBucket.label}</span>
                        <span className="font-mono-tabular font-bold">
                          {phaseBucket.count} ({pct}%)
                        </span>
                      </div>
                      <div className="h-6 w-full rounded-lg border-2 border-black dark:border-white p-0.5 overflow-hidden bg-white dark:bg-black">
                        <motion.div
                          className="h-full bg-black dark:bg-white rounded-[4px]"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-xs text-black/75 dark:text-white/80 mt-4 pt-3 border-t border-black/15 dark:border-white/20 font-medium">
              {deepMetrics.totalDistractions === 0
                ? 'Zero urges logged in this window.'
                : deepMetrics.urgeTiming.early >= deepMetrics.urgeTiming.mid &&
                    deepMetrics.urgeTiming.early >= deepMetrics.urgeTiming.late
                  ? 'Tip: Use 5m Ignition Start to bypass early 0–10m startup friction.'
                  : deepMetrics.urgeTiming.late >= deepMetrics.urgeTiming.mid
                    ? 'Tip: Late-block fatigue detected — try 25–35m intervals with movement breaks.'
                    : 'Tip: Mid-block drift detected — try Brown Noise or 40Hz Gamma soundscape.'}
            </p>
          </div>

          <div className="min-w-0 rounded-2xl border-2 border-black dark:border-white p-5 sm:p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs mb-4">
              <div>
                <h2 className="text-base font-bold">28-Day Focus Density</h2>
                <p className="text-xs text-black/70 dark:text-white/75 mt-0.5">
                  Daily goal threshold: {formatDurationMinutes(settings.dailyGoalMinutes)}
                </p>
              </div>
              <span className="font-mono-tabular font-bold px-2 py-0.5 rounded-md border border-black dark:border-white">
                {deepMetrics.currentStreak}d
              </span>
            </div>

            <div className="grid grid-cols-7 sm:grid-cols-14 gap-1.5">
              {deepMetrics.heatmapDays.map((day) => {
                const ratio = Math.min(1, day.minutes / Math.max(30, settings.dailyGoalMinutes));
                const opacity =
                  day.minutes === 0
                    ? day.shielded
                      ? 0.25
                      : 0.04
                    : ratio < 0.35
                      ? 0.35
                      : ratio < 0.7
                        ? 0.68
                        : 1;
                return (
                  <div
                    key={day.key}
                    title={`${day.label}: ${formatDurationMinutes(day.minutes)} focused${day.shielded ? ' · Shielded' : ''}`}
                    className={`aspect-square rounded-[4px] ${
                      day.shielded
                        ? 'border-2 border-black dark:border-white'
                        : 'border border-black/35 dark:border-white/35'
                    }`}
                    style={{
                      backgroundColor: isDark
                        ? `rgba(255,255,255,${opacity})`
                        : `rgba(0,0,0,${opacity})`,
                    }}
                  />
                );
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-black/15 dark:border-white/20 flex items-center justify-between text-[11px] font-mono-tabular text-black/75 dark:text-white/80">
              <span>Less</span>
              <div className="flex items-center gap-1.5">
                {[0.04, 0.35, 0.68, 1].map((op) => (
                  <span
                    key={op}
                    className="w-3 h-3 rounded-[2px] border border-black/40 dark:border-white/40"
                    style={{
                      backgroundColor: isDark
                        ? `rgba(255,255,255,${op})`
                        : `rgba(0,0,0,${op})`,
                    }}
                  />
                ))}
              </div>
              <span>More</span>
            </div>
          </div>
        </section>

        {/* 6. Filterable Session Ledger */}
        <section className="rounded-2xl border-2 border-black dark:border-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-bold">
                Session Logs ({filteredLedger.length})
              </h2>
              <p className="text-xs text-black/70 dark:text-white/75 mt-0.5">
                Period: {periodLabel}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'focus', label: 'Focus' },
                  { id: 'break', label: 'Breaks' },
                  { id: 'countdown', label: 'Countdown' },
                  { id: 'countup', label: 'Count Up' },
                ] as { id: LedgerFilter; label: string }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setLedgerFilter(f.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg ${bwOptionBtn(
                    ledgerFilter === f.id,
                  )}`}
                >
                  {f.label}
                </button>
              ))}

              {filteredLedger.length > 40 && (
                <button
                  type="button"
                  onClick={() => setShowAllLedger((prev) => !prev)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg ${bwSolidBtn}`}
                >
                  {showAllLedger ? 'Show Top 40' : `Show All (${filteredLedger.length})`}
                </button>
              )}

              <button
                type="button"
                disabled={sessions.length === 0}
                onClick={onClearHistory}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg disabled:opacity-35 disabled:cursor-not-allowed ${bwSolidBtn}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Logs</span>
              </button>
            </div>
          </div>

          {filteredLedger.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-black/35 dark:border-white/35 py-10 px-4 text-center flex flex-col items-center gap-3">
              <div className="text-sm font-bold">No session logs recorded yet</div>
              <p className="text-xs text-black/70 dark:text-white/75 max-w-md">
                {sessions.length === 0
                  ? 'Your analytics ledger is empty. Complete a Countdown or Count Up session on the clock to log it here.'
                  : 'No logged sessions match the selected filter in this period.'}
              </p>
              <button
                type="button"
                onClick={() => onNavigate('dashboard')}
                className={`px-4 py-2 text-xs font-bold rounded-lg ${bwSolidBtn}`}
              >
                Return to Clock
              </button>
            </div>
          ) : (
            <>
              {/* Compact Mobile Stacked Ledger (zero horizontal scrolling) */}
              <div className="md:hidden divide-y divide-black/15 dark:divide-white/20">
                {(showAllLedger ? filteredLedger : filteredLedger.slice(0, 40)).map((s) => {
                  const dt = new Date(s.completedAt);
                  const isManual = s.source === 'manual';
                  return (
                    <div key={s.id} className="py-3 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex flex-wrap items-center gap-2 font-bold">
                          <span
                            className={`inline-block w-2.5 h-2.5 rounded-[2px] ${
                              s.type === 'focus'
                                ? 'bg-black dark:bg-white'
                                : 'border-2 border-black dark:border-white'
                            }`}
                          />
                          <span>{s.type === 'focus' ? 'Focus' : 'Break'}</span>
                          <span className="opacity-45">·</span>
                          <span className="font-semibold text-black/80 dark:text-white/85">
                            {isManual
                              ? 'Added Studied'
                              : s.mode === 'countdown'
                                ? 'Countdown'
                                : 'Count Up'}
                          </span>
                          {isManual && (
                            <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border border-black dark:border-white">
                              Added
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono-tabular font-bold">
                            {formatDurationMinutes(s.durationSeconds / 60)}
                          </span>
                          {onDeleteSession && (
                            <button
                              type="button"
                              aria-label="Delete session entry"
                              onClick={() => onDeleteSession(s.id)}
                              className="p-1 rounded border border-black/30 dark:border-white/30 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-black/75 dark:text-white/80">
                        <div className="flex items-center gap-3">
                          <span className="font-mono-tabular">
                            Urges: {typeof s.distractions === 'number' ? s.distractions : '—'}
                          </span>
                          {s.presenceChecks &&
                            s.presenceChecks.confirmed + s.presenceChecks.missed > 0 && (
                              <span className="font-mono-tabular">
                                Present: {s.presenceChecks.confirmed}/
                                {s.presenceChecks.confirmed + s.presenceChecks.missed}
                              </span>
                            )}
                        </div>
                        <span className="font-mono-tabular">
                          {dt.toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}{' '}
                          {dt.toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Full Desktop Table (fits without horizontal scroll on md+) */}
              <div className="hidden md:block">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-black dark:border-white text-black dark:text-white">
                      <th className="py-2.5 pr-4 font-bold">Type</th>
                      <th className="py-2.5 pr-4 font-bold">Mode</th>
                      <th className="py-2.5 pr-4 font-bold">Urges</th>
                      <th className="py-2.5 pr-4 font-bold">Presence</th>
                      <th className="py-2.5 pr-4 font-bold">Completed</th>
                      <th className="py-2.5 text-right font-bold">Duration</th>
                      {onDeleteSession && <th className="py-2.5 pl-3 text-right font-bold" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/15 dark:divide-white/20">
                    {(showAllLedger ? filteredLedger : filteredLedger.slice(0, 40)).map((s) => {
                      const dt = new Date(s.completedAt);
                      const isManual = s.source === 'manual';
                      const checkTotal = s.presenceChecks
                        ? s.presenceChecks.confirmed + s.presenceChecks.missed
                        : 0;
                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                        >
                          <td className="py-2.5 pr-4 font-semibold whitespace-nowrap">
                            <span className="inline-flex items-center gap-2">
                              <span
                                className={`inline-block w-2.5 h-2.5 rounded-[2px] ${
                                  s.type === 'focus'
                                    ? 'bg-black dark:bg-white'
                                    : 'border-2 border-black dark:border-white'
                                }`}
                              />
                              {s.type === 'focus' ? 'Focus' : 'Break'}
                              {isManual && (
                                <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase rounded border border-black dark:border-white">
                                  Added
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-black/80 dark:text-white/85 whitespace-nowrap">
                            {isManual
                              ? 'Added Studied'
                              : s.mode === 'countdown'
                                ? 'Countdown'
                                : 'Count Up'}
                          </td>
                          <td className="py-2.5 pr-4 font-mono-tabular text-black/80 dark:text-white/80">
                            {typeof s.distractions === 'number' ? s.distractions : '—'}
                          </td>
                          <td className="py-2.5 pr-4 font-mono-tabular text-black/80 dark:text-white/80 whitespace-nowrap">
                            {checkTotal > 0 && s.presenceChecks
                              ? `${s.presenceChecks.confirmed}/${checkTotal}`
                              : '—'}
                          </td>
                          <td className="py-2.5 pr-4 font-mono-tabular text-black/80 dark:text-white/80 whitespace-nowrap">
                            {dt.toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            {dt.toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2.5 text-right font-mono-tabular font-bold whitespace-nowrap">
                            {formatDurationMinutes(s.durationSeconds / 60)}
                          </td>
                          {onDeleteSession && (
                            <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                aria-label="Delete session entry"
                                onClick={() => onDeleteSession(s.id)}
                                className="p-1 rounded border border-black/30 dark:border-white/30 hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
