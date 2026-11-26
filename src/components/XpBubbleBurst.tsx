import { AnimatePresence, motion } from 'motion/react';

export interface XpBurstEvent {
  id: number;
  amount: number;
  label?: string;
}

interface XpBubbleBurstProps {
  bursts: XpBurstEvent[];
}

const SATELLITE_BUBBLES = [
  { x: -64, delay: 0.04, size: 14, driftX: -82, riseY: -175, hollow: false },
  { x: 58, delay: 0.08, size: 12, driftX: 76, riseY: -165, hollow: true },
  { x: -32, delay: 0.14, size: 9, driftX: -48, riseY: -210, hollow: true },
  { x: 34, delay: 0.11, size: 16, driftX: 44, riseY: -195, hollow: false },
  { x: -84, delay: 0.18, size: 8, driftX: -96, riseY: -140, hollow: false },
  { x: 82, delay: 0.16, size: 10, driftX: 98, riseY: -148, hollow: true },
  { x: 0, delay: 0.22, size: 7, driftX: 14, riseY: -235, hollow: false },
  { x: -16, delay: 0.24, size: 11, driftX: -24, riseY: -222, hollow: true },
];

export function XpBubbleBurst({ bursts }: XpBubbleBurstProps) {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden"
      aria-live="polite"
    >
      <AnimatePresence>
        {bursts.map((burst) => (
          <div
            key={burst.id}
            className="relative flex items-center justify-center"
          >
            {/* Expanding concentric shockwave ring */}
            <motion.div
              initial={{ scale: 0.45, opacity: 0.7 }}
              animate={{ scale: 2.35, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
              className="absolute w-24 h-24 rounded-full border border-black/45 dark:border-white/55"
            />

            {/* Orbiting rising monochrome bubbles */}
            {SATELLITE_BUBBLES.map((b, idx) => (
              <motion.div
                key={idx}
                initial={{ x: b.x * 0.35, y: 12, scale: 0, opacity: 0 }}
                animate={{
                  x: [b.x * 0.35, b.x * 0.85, b.driftX],
                  y: [12, b.riseY * 0.55, b.riseY],
                  scale: [0, 1.15, 0.85, 0],
                  opacity: [0, 0.95, 0.85, 0],
                }}
                transition={{
                  duration: 1.9,
                  delay: b.delay,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{ width: b.size, height: b.size }}
                className={`absolute rounded-full ${
                  b.hollow
                    ? 'border-[1.5px] border-black dark:border-white bg-white/80 dark:bg-black/80'
                    : 'bg-black dark:bg-white'
                }`}
              />
            ))}

            {/* Primary +5 XP Hero Bubble */}
            <motion.div
              initial={{ y: 20, scale: 0.4, opacity: 0 }}
              animate={{
                y: [20, -48, -124, -162],
                scale: [0.4, 1.12, 1, 0.92],
                opacity: [0, 1, 1, 0],
              }}
              transition={{
                duration: 2.35,
                times: [0, 0.2, 0.72, 1],
                ease: [0.16, 1, 0.3, 1],
              }}
              className="flex items-center justify-center w-20 h-20 rounded-full bg-black text-white dark:bg-white dark:text-black border-2 border-white dark:border-black shadow-[0_12px_36px_rgba(0,0,0,0.28)] dark:shadow-[0_12px_36px_rgba(255,255,255,0.2)]"
            >
              <div className="flex flex-col items-center leading-none">
                <span className="font-mono-tabular text-xl font-bold tracking-tight">
                  +{burst.amount}
                </span>
                <span className="text-[10px] font-bold tracking-[0.22em] uppercase mt-1 opacity-85">
                  XP
                </span>
              </div>
            </motion.div>

            {burst.label && (
              <motion.div
                initial={{ y: 42, opacity: 0 }}
                animate={{ y: [-12, -56, -86], opacity: [0, 0.95, 0] }}
                transition={{ duration: 2.1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute whitespace-nowrap text-black dark:text-white text-[11px] font-bold uppercase tracking-[0.2em]"
              >
                {burst.label}
              </motion.div>
            )}
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
