import { AmbientNoiseMode, SoundProfile } from '../types/pomodoro';

let audioCtx: AudioContext | null = null;
let ambientSource: AudioBufferSourceNode | null = null;
let ambientOscillators: OscillatorNode[] = [];
let ambientNodes: AudioNode[] = [];
let ambientTimers: number[] = [];
let ambientGain: GainNode | null = null;
let activeAmbientMode: AmbientNoiseMode = 'off';

function getAudioContext(): AudioContext | null {
  try {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextCtor();
    }
    if (audioCtx.state === 'suspended') {
      void audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Dual-tone harmonic chime sequencer: rises gently across rounds toward a Long Break.
 */
export function playCompletionChime(
  type: 'focus' | 'break',
  profile: SoundProfile = 'bell',
  volumePercent = 70,
  roundPitchStep = 0,
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const vol = Math.max(0.01, Math.min(1, volumePercent / 100)) * 0.22;
    const now = ctx.currentTime;
    const pitchMult = Math.pow(2, Math.min(4, Math.max(0, roundPitchStep)) / 12);

    let notes: number[] = [];
    let spacing = 0.14;
    let duration = 0.55;

    if (profile === 'bell') {
      notes = type === 'focus' ? [523.25, 659.25, 783.99] : [659.25, 523.25];
      spacing = 0.14;
      duration = 0.6;
    } else if (profile === 'pulse') {
      notes = type === 'focus' ? [440, 440] : [392];
      spacing = 0.22;
      duration = 0.35;
    } else {
      notes = type === 'focus' ? [587.33, 880] : [880, 587.33];
      spacing = 0.16;
      duration = 0.48;
    }

    notes.forEach((baseFreq, idx) => {
      const freq = type === 'focus' ? baseFreq * pitchMult : baseFreq;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = profile === 'pulse' ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * spacing);

      gain.gain.setValueAtTime(0.0001, now + idx * spacing);
      gain.gain.exponentialRampToValueAtTime(vol, now + idx * spacing + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * spacing + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * spacing);
      osc.stop(now + idx * spacing + duration + 0.05);
    });
  } catch {
    // Ignore audio context errors
  }
}

export function playMilestoneChime(quarterIndex: number, volumePercent = 70): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const vol = Math.max(0.008, Math.min(1, volumePercent / 100)) * 0.085;
    const now = ctx.currentTime;
    const freqs =
      quarterIndex === 1 ? [659.25] : quarterIndex === 2 ? [659.25, 880] : [783.99, 1046.5];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(vol, now + idx * 0.09 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.28);
    });
  } catch {
    // ignore
  }
}

export function playTickSound(volumePercent = 70, accent = true): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const baseGain = accent ? 0.045 : 0.022;
    const vol = Math.max(0.004, Math.min(1, volumePercent / 100)) * baseGain;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 1140 : 1480, now);
    osc.frequency.exponentialRampToValueAtTime(accent ? 320 : 520, now + 0.018);

    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.028);
  } catch {
    // ignore
  }
}

export function playXpRewardChime(volumePercent = 70): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const vol = Math.max(0.01, Math.min(1, volumePercent / 100)) * 0.14;
    const now = ctx.currentTime;
    const notes = [587.33, 880, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(vol, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.36);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  } catch {
    // ignore
  }
}

export function playPresencePromptChime(volumePercent = 70): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const vol = Math.max(0.015, Math.min(1, volumePercent / 100)) * 0.18;
    const now = ctx.currentTime;
    const notes = [698.46, 880, 698.46, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(vol, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.34);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.38);
    });
  } catch {
    // ignore
  }
}

export function playPresenceConfirmChime(volumePercent = 70): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const vol = Math.max(0.012, Math.min(1, volumePercent / 100)) * 0.14;
    const now = ctx.currentTime;
    const notes = [523.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0.0001, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(vol, now + idx * 0.07 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.32);
    });
  } catch {
    // ignore
  }
}

