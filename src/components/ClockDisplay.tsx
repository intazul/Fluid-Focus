import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { ClockFormat, PhaseType, ThemeMode, TimerMode } from '../types/pomodoro';

interface ClockDisplayProps {
  format: ClockFormat;
  mode: TimerMode;
  phase: PhaseType;
  theme: ThemeMode;
  isRunning: boolean;
  isIgnition: boolean;
  onToggleRun: () => void;
  resetNonce: number;
  displaySeconds: number;
  elapsedSeconds: number;
  fractionalSeconds: number;
  progress: number; // 0..1
  ultradianProgress: number; // 0..1 toward 90m cycle
  completedRounds: number;
  longBreakInterval: number;
  countUpTargetMinutes: number;
  earnedBreakMinutes: number;
  distractions: number;
  graceSecondsRemaining: number | null;
  isPeakWindow: boolean;
  adaptiveLadderActive: boolean;
  bubblesEnabled: boolean;
  showDialCaption: boolean;
  breathingPacerEnabled: boolean;
  microMovementEnabled: boolean;
  ultradianTrackerEnabled: boolean;
  eclipseModeEnabled: boolean;
  milestoneRipplesEnabled: boolean;
  presencePending: boolean;
  presenceConfirmedCount: number;
  onMilestoneQuarter?: (quarterIndex: number) => void;
}

const MICRO_MOVEMENT_PROMPTS = [
  'Neck Roll & Jaw Drop · 60s',
  '20-20-20 Distant Focal Gaze',
  'Wrist & Forearm Stretch · 60s',
  'Stand, Shoulder Roll & Hydrate',
];

const CX = 250;
const CY = 250;
const INNER_DIAL_R = 168;
const PROGRESS_RING_R = 200;
const ULTRADIAN_RING_R = 216;
const HALO_RING_R = 234;

