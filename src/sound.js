// Plain JS Web Audio synthesis helpers.
// Kept as hand-written JS (rather than Fable emitJsExpr interop) because the
// Web Audio API's mutable, chained-call style doesn't translate cleanly to
// F#'s emit interop — same rationale as isolating BLE/ESC-POS printing as
// plain JS in the Tokecang project.
//
// Exposed functions are imported into F# via simple `[<Import>]` bindings
// (see Sound.fs), so F# code never has to touch raw AudioContext objects.

let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playAwardChime() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;

  // Bass impact thump
  const impact = ctx.createOscillator();
  const impactGain = ctx.createGain();
  impact.type = "sine";
  impact.frequency.setValueAtTime(180, now);
  impact.frequency.exponentialRampToValueAtTime(50, now + 0.18);
  impactGain.gain.setValueAtTime(0.5, now);
  impactGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  impact.connect(impactGain);
  impactGain.connect(ctx.destination);
  impact.start(now);
  impact.stop(now + 0.25);

  // Noise burst texture
  const bufferSize = ctx.sampleRate * 0.08;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer;
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.3, now);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 800;
  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);

  // Ascending sparkle arpeggio with harmonic shimmer
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
  const sparkleStart = now + 0.1;
  notes.forEach((freq, i) => {
    const start = sparkleStart + i * 0.09;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.55);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.value = freq * 2;
    gain2.gain.setValueAtTime(0, start);
    gain2.gain.linearRampToValueAtTime(0.08, start + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(start);
    osc2.stop(start + 0.45);
  });

  // Final sustained landing chord
  const chordStart = sparkleStart + notes.length * 0.09 + 0.05;
  [523.25, 659.25, 783.99, 1046.5].forEach((freq) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, chordStart);
    gain.gain.linearRampToValueAtTime(0.22, chordStart + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, chordStart + 0.9);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(chordStart);
    osc.stop(chordStart + 0.95);
  });
}

export function playTapSound() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 700;
  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.14);
}

export function playRedeemChime() {
  const ctx = getAudioCtx();
  const now = ctx.currentTime;
  const notes = [392, 493.88, 587.33, 783.99];
  notes.forEach((freq, i) => {
    const start = now + i * 0.11;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.5);
  });
}