export function stopAmbientNoise(): void {
  try {
    ambientTimers.forEach((id) => window.clearTimeout(id));
    ambientTimers = [];

    if (ambientSource) {
      ambientSource.stop();
      ambientSource.disconnect();
      ambientSource = null;
    }
    ambientOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore
      }
    });
    ambientOscillators = [];

    ambientNodes.forEach((node) => {
      try {
        node.disconnect();
      } catch {
        // ignore
      }
    });
    ambientNodes = [];

    if (ambientGain) {
      ambientGain.disconnect();
      ambientGain = null;
    }
    activeAmbientMode = 'off';
  } catch {
    ambientTimers = [];
    ambientSource = null;
    ambientOscillators = [];
    ambientNodes = [];
    ambientGain = null;
    activeAmbientMode = 'off';
  }
}

function createStereoPinkRainBuffer(ctx: AudioContext, seconds = 5): AudioBuffer {
  const length = ctx.sampleRate * seconds;
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let b3 = 0;
    let b4 = 0;
    let b5 = 0;
    let b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.055;
      b6 = white * 0.115926;
    }

    // Smooth loop boundary crossfade over 0.15s to avoid any audible click
    const fadeSamples = Math.floor(ctx.sampleRate * 0.15);
    for (let i = 0; i < fadeSamples; i++) {
      const t = i / fadeSamples;
      const startSample = data[i];
      const endIdx = length - fadeSamples + i;
      const endSample = data[endIdx];
      data[i] = startSample * t + endSample * (1 - t);
      data[endIdx] = endSample * t + startSample * (1 - t);
    }
  }
  return buffer;
}

function triggerSoftRaindrop(ctx: AudioContext, destination: AudioNode): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const baseFreq = 680 + Math.random() * 1450;

  osc.type = 'sine';
  osc.frequency.setValueAtTime(baseFreq, now);
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.38, now + 0.045);

  const peak = 0.018 + Math.random() * 0.025;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);

  if (typeof ctx.createStereoPanner === 'function') {
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.4 - 0.7;
    osc.connect(gain);
    gain.connect(pan);
    pan.connect(destination);
  } else {
    osc.connect(gain);
    gain.connect(destination);
  }

  osc.start(now);
  osc.stop(now + 0.1);
}

function triggerForestBirdCall(ctx: AudioContext, destination: AudioNode): void {
  const now = ctx.currentTime;
  const panPos = Math.random() * 1.3 - 0.65;

  const panNode =
    typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
  if (panNode) {
    panNode.pan.value = panPos;
    panNode.connect(destination);
  }
  const target = panNode ?? destination;

  // Choose an organic soft forest songbird motif (thrush, wren, or distant robin)
  const motif = Math.floor(Math.random() * 3);
  const baseNotes =
    motif === 0
      ? [
          { start: 0, dur: 0.13, f0: 2150, f1: 2780, amp: 0.045 },
          { start: 0.18, dur: 0.16, f0: 2550, f1: 2180, amp: 0.05 },
          { start: 0.4, dur: 0.22, f0: 2400, f1: 3050, amp: 0.038 },
        ]
      : motif === 1
        ? [
            { start: 0, dur: 0.1, f0: 2950, f1: 3420, amp: 0.038 },
            { start: 0.14, dur: 0.1, f0: 3120, f1: 3560, amp: 0.042 },
            { start: 0.3, dur: 0.18, f0: 2720, f1: 2290, amp: 0.035 },
          ]
        : [
            { start: 0, dur: 0.26, f0: 1920, f1: 2480, amp: 0.048 },
            { start: 0.34, dur: 0.24, f0: 2620, f1: 2150, amp: 0.04 },
          ];

  baseNotes.forEach((note) => {
    const osc = ctx.createOscillator();
    const vib = ctx.createOscillator();
    const vibGain = ctx.createGain();
    const env = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(note.f0, now + note.start);
    osc.frequency.exponentialRampToValueAtTime(note.f1, now + note.start + note.dur);

    // Subtle organic syrinx vibrato
    vib.type = 'sine';
    vib.frequency.setValueAtTime(22 + Math.random() * 10, now + note.start);
    vibGain.gain.setValueAtTime(45, now + note.start);
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);

    env.gain.setValueAtTime(0.0001, now + note.start);
    env.gain.linearRampToValueAtTime(note.amp, now + note.start + 0.03);
    env.gain.exponentialRampToValueAtTime(0.0001, now + note.start + note.dur);

    osc.connect(env);
    env.connect(target);

    osc.start(now + note.start);
    vib.start(now + note.start);
    osc.stop(now + note.start + note.dur + 0.04);
    vib.stop(now + note.start + note.dur + 0.04);
  });
}