function formatDigits(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function getPhaseLabel(
  mode: TimerMode,
  phase: PhaseType,
  isIgnition: boolean,
  adaptiveLadderActive: boolean,
): string {
  if (isIgnition) return '5-Min Ignition';
  if (mode === 'countup') {
    return phase === 'focus' ? 'Open Focus' : phase === 'shortBreak' ? 'Earned Break' : 'Long Break';
  }
  if (phase === 'focus') return adaptiveLadderActive ? 'Adaptive Ladder' : 'Focus';
  if (phase === 'shortBreak') return 'Short Break';
  return 'Long Break';
}

function buildWaveGeometry(
  baseY: number,
  phaseA: number,
  phaseB: number,
  amp1: number,
  amp2: number,
  sloshTilt: number,
): { areaPath: string; surfacePath: string } {
  const startX = CX - INNER_DIAL_R - 6;
  const endX = CX + INNER_DIAL_R + 6;
  const bottomY = CY + INNER_DIAL_R + 12;
  const width = endX - startX;
  const surfacePoints: string[] = [];
  const step = 4;

  for (let x = startX; x <= endX; x += step) {
    const nx = ((x - startX) / width) * Math.PI * 2 * 1.45;
    const normX = (x - CX) / (width / 2);
    const y =
      baseY +
      normX * sloshTilt +
      Math.sin(nx + phaseA) * amp1 +
      Math.cos(nx * 1.65 - phaseB) * amp2 +
      Math.sin(nx * 2.35 + phaseA * 0.7) * (amp2 * 0.45);
    surfacePoints.push(`${x === startX ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const surfacePath = surfacePoints.join(' ');
  const areaPath = `${surfacePath} L${endX},${bottomY} L${startX},${bottomY} Z`;
  return { areaPath, surfacePath };
}

interface BubbleParticle {
  x: number;
  y: number;
  r: number;
  speed: number;
  driftPhase: number;
}

function createInitialBubbles(): BubbleParticle[] {
  return [
    { x: 164, y: 372, r: 1.6, speed: 24, driftPhase: 0.4 },
    { x: 202, y: 332, r: 2.1, speed: 30, driftPhase: 1.7 },
    { x: 242, y: 386, r: 1.4, speed: 21, driftPhase: 2.9 },
    { x: 282, y: 344, r: 1.8, speed: 27, driftPhase: 4.1 },
    { x: 318, y: 374, r: 1.5, speed: 23, driftPhase: 5.2 },
    { x: 224, y: 272, r: 1.7, speed: 26, driftPhase: 3.4 },
    { x: 270, y: 294, r: 1.3, speed: 19, driftPhase: 0.9 },
  ];
}

interface ClockLayerProps {
  format: 'analogue' | 'both';
  ink: string;
  invertedInk: string;
  digits: string;
  isLongFormat: boolean;
  phaseLabel: string;
  subCaption: string;
  percentageText: string;
  showDialCaption: boolean;
  secondAngle: number;
  minuteAngle: number;
  dialRotationAngle: number;
  radialPulseScale: number;
  completedRounds: number;
  longBreakInterval: number;
  minimalTicks: Array<{
    i: number;
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    isMajor: boolean;
  }>;
}

function ClockFaceLayer({
  format,
  ink,
  invertedInk,
  digits,
  isLongFormat,
  phaseLabel,
  subCaption,
  percentageText,
  showDialCaption,
  secondAngle,
  minuteAngle,
  dialRotationAngle,
  radialPulseScale,
  completedRounds,
  longBreakInterval,
  minimalTicks,
}: ClockLayerProps) {
  const activeRound = (completedRounds % longBreakInterval) + 1;
  const dotCount = Math.min(8, Math.max(2, longBreakInterval));

  if (format === 'analogue') {
    return (
      <g>
        {/* Minimal rotating 12-hour index ring */}
        <g transform={`rotate(${dialRotationAngle * 0.25} ${CX} ${CY})`}>
          <g
            transform={`translate(${CX} ${CY}) scale(${radialPulseScale}) translate(${-CX} ${-CY})`}
            style={{ transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)' }}
          >
            {minimalTicks.map((t) => (
              <line
                key={t.i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={ink}
                strokeWidth={t.isMajor ? 3 : 1.6}
                strokeOpacity={t.isMajor ? 0.95 : 0.55}
                strokeLinecap="round"
              />
            ))}
          </g>
        </g>

        {/* Minimal counter-rotating inner horizon ring */}
        <g transform={`rotate(${-dialRotationAngle * 0.5} ${CX} ${CY})`}>
          <circle
            cx={CX}
            cy={CY}
            r="116"
            fill="none"
            stroke={ink}
            strokeOpacity="0.18"
            strokeWidth="1"
            strokeDasharray="2 10"
          />
        </g>

        {/* Minimal Round Dots at 6 o'clock */}
        <g>
          {Array.from({ length: dotCount }, (_, idx) => {
            const spacing = 12;
            const totalW = (dotCount - 1) * spacing;
            const cx = CX - totalW / 2 + idx * spacing;
            const filled = idx < activeRound;
            return (
              <circle
                key={idx}
                cx={cx}
                cy={CY + 72}
                r={filled ? 3.2 : 2.3}
                fill={filled ? ink : 'none'}
                stroke={ink}
                strokeWidth="1.4"
                strokeOpacity={filled ? 1 : 0.5}
              />
            );
          })}
        </g>

        {/* Tapered Minute Hand */}
        <g transform={`rotate(${minuteAngle} ${CX} ${CY})`}>
          <polygon
            points={`${CX},${CY - 114} ${CX + 5},${CY - 12} ${CX},${CY + 22} ${CX - 5},${CY - 12}`}
            fill={ink}
          />
        </g>

        {/* Minimal Second Hand */}
        <g transform={`rotate(${secondAngle} ${CX} ${CY})`}>
          <line
            x1={CX}
            y1={CY + 34}
            x2={CX}
            y2={CY - 142}
            stroke={ink}
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx={CX} cy={CY - 142} r="4" fill={ink} />
        </g>

        {/* Center Pivot */}
        <circle cx={CX} cy={CY} r="7.5" fill={ink} />
        <circle cx={CX} cy={CY} r="2.6" fill={invertedInk} />
      </g>
    );
  }

  // format === 'both': Minimal rotating outer marker ring + large bold typography in balanced open space
  return (
    <g>
      {/* Minimal rotating 12-marker precision ring around perimeter */}
      <g transform={`rotate(${dialRotationAngle} ${CX} ${CY})`}>
        <g
          transform={`translate(${CX} ${CY}) scale(${radialPulseScale}) translate(${-CX} ${-CY})`}
          style={{ transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {minimalTicks.map((t) => (
            <line
              key={t.i}
              x1={t.x1}
              y1={t.y1}
              x2={t.x2}
              y2={t.y2}
              stroke={ink}
              strokeWidth={t.isMajor ? 3 : 1.5}
              strokeOpacity={t.isMajor ? 0.95 : 0.45}
              strokeLinecap="round"
            />
          ))}
        </g>
        <circle cx={CX} cy={CY - 144} r="4" fill={ink} />
      </g>

      {/* Counter-rotating hairline inner orbit */}
      <g transform={`rotate(${-dialRotationAngle * 0.5} ${CX} ${CY})`}>
        <circle
          cx={CX}
          cy={CY}
          r="138"
          fill="none"
          stroke={ink}
          strokeOpacity="0.2"
          strokeWidth="1"
          strokeDasharray="1 11"
        />
      </g>

      {/* Big, High-Clarity Upright Typography Centered in Open Space */}
      {showDialCaption && (
        <text
          x={CX}
          y={CY - 62}
          textAnchor="middle"
          dominantBaseline="central"
          fill={ink}
          fillOpacity="0.88"
          fontSize="13"
          fontWeight="700"
          letterSpacing="3.4"
          fontFamily="var(--font-sans)"
        >
          {phaseLabel.toUpperCase()}
        </text>
      )}

      <text
        x={CX}
        y={showDialCaption ? CY - 2 : CY}
        textAnchor="middle"
        dominantBaseline="central"
        fill={ink}
        fontSize={isLongFormat ? '46' : '70'}
        fontWeight="700"
        letterSpacing="-1.5"
        fontFamily="var(--font-mono)"
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {digits}
      </text>

      {showDialCaption && (
        <text
          x={CX}
          y={CY + 52}
          textAnchor="middle"
          dominantBaseline="central"
          fill={ink}
          fillOpacity="0.86"
          fontSize="12"
          fontWeight="600"
          fontFamily="var(--font-sans)"
        >
          {`${subCaption} · ${percentageText}`}
        </text>
      )}

      {/* Minimal Round Progress Dots */}
      <g>
        {Array.from({ length: dotCount }, (_, idx) => {
          const spacing = 12;
          const totalW = (dotCount - 1) * spacing;
          const cx = CX - totalW / 2 + idx * spacing;
          const filled = idx < activeRound;
          return (
            <circle
              key={idx}
              cx={cx}
              cy={CY + 78}
              r={filled ? 3 : 2.2}
              fill={filled ? ink : 'none'}
              stroke={ink}
              strokeWidth="1.4"
              strokeOpacity={filled ? 1 : 0.45}
            />
          );
        })}
      </g>
    </g>
  );
}

export function ClockDisplay({
  format,
  mode,
  phase,
  theme,
  isRunning,
  isIgnition,
  onToggleRun,
  resetNonce,
  displaySeconds,
  elapsedSeconds,
  fractionalSeconds,
  progress,
  ultradianProgress,
  completedRounds,
  longBreakInterval,
  countUpTargetMinutes,
  earnedBreakMinutes,
  distractions,
  graceSecondsRemaining,
  isPeakWindow,
  adaptiveLadderActive,
  bubblesEnabled,
  showDialCaption,
  breathingPacerEnabled,
  microMovementEnabled,
  ultradianTrackerEnabled,
  eclipseModeEnabled,
  milestoneRipplesEnabled,
  presencePending,
  presenceConfirmedCount,
  onMilestoneQuarter,
}: ClockDisplayProps) {
  const digits = formatDigits(displaySeconds);
  const isLongFormat = digits.length > 5;
  const phaseLabel = getPhaseLabel(mode, phase, isIgnition, adaptiveLadderActive);
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const clampedUltradian = Math.max(0, Math.min(1, ultradianProgress));
  const percentageText = `${Math.round(clampedProgress * 100)}%`;

  const isBreakBreathing = phase !== 'focus' && breathingPacerEnabled;
  const breathCycleSec = 10;
  const breathElapsed = Math.abs(fractionalSeconds) % breathCycleSec;
  const breathCue = breathElapsed < 4 ? 'Inhale 4s' : 'Exhale 6s';

  const movementIndex = (completedRounds + Math.floor(elapsedSeconds / 60)) % MICRO_MOVEMENT_PROMPTS.length;
  const breakCue = microMovementEnabled
    ? MICRO_MOVEMENT_PROMPTS[movementIndex]
    : 'Screen-Free Recovery';

  const presenceSuffix =
    presencePending
      ? ' · Check-In Due'
      : presenceConfirmedCount > 0
        ? ` · ✓${presenceConfirmedCount}`
        : '';

  const subCaption =
    phase !== 'focus'
      ? isBreakBreathing
        ? `${breathCue}`
        : breakCue
      : presencePending
        ? 'Tap I’m Present Below'
        : graceSecondsRemaining !== null && !isRunning
          ? `Grace Pause ${graceSecondsRemaining}s`
          : isIgnition
            ? 'Warm-up rolls into Focus'
            : mode === 'countdown'
              ? `Round ${(completedRounds % longBreakInterval) + 1}/${longBreakInterval}${
                  isPeakWindow ? ' · Peak' : ''
                }${presenceSuffix}`
              : earnedBreakMinutes > 0
                ? `Earned Break ${earnedBreakMinutes}m${presenceSuffix}`
                : `Goal ${countUpTargetMinutes}m${isPeakWindow ? ' · Peak' : ''}${presenceSuffix}`;

  const [radialPulseScale, setRadialPulseScale] = useState(1);
  const [rippleKey, setRippleKey] = useState(0);
  const lastMilestoneRef = useRef<number>(0);

  useEffect(() => {
    setRadialPulseScale(1.03);
    const id = window.setTimeout(() => setRadialPulseScale(1), 170);
    return () => window.clearTimeout(id);
  }, [theme, mode, phase]);

  useEffect(() => {
    const bucket = Math.floor(clampedProgress * 4);
    if (isRunning && bucket >= 1 && bucket <= 3 && bucket > lastMilestoneRef.current) {
      if (milestoneRipplesEnabled) {
        setRippleKey((k) => k + 1);
      }
      onMilestoneQuarter?.(bucket);
    }
    if (clampedProgress < 0.05) {
      lastMilestoneRef.current = 0;
    } else {
      lastMilestoneRef.current = bucket;
    }
  }, [clampedProgress, isRunning, milestoneRipplesEnabled, onMilestoneQuarter]);

  const frontWaveRef = useRef<SVGPathElement | null>(null);
  const meniscusWaveRef = useRef<SVGPathElement | null>(null);
  const backWaveRef = useRef<SVGPathElement | null>(null);
  const clipWaveRef = useRef<SVGPathElement | null>(null);
  const bubbleRefs = useRef<(SVGCircleElement | null)[]>([]);
  const bubblesDataRef = useRef<BubbleParticle[]>(createInitialBubbles());

  const waveStateRef = useRef({
    targetFill: 0.08,
    currentFill: 0.08,
    isRunning,
    bubblesEnabled,
    isBreakBreathing,
    breathCycleTime: 0,
    phaseOffset1: 0,
    phaseOffset2: 1.9,
    ampScale: 0.55,
    sloshEnergy: 0,
    sloshPhase: 0,
  });

  useEffect(() => {
    waveStateRef.current.targetFill =
      phase === 'focus'
        ? 0.08 + clampedProgress * 0.92
        : 0.92 - clampedProgress * 0.84;
    waveStateRef.current.isBreakBreathing = isBreakBreathing;
  }, [clampedProgress, phase, isBreakBreathing]);

  const prevRunningRef = useRef(isRunning);
  useEffect(() => {
    waveStateRef.current.isRunning = isRunning;
    if (prevRunningRef.current !== isRunning) {
      waveStateRef.current.sloshEnergy = 1.05;
      prevRunningRef.current = isRunning;
    }
  }, [isRunning]);

  const prevResetRef = useRef(resetNonce);
  useEffect(() => {
    if (prevResetRef.current !== resetNonce) {
      waveStateRef.current.sloshEnergy = 1.2;
      lastMilestoneRef.current = 0;
      prevResetRef.current = resetNonce;
    }
  }, [resetNonce]);

  useEffect(() => {
    waveStateRef.current.bubblesEnabled = bubblesEnabled;
  }, [bubblesEnabled]);

  useEffect(() => {
    if (format === 'digital') return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = motionQuery.matches;
    const handleMotionChange = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
    };
    motionQuery.addEventListener('change', handleMotionChange);

    let rafId = 0;
    let lastTime = performance.now();

    const animateWave = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const s = waveStateRef.current;
      s.currentFill += (s.targetFill - s.currentFill) * Math.min(1, dt * 4.5);

      const targetAmp = prefersReducedMotion ? 0.2 : s.isRunning ? 1.0 : 0.42;
      s.ampScale += (targetAmp - s.ampScale) * Math.min(1, dt * 3.5);

      s.sloshEnergy *= Math.exp(-dt * 2.2);
      if (s.sloshEnergy < 0.005) s.sloshEnergy = 0;
      s.sloshPhase += dt * 7.5;
      const sloshTilt = prefersReducedMotion
        ? 0
        : Math.sin(s.sloshPhase) * s.sloshEnergy * 15;
      const sloshAmpBoost = prefersReducedMotion ? 0 : s.sloshEnergy * 5.5;

      let breathMod = 0;
      if (s.isBreakBreathing && s.isRunning && !prefersReducedMotion) {
        s.breathCycleTime = (s.breathCycleTime + dt) % 10;
        const p =
          s.breathCycleTime < 4
            ? 0.5 - 0.5 * Math.cos((s.breathCycleTime / 4) * Math.PI)
            : 0.5 + 0.5 * Math.cos(((s.breathCycleTime - 4) / 6) * Math.PI);
        breathMod = (p - 0.5) * 0.14;
      }

      const speed = prefersReducedMotion ? 0.15 : s.isRunning ? 1.85 : 0.72;
      s.phaseOffset1 += dt * speed;
      s.phaseOffset2 += dt * speed * 1.26;

      const effectiveFill = Math.max(0.05, Math.min(0.97, s.currentFill + breathMod));
      const circleTop = CY - INNER_DIAL_R;
      const circleDiameter = INNER_DIAL_R * 2;
      const baseY = circleTop + circleDiameter * (1 - effectiveFill);

      const frontGeo = buildWaveGeometry(
        baseY,
        s.phaseOffset1,
        s.phaseOffset2,
        7.8 * s.ampScale + sloshAmpBoost,
        3.8 * s.ampScale,
        sloshTilt,
      );
      const backGeo = buildWaveGeometry(
        baseY - 6.0 * s.ampScale,
        s.phaseOffset2 + 1.2,
        s.phaseOffset1 * 0.85,
        6.5 * s.ampScale + sloshAmpBoost * 0.6,
        3.2 * s.ampScale,
        -sloshTilt * 0.65,
      );

      if (frontWaveRef.current) frontWaveRef.current.setAttribute('d', frontGeo.areaPath);
      if (clipWaveRef.current) clipWaveRef.current.setAttribute('d', frontGeo.areaPath);
      if (meniscusWaveRef.current) meniscusWaveRef.current.setAttribute('d', frontGeo.surfacePath);
      if (backWaveRef.current) backWaveRef.current.setAttribute('d', backGeo.areaPath);

      const showBubbles = s.bubblesEnabled && !prefersReducedMotion;
      bubblesDataRef.current.forEach((b, idx) => {
        const el = bubbleRefs.current[idx];
        if (!el) return;
        if (!showBubbles) {
          el.setAttribute('opacity', '0');
          return;
        }
        if (s.isRunning) {
          b.y -= b.speed * dt;
          b.driftPhase += dt * 2.2;
          if (b.y < baseY + 8) {
            b.y = CY + INNER_DIAL_R - 4;
            b.x = CX - 96 + ((idx * 41 + Math.floor(now * 0.05)) % 192);
          }
        }
        const visible = b.y > baseY + 10 && b.y < CY + INNER_DIAL_R - 2;
        el.setAttribute('cx', (b.x + Math.sin(b.driftPhase) * 3.5).toFixed(1));
        el.setAttribute('cy', b.y.toFixed(1));
        el.setAttribute('r', String(b.r));
        el.setAttribute('opacity', visible ? (s.isRunning ? '0.68' : '0.32') : '0');
      });

      rafId = requestAnimationFrame(animateWave);
    };

    rafId = requestAnimationFrame(animateWave);

    return () => {
      cancelAnimationFrame(rafId);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, [format]);

  const isEclipseActive = eclipseModeEnabled && phase === 'focus' && clampedProgress >= 0.5;

  // Digital-Only Mode: unboxed minimalist typographic horology with precision progress rail
  if (format === 'digital') {
    const activeRound = (completedRounds % longBreakInterval) + 1;
    const dotCount = Math.min(8, Math.max(2, longBreakInterval));

    return (
      <motion.button
        type="button"
        onClick={onToggleRun}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        aria-label={isRunning ? 'Pause timer' : 'Start timer'}
        className="group relative flex flex-col items-center justify-center select-none cursor-pointer px-4 py-4 sm:px-8 sm:py-6 text-black dark:text-white transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-black dark:focus-visible:outline-white"
      >
        {showDialCaption && (
          <div className="mb-3 sm:mb-4 flex items-center gap-3 text-[11px] sm:text-xs font-bold tracking-[0.28em] uppercase text-black/75 dark:text-white/80">
            <span aria-hidden="true" className="h-px w-6 sm:w-8 bg-current opacity-30" />
            <span>{phaseLabel}</span>
            <span aria-hidden="true" className="h-px w-6 sm:w-8 bg-current opacity-30" />
          </div>
        )}

        <div
          className={`font-mono-tabular font-bold tracking-[-0.04em] leading-[0.94] transition-transform duration-200 ${
            isLongFormat
              ? 'text-[4.25rem] sm:text-[6.75rem] md:text-[8.5rem]'
              : 'text-[5.5rem] sm:text-[9.25rem] md:text-[11.25rem]'
          }`}
          aria-live="off"
        >
          {digits}
        </div>

        {/* Minimal Precision Progress Rail */}
        <div
          aria-hidden="true"
          className="relative mt-5 sm:mt-7 w-[min(290px,76vw)] sm:w-[390px] md:w-[450px] flex items-center"
        >
          <span className="h-2 w-px bg-black/35 dark:bg-white/40 shrink-0" />
          <div className="relative flex-1 h-[2px] bg-black/15 dark:bg-white/20">
            <div
              className="absolute inset-y-0 left-0 bg-black dark:bg-white transition-[width] duration-200 ease-out"
              style={{ width: `${clampedProgress * 100}%` }}
            />
            <span
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-black dark:bg-white transition-[left] duration-200 ease-out"
              style={{ left: `${clampedProgress * 100}%` }}
            />
          </div>
          <span className="h-2 w-px bg-black/35 dark:bg-white/40 shrink-0" />
        </div>

        {showDialCaption && (
          <div className="mt-4 flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wide text-black/80 dark:text-white/85">
            <span>{subCaption}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular font-bold">{percentageText}</span>
          </div>
        )}

        {/* Minimal Round Dots matching Analogue & Hybrid dials */}
        <div aria-hidden="true" className="mt-3.5 flex items-center gap-2">
          {Array.from({ length: dotCount }, (_, idx) => {
            const filled = idx < activeRound;
            return (
              <span
                key={idx}
                className={`rounded-full border border-black dark:border-white transition-all ${
                  filled
                    ? 'w-2 h-2 bg-black dark:bg-white'
                    : 'w-1.5 h-1.5 bg-transparent opacity-45'
                }`}
              />
            );
          })}
        </div>
      </motion.button>
    );
  }

  // Analogue & Hybrid ('both') Modes: Minimal rotating precision horology with large letters & open space
  const themeIsDark = theme === 'dark';
  const effectiveDark = isEclipseActive ? !themeIsDark : themeIsDark;
  const primaryInk = effectiveDark ? '#ffffff' : '#000000';
  const invertedInk = effectiveDark ? '#000000' : '#ffffff';
  const canvasFill = effectiveDark ? '#000000' : '#ffffff';
  const outerRingInk = themeIsDark ? '#ffffff' : '#000000';
  const backWaveFill = effectiveDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.14)';
  const meniscusStroke = effectiveDark ? 'rgba(0, 0, 0, 0.65)' : 'rgba(255, 255, 255, 0.75)';

  const secondAngle = ((fractionalSeconds % 60) / 60) * 360;
  const minuteAngle = ((fractionalSeconds % 3600) / 3600) * 360;
  const dialRotationAngle = ((fractionalSeconds % 60) / 60) * 360;
  const haloAngle = ((fractionalSeconds % 180) / 180) * 360;

  const progressCircumference = 2 * Math.PI * PROGRESS_RING_R;
  const strokeDashoffset = progressCircumference * (1 - clampedProgress);
  const progressTipRad = (clampedProgress * 360 - 90) * (Math.PI / 180);
  const tipX = CX + Math.cos(progressTipRad) * PROGRESS_RING_R;
  const tipY = CY + Math.sin(progressTipRad) * PROGRESS_RING_R;

  const ultradianCircumference = 2 * Math.PI * ULTRADIAN_RING_R;
  const ultradianDashoffset = ultradianCircumference * (1 - clampedUltradian);

  // Clean 12-marker precision ring around INNER_DIAL_R (plenty of space outside the r=136 typography zone)
  const minimalTicks = Array.from({ length: 12 }, (_, i) => {
    const rad = ((i * 30 - 90) * Math.PI) / 180;
    const isMajor = i % 3 === 0;
    const outerR = INNER_DIAL_R - 5;
    const innerR = isMajor ? INNER_DIAL_R - 18 : INNER_DIAL_R - 12;
    return {
      i,
      x1: CX + Math.cos(rad) * innerR,
      y1: CY + Math.sin(rad) * innerR,
      x2: CX + Math.cos(rad) * outerR,
      y2: CY + Math.sin(rad) * outerR,
      isMajor,
    };
  });

  const vernierTicks = Array.from({ length: 60 }, (_, i) => {
    const rad = ((i * 6 - 90) * Math.PI) / 180;
    const isFive = i % 5 === 0;
    const outerR = HALO_RING_R + (isFive ? 10 : 6);
    const innerR = HALO_RING_R + 2;
    return {
      i,
      x1: CX + Math.cos(rad) * innerR,
      y1: CY + Math.sin(rad) * innerR,
      x2: CX + Math.cos(rad) * outerR,
      y2: CY + Math.sin(rad) * outerR,
      isFive,
    };
  });

  const urgeNotchCount = Math.min(12, Math.max(0, distractions));

  return (
    <div className="flex flex-col items-center justify-center select-none text-black dark:text-white">
      <motion.button
        type="button"
        onClick={onToggleRun}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.985 }}
        transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        aria-label={isRunning ? 'Pause timer' : 'Start timer'}
        className="relative w-[min(325px,54dvh)] h-[min(325px,54dvh)] sm:w-[min(436px,62dvh)] sm:h-[min(436px,62dvh)] md:w-[min(504px,66dvh)] md:h-[min(504px,66dvh)] flex items-center justify-center rounded-full cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black dark:focus-visible:outline-white"
      >
        {/* Subtle breathing kinetic pulse ring while active */}
        {(isRunning || presencePending) && (
          <motion.span
            aria-hidden="true"
            initial={{ scale: 0.96, opacity: presencePending ? 0.85 : 0.4 }}
            animate={{ scale: 1.05, opacity: 0 }}
            transition={{
              duration: presencePending ? 1.35 : 2.6,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            className={`absolute inset-0 rounded-full pointer-events-none ${
              presencePending
                ? 'border-2 border-black dark:border-white'
                : 'border border-black/40 dark:border-white/45'
            }`}
          />
        )}

        {/* Session Milestone Shockwave Ripple (25% / 50% / 75%) */}
        <AnimatePresence>
          {rippleKey > 0 && (
            <motion.span
              key={rippleKey}
              aria-hidden="true"
              initial={{ scale: 0.74, opacity: 0.85 }}
              animate={{ scale: 1.1, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.95, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 rounded-full border-2 border-black dark:border-white pointer-events-none"
            />
          )}
        </AnimatePresence>

        <svg
          viewBox="0 0 500 500"
          className="w-full h-full overflow-visible"
          role="img"
          aria-label={`${phaseLabel} ${format} timer ${digits}`}
        >
          <defs>
            <clipPath id="clock-interior-clip">
              <circle cx={CX} cy={CY} r={INNER_DIAL_R} />
            </clipPath>
            <clipPath id="clock-fluid-wave-clip">
              <path
                ref={clipWaveRef}
                d={`M${CX - INNER_DIAL_R},${CY + INNER_DIAL_R} L${CX + INNER_DIAL_R},${CY + INNER_DIAL_R} L${CX + INNER_DIAL_R},${CY + INNER_DIAL_R + 12} L${CX - INNER_DIAL_R},${CY + INNER_DIAL_R + 12} Z`}
              />
            </clipPath>
          </defs>

          {/* 0. Precision 60-Tick Outer Swiss Vernier Perimeter */}
          <g>
            {vernierTicks.map((t) => (
              <line
                key={t.i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={outerRingInk}
                strokeWidth={t.isFive ? 1.5 : 0.85}
                strokeOpacity={t.isFive ? 0.36 : 0.16}
                strokeLinecap="round"
              />
            ))}
          </g>

          {/* 1. Minimal Rotating Outer Orbital Halo */}
          <g transform={`rotate(${haloAngle} ${CX} ${CY})`}>
            <circle
              cx={CX}
              cy={CY}
              r={HALO_RING_R}
              fill="none"
              stroke={outerRingInk}
              strokeOpacity={urgeNotchCount === 0 ? 0.3 : 0.2}
              strokeWidth="1.2"
              strokeDasharray={urgeNotchCount === 0 ? undefined : '4 8'}
            />

            {/* 4 Minimal Cardinal Diamonds */}
            {[0, 90, 180, 270].map((deg) => {
              const rad = ((deg - 90) * Math.PI) / 180;
              const dx = CX + Math.cos(rad) * HALO_RING_R;
              const dy = CY + Math.sin(rad) * HALO_RING_R;
              return (
                <polygon
                  key={deg}
                  points={`${dx},${dy - 4.2} ${dx + 4.2},${dy} ${dx},${dy + 4.2} ${dx - 4.2},${dy}`}
                  fill={outerRingInk}
                  fillOpacity="0.9"
                />
              );
            })}

            {/* Radial urge notches etched when distractions are logged */}
            {Array.from({ length: urgeNotchCount }, (_, idx) => {
              const deg = idx * 30 + 15;
              const rad = ((deg - 90) * Math.PI) / 180;
              const x1 = CX + Math.cos(rad) * (HALO_RING_R - 5.5);
              const y1 = CY + Math.sin(rad) * (HALO_RING_R - 5.5);
              const x2 = CX + Math.cos(rad) * (HALO_RING_R + 5.5);
              const y2 = CY + Math.sin(rad) * (HALO_RING_R + 5.5);
              return (
                <line
                  key={`urge-${idx}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={outerRingInk}
                  strokeWidth="2"
                  strokeOpacity="0.92"
                />
              );
            })}
          </g>

          {/* 2. Subtle Ultradian 90-Minute Cycle Hairline Arc */}
          {ultradianTrackerEnabled && (
            <circle
              cx={CX}
              cy={CY}
              r={ULTRADIAN_RING_R}
              fill="none"
              stroke={outerRingInk}
              strokeOpacity="0.55"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeDasharray={ultradianCircumference}
              strokeDashoffset={ultradianDashoffset}
              transform={`rotate(-90 ${CX} ${CY})`}
            />
          )}

          {/* Peak Focus Window Zenith Marker */}
          {isPeakWindow && phase === 'focus' && (
            <polygon
              points={`${CX},${CY - HALO_RING_R - 13} ${CX + 4.2},${CY - HALO_RING_R - 7} ${CX},${CY - HALO_RING_R - 1} ${CX - 4.2},${CY - HALO_RING_R - 7}`}
              fill={outerRingInk}
            />
          )}

          {/* 3. Clean High-Contrast Progress Ring + Orbiting Carriage Dot */}
          <circle
            cx={CX}
            cy={CY}
            r={PROGRESS_RING_R}
            fill="none"
            stroke={outerRingInk}
            strokeOpacity="0.16"
            strokeWidth="1.4"
          />
          <circle
            cx={CX}
            cy={CY}
            r={PROGRESS_RING_R}
            fill="none"
            stroke={outerRingInk}
            strokeWidth="4.2"
            strokeLinecap="round"
            strokeDasharray={progressCircumference}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${CX} ${CY})`}
          />
          <g>
            <circle
              cx={tipX}
              cy={tipY}
              r="6.5"
              fill={themeIsDark ? '#000000' : '#ffffff'}
              stroke={outerRingInk}
              strokeWidth="2.4"
            />
            <circle cx={tipX} cy={tipY} r="2.4" fill={outerRingInk} />
          </g>

          {/* 4. Expanded Main Clock Dial Interior */}
          <g clipPath="url(#clock-interior-clip)">
            <circle cx={CX} cy={CY} r={INNER_DIAL_R} fill={canvasFill} />

            <ClockFaceLayer
              format={format}
              ink={primaryInk}
              invertedInk={invertedInk}
              digits={digits}
              isLongFormat={isLongFormat}
              phaseLabel={phaseLabel}
              subCaption={subCaption}
              percentageText={percentageText}
              showDialCaption={showDialCaption}
              secondAngle={secondAngle}
              minuteAngle={minuteAngle}
              dialRotationAngle={dialRotationAngle}
              radialPulseScale={radialPulseScale}
              completedRounds={completedRounds}
              longBreakInterval={longBreakInterval}
              minimalTicks={minimalTicks}
            />

            <path
              ref={backWaveRef}
              d={`M${CX - INNER_DIAL_R},${CY + INNER_DIAL_R - 4} L${CX + INNER_DIAL_R},${CY + INNER_DIAL_R - 4} L${CX + INNER_DIAL_R},${CY + INNER_DIAL_R + 12} L${CX - INNER_DIAL_R},${CY + INNER_DIAL_R + 12} Z`}
              fill={backWaveFill}
            />
            <path
              ref={frontWaveRef}
              d={`M${CX - INNER_DIAL_R},${CY + INNER_DIAL_R} L${CX + INNER_DIAL_R},${CY + INNER_DIAL_R} L${CX + INNER_DIAL_R},${CY + INNER_DIAL_R + 12} L${CX - INNER_DIAL_R},${CY + INNER_DIAL_R + 12} Z`}
              fill={primaryInk}
            />

            <path
              ref={meniscusWaveRef}
              d={`M${CX - INNER_DIAL_R},${CY + INNER_DIAL_R} L${CX + INNER_DIAL_R},${CY + INNER_DIAL_R}`}
              fill="none"
              stroke={meniscusStroke}
              strokeWidth="1.5"
            />

            {/* Submerged inverted layer + rising micro-bubbles */}
            <g clipPath="url(#clock-fluid-wave-clip)">
              {bubblesDataRef.current.map((b, idx) => (
                <circle
                  key={idx}
                  ref={(el) => {
                    bubbleRefs.current[idx] = el;
                  }}
                  cx={b.x}
                  cy={b.y}
                  r={b.r}
                  fill={invertedInk}
                  opacity="0"
                />
              ))}

              <ClockFaceLayer
                format={format}
                ink={invertedInk}
                invertedInk={primaryInk}
                digits={digits}
                isLongFormat={isLongFormat}
                phaseLabel={phaseLabel}
                subCaption={subCaption}
                percentageText={percentageText}
                showDialCaption={showDialCaption}
                secondAngle={secondAngle}
                minuteAngle={minuteAngle}
                dialRotationAngle={dialRotationAngle}
                radialPulseScale={radialPulseScale}
                completedRounds={completedRounds}
                longBreakInterval={longBreakInterval}
                minimalTicks={minimalTicks}
              />
            </g>
          </g>

          {/* Primary High-Contrast Inner Dial Border & Precision Double-Bezel */}
          <circle
            cx={CX}
            cy={CY}
            r={INNER_DIAL_R + 6}
            fill="none"
            stroke={outerRingInk}
            strokeOpacity="0.16"
            strokeWidth="1"
          />
          <circle
            cx={CX}
            cy={CY}
            r={INNER_DIAL_R}
            fill="none"
            stroke={primaryInk}
            strokeWidth="3.25"
          />
        </svg>
      </motion.button>

      {format === 'analogue' && showDialCaption && (
        <div className="mt-2.5 flex items-center gap-2 text-xs sm:text-sm font-semibold tracking-wide text-black/85 dark:text-white/85">
          <span className="uppercase tracking-[0.18em]">{phaseLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{subCaption}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular font-bold">{percentageText}</span>
        </div>
      )}
    </div>
  );
}