export function syncAmbientNoise(
  mode: AmbientNoiseMode,
  isRunning: boolean,
  volumePercent = 40,
): void {
  if (!isRunning || mode === 'off') {
    if (activeAmbientMode !== 'off') {
      stopAmbientNoise();
    }
    return;
  }

  const ctx = getAudioContext();
  if (!ctx) return;

  const targetGain =
    mode === 'gamma40'
      ? Math.max(0.005, Math.min(1, volumePercent / 100)) * 0.065
      : mode === 'rainBirds'
        ? Math.max(0.01, Math.min(1, volumePercent / 100)) * 0.24
        : Math.max(0.005, Math.min(1, volumePercent / 100)) * 0.16;

  if (activeAmbientMode === mode && ambientGain) {
    ambientGain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.08);
    return;
  }

  stopAmbientNoise();

  try {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(targetGain, ctx.currentTime + 0.65);
    gain.connect(ctx.destination);

    if (mode === 'gamma40') {
      const oscL = ctx.createOscillator();
      const oscR = ctx.createOscillator();
      oscL.type = 'sine';
      oscR.type = 'sine';
      oscL.frequency.setValueAtTime(180, ctx.currentTime);
      oscR.frequency.setValueAtTime(220, ctx.currentTime);

      if (typeof ctx.createStereoPanner === 'function') {
        const panL = ctx.createStereoPanner();
        const panR = ctx.createStereoPanner();
        panL.pan.value = -0.65;
        panR.pan.value = 0.65;
        oscL.connect(panL);
        oscR.connect(panR);
        panL.connect(gain);
        panR.connect(gain);
        ambientNodes.push(panL, panR);
      } else {
        oscL.connect(gain);
        oscR.connect(gain);
      }

      oscL.start();
      oscR.start();
      ambientOscillators.push(oscL, oscR);
      ambientGain = gain;
      activeAmbientMode = mode;
      return;
    }

    if (mode === 'rainBirds') {
      // 1. Lush stereo rainfall bed
      const rainSource = ctx.createBufferSource();
      rainSource.buffer = createStereoPinkRainBuffer(ctx, 5);
      rainSource.loop = true;

      const rainLowpass = ctx.createBiquadFilter();
      rainLowpass.type = 'lowpass';
      rainLowpass.frequency.value = 1480;
      rainLowpass.Q.value = 0.35;

      const rainWarmth = ctx.createBiquadFilter();
      rainWarmth.type = 'lowshelf';
      rainWarmth.frequency.value = 240;
      rainWarmth.gain.value = 4.5;

      const rainBedGain = ctx.createGain();
      rainBedGain.gain.value = 0.72;

      rainSource.connect(rainLowpass);
      rainLowpass.connect(rainWarmth);
      rainWarmth.connect(rainBedGain);
      rainBedGain.connect(gain);
      rainSource.start();

      // 2. Soft harmonic background music pad (warm Fmaj9 breathing drone)
      const padBus = ctx.createGain();
      padBus.gain.value = 0.048;

      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.value = 520;

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.type = 'sine';
      lfo.frequency.value = 0.08; // gentle 12.5s breathing swell
      lfoGain.gain.value = 0.022;
      lfo.connect(lfoGain);
      lfoGain.connect(padBus.gain);
      lfo.start();
      ambientOscillators.push(lfo);

      const chordFreqs = [174.61, 261.63, 329.63, 392.0]; // F3, C4, E4, G4
      chordFreqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const voiceGain = ctx.createGain();
        osc.type = idx === 0 ? 'sine' : 'triangle';
        osc.frequency.value = freq;
        voiceGain.gain.value = idx === 0 ? 0.5 : 0.25;
        osc.connect(voiceGain);
        voiceGain.connect(padFilter);
        osc.start();
        ambientOscillators.push(osc);
        ambientNodes.push(voiceGain);
      });

      padFilter.connect(padBus);
      padBus.connect(gain);

      // 3. Soft forest echo bus for birdsong & raindrops
      const natureBus = ctx.createGain();
      natureBus.gain.value = 0.85;

      const natureFilter = ctx.createBiquadFilter();
      natureFilter.type = 'lowpass';
      natureFilter.frequency.value = 3400;

      const echoDelay = ctx.createDelay(1.0);
      echoDelay.delayTime.value = 0.28;
      const echoFeedback = ctx.createGain();
      echoFeedback.gain.value = 0.26;
      const echoWet = ctx.createGain();
      echoWet.gain.value = 0.34;

      natureBus.connect(natureFilter);
      natureFilter.connect(gain);
      natureFilter.connect(echoDelay);
      echoDelay.connect(echoFeedback);
      echoFeedback.connect(echoDelay);
      echoDelay.connect(echoWet);
      echoWet.connect(gain);

      ambientNodes.push(
        rainLowpass,
        rainWarmth,
        rainBedGain,
        padBus,
        padFilter,
        lfoGain,
        natureBus,
        natureFilter,
        echoDelay,
        echoFeedback,
        echoWet,
      );
      ambientSource = rainSource;
      ambientGain = gain;
      activeAmbientMode = mode;

      // Play an immediate gentle bird motif & droplet so preview/start feels alive right away
      triggerSoftRaindrop(ctx, natureBus);
      const introBirdTimer = window.setTimeout(() => {
        if (activeAmbientMode === 'rainBirds') {
          triggerForestBirdCall(ctx, natureBus);
        }
      }, 450);
      ambientTimers.push(introBirdTimer);

      const scheduleDrop = () => {
        if (activeAmbientMode !== 'rainBirds') return;
        triggerSoftRaindrop(ctx, natureBus);
        const id = window.setTimeout(scheduleDrop, 160 + Math.random() * 340);
        ambientTimers.push(id);
      };
      const firstDropTimer = window.setTimeout(scheduleDrop, 260);
      ambientTimers.push(firstDropTimer);

      const scheduleBird = () => {
        if (activeAmbientMode !== 'rainBirds') return;
        triggerForestBirdCall(ctx, natureBus);
        const id = window.setTimeout(scheduleBird, 2400 + Math.random() * 3600);
        ambientTimers.push(id);
      };
      const firstBirdTimer = window.setTimeout(scheduleBird, 2600);
      ambientTimers.push(firstBirdTimer);

      return;
    }

    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (mode === 'brown') {
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut + 0.02 * white) / 1.02;
        data[i] = lastOut * 3.2;
      }
    } else {
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let b3 = 0;
      let b4 = 0;
      let b5 = 0;
      let b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.06;
        b6 = white * 0.115926;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    if (mode === 'brown') {
      filter.type = 'lowpass';
      filter.frequency.value = 340;
    } else {
      filter.type = 'bandpass';
      filter.frequency.value = 950;
      filter.Q.value = 0.45;
    }

    source.connect(filter);
    filter.connect(gain);
    source.start();

    ambientNodes.push(filter);
    ambientSource = source;
    ambientGain = gain;
    activeAmbientMode = mode;
  } catch {
    stopAmbientNoise();
  }
}
