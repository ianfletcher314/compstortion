// Distortion types based on famous pedals
const DISTORTION_TYPES = [
  { id: 'ts9', name: 'TS9', description: 'Tube Screamer - mid-focused overdrive' },
  { id: 'rat', name: 'RAT', description: 'ProCo RAT - aggressive hard clipping' },
  { id: 'blues', name: 'BLUES', description: 'Blues Breaker - transparent overdrive' },
  { id: 'fuzz', name: 'FUZZ', description: 'Fuzz Face - vintage germanium fuzz' },
  { id: 'muff', name: 'MUFF', description: 'Big Muff - sustaining fuzz' },
];

// Amp types simulating famous amps
const AMP_TYPES = [
  { id: 'clean', name: 'CLEAN', description: 'Fender-style clean with sparkle' },
  { id: 'crunch', name: 'CRUNCH', description: 'Marshall-style edge of breakup' },
  { id: 'lead', name: 'LEAD', description: 'High-gain lead tone' },
  { id: 'modern', name: 'MODERN', description: 'Mesa-style tight high-gain' },
  { id: 'vintage', name: 'VINTAGE', description: 'Vox-style chimey breakup' },
];

// Modulation types
const MOD_TYPES = [
  { id: 'phaser', name: 'PHASE', description: 'Classic phaser sweep' },
  { id: 'flanger', name: 'FLANGE', description: 'Jet-like flanging effect' },
  { id: 'leslie', name: 'LESLIE', description: 'Rotary speaker simulation' },
  { id: 'vibrato', name: 'VIBRATO', description: 'Pitch modulation' },
  { id: 'tremolo', name: 'TREM', description: 'Volume modulation' },
];

// Reverb types
const REVERB_TYPES = [
  { id: 'spring', name: 'SPRING', description: 'Classic spring tank reverb' },
  { id: 'plate', name: 'PLATE', description: 'Smooth plate reverb' },
  { id: 'hall', name: 'HALL', description: 'Large hall reverb' },
];

// Pedal state
const state = {
  comp1: { active: false, threshold: 0.5, ratio: 0.5, attack: 0.3, release: 0.5, level: 0.5, blend: 1.0 },
  distortion: { active: false, drive: 0.5, tone: 0.5, level: 0.5, type: 0 },
  comp2: { active: false, threshold: 0.5, ratio: 0.5, attack: 0.3, release: 0.5, level: 0.5, blend: 1.0 },
  amp: { active: true, bass: 0.5, mid: 0.5, midfreq: 0.5, treble: 0.5, gain: 0.3, master: 0.7, type: 0 },
  modulation: { active: false, rate: 0.4, depth: 0.5, blend: 0.5, type: 0 },
  reverb: { active: false, decay: 0.5, blend: 0.3, tone: 0.5, type: 0 },
  pedalOrder: ['comp1', 'distortion', 'modulation', 'reverb', 'comp2', 'amp'],
  audioStarted: false,
  audioContext: null,
};

// Audio node references
let audioNodes = null;

// Compressor meter animation
let meterAnimationId = null;

// DOM Elements
const startButton = document.getElementById('start-audio');
const inputSelect = document.getElementById('input-select');

// Knob dragging state
let activeKnob = null;
let knobStartY = 0;
let knobStartValue = 0;

// Parameter mapping functions
function mapThreshold(value) {
  // 0-1 -> -60 to -10 dB
  return -60 + (value * 50);
}

function mapRatio(value) {
  // 0-1 -> 1:1 to 20:1
  return 1 + (value * 19);
}

function mapAttack(value) {
  // 0-1 -> 0.001 to 0.1 seconds
  return 0.001 + (value * 0.099);
}

function mapRelease(value) {
  // 0-1 -> 0.01 to 1 seconds
  return 0.01 + (value * 0.99);
}

function mapLevel(value) {
  // 0-1 -> 0 to 2 (with 0.5 = unity gain)
  return value * 2;
}

function mapDrive(value) {
  // 0-1 -> 1 to 20 (pre-gain multiplier)
  return 1 + (value * 19);
}

function mapTone(value, typeIndex = 0) {
  const type = DISTORTION_TYPES[typeIndex]?.id || 'ts9';

  // Different pedals have different tone stack characteristics
  switch (type) {
    case 'ts9':
      // TS9: Mid-focused, narrower range, doesn't get too dark
      return 800 + (value * 6000);
    case 'rat':
      // RAT: Wide range filter, can get very dark
      return 200 + (value * 8000);
    case 'blues':
      // Blues Breaker: Stays bright and open
      return 1000 + (value * 7000);
    case 'fuzz':
      // Fuzz Face: Can get muffled, vintage range
      return 400 + (value * 5000);
    case 'muff':
      // Big Muff: Scooped mids, extreme range
      return 300 + (value * 9000);
    default:
      return 500 + (value * 7500);
  }
}

// Amp EQ mapping functions
function mapAmpBass(value) {
  // 0-1 -> -12 to +12 dB
  return (value - 0.5) * 24;
}

function mapAmpMid(value) {
  // 0-1 -> -12 to +12 dB
  return (value - 0.5) * 24;
}

function mapAmpTreble(value) {
  // 0-1 -> -12 to +12 dB
  return (value - 0.5) * 24;
}

function mapAmpMidFreq(value) {
  // 0-1 -> 200Hz to 2000Hz (logarithmic)
  return 200 * Math.pow(10, value);
}

function mapAmpMaster(value) {
  // 0-1 -> 0 to 1.5 (with 0.7 being default)
  return value * 1.5;
}

function mapAmpGain(value, typeIndex = 0) {
  const type = AMP_TYPES[typeIndex]?.id || 'clean';

  // Different amps have different gain ranges
  switch (type) {
    case 'clean':
      return 1 + (value * 3); // 1-4x
    case 'crunch':
      return 2 + (value * 8); // 2-10x
    case 'lead':
      return 4 + (value * 16); // 4-20x
    case 'modern':
      return 5 + (value * 20); // 5-25x
    case 'vintage':
      return 1.5 + (value * 6); // 1.5-7.5x
    default:
      return 1 + (value * 10);
  }
}

// Modulation mapping functions
function mapModRate(value, typeIndex = 0) {
  const type = MOD_TYPES[typeIndex]?.id || 'phaser';
  switch (type) {
    case 'phaser':
      return 0.1 + (value * 4); // 0.1-4.1 Hz
    case 'flanger':
      return 0.05 + (value * 2); // 0.05-2.05 Hz
    case 'leslie':
      return 0.5 + (value * 6); // 0.5-6.5 Hz (slow to fast)
    case 'vibrato':
      return 1 + (value * 8); // 1-9 Hz
    case 'tremolo':
      return 1 + (value * 12); // 1-13 Hz
    default:
      return 0.5 + (value * 4);
  }
}

function mapModDepth(value, typeIndex = 0) {
  const type = MOD_TYPES[typeIndex]?.id || 'phaser';
  switch (type) {
    case 'phaser':
      return value * 1000; // 0-1000 (frequency sweep range)
    case 'flanger':
      return 0.001 + (value * 0.01); // 1-11ms delay time sweep
    case 'leslie':
      return value; // 0-1 intensity
    case 'vibrato':
      return value * 50; // 0-50 cents pitch deviation
    case 'tremolo':
      return value; // 0-1 volume modulation depth
    default:
      return value;
  }
}

// Reverb mapping functions
function mapReverbDecay(value, typeIndex = 0) {
  const type = REVERB_TYPES[typeIndex]?.id || 'spring';
  switch (type) {
    case 'spring':
      return 0.5 + (value * 2); // 0.5-2.5 seconds
    case 'plate':
      return 1 + (value * 3); // 1-4 seconds
    case 'hall':
      return 2 + (value * 6); // 2-8 seconds
    default:
      return 1 + (value * 3);
  }
}

function mapReverbTone(value) {
  // Low-pass filter frequency for reverb
  return 1000 + (value * 8000); // 1kHz - 9kHz
}

// Update tone filter Q and characteristics based on pedal type
function updateToneFilterForType(typeIndex) {
  if (!audioNodes || !audioNodes.distToneFilter) return;

  const type = DISTORTION_TYPES[typeIndex]?.id || 'ts9';

  switch (type) {
    case 'ts9':
      // TS9: Mid-hump, higher Q
      audioNodes.distToneFilter.Q.value = 1.2;
      break;
    case 'rat':
      // RAT: Flat response
      audioNodes.distToneFilter.Q.value = 0.5;
      break;
    case 'blues':
      // Blues Breaker: Open, transparent
      audioNodes.distToneFilter.Q.value = 0.4;
      break;
    case 'fuzz':
      // Fuzz Face: Slightly resonant
      audioNodes.distToneFilter.Q.value = 0.8;
      break;
    case 'muff':
      // Big Muff: Resonant peak
      audioNodes.distToneFilter.Q.value = 1.5;
      break;
    default:
      audioNodes.distToneFilter.Q.value = 0.7;
  }

  // Update the frequency based on current tone setting and new type
  audioNodes.distToneFilter.frequency.value = mapTone(state.distortion.tone, typeIndex);
}

// Create distortion curve for waveshaper based on type
function makeDistortionCurve(amount, typeIndex) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const type = DISTORTION_TYPES[typeIndex].id;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = applyDistortionAlgorithm(x, amount, type);
  }

  // Normalize the curve to prevent clipping
  let maxVal = 0;
  for (let i = 0; i < samples; i++) {
    maxVal = Math.max(maxVal, Math.abs(curve[i]));
  }
  if (maxVal > 0) {
    for (let i = 0; i < samples; i++) {
      curve[i] /= maxVal;
    }
  }

  return curve;
}

// Create amp saturation curve based on amp type
function makeAmpCurve(gain, typeIndex) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const type = AMP_TYPES[typeIndex]?.id || 'clean';

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = applyAmpAlgorithm(x, gain, type);
  }

  // Normalize
  let maxVal = 0;
  for (let i = 0; i < samples; i++) {
    maxVal = Math.max(maxVal, Math.abs(curve[i]));
  }
  if (maxVal > 0) {
    for (let i = 0; i < samples; i++) {
      curve[i] /= maxVal;
    }
  }

  return curve;
}

// Different amp saturation algorithms
function applyAmpAlgorithm(x, gain, type) {
  const k = gain;

  switch (type) {
    case 'clean':
      // Fender-style: Very soft saturation, mostly clean with subtle warmth
      // Only clips on peaks, maintains dynamics
      const cleanSignal = k * x;
      if (Math.abs(cleanSignal) < 0.8) {
        return cleanSignal;
      }
      // Gentle soft clip
      return Math.sign(cleanSignal) * (0.8 + 0.2 * Math.tanh((Math.abs(cleanSignal) - 0.8) * 3));

    case 'crunch':
      // Marshall-style: Asymmetric tube saturation, more breakup
      const crunchSignal = k * x;
      if (crunchSignal >= 0) {
        return Math.tanh(crunchSignal * 1.2);
      } else {
        // Asymmetric - negative clips a bit harder
        return Math.tanh(crunchSignal * 1.5) * 0.9;
      }

    case 'lead':
      // High-gain lead: More saturation, sustain, compression
      const leadSignal = k * x;
      // Double-stage saturation for more gain
      const stage1 = Math.tanh(leadSignal * 0.8);
      return Math.tanh(stage1 * 2);

    case 'modern':
      // Mesa-style: Tight, aggressive, focused
      const modernSignal = k * x;
      // Hard clipping with some softness
      const clipped = Math.max(-1, Math.min(1, modernSignal * 1.5));
      // Add some soft saturation character
      return clipped * 0.7 + Math.tanh(modernSignal) * 0.3;

    case 'vintage':
      // Vox-style: Chimey, jangly, class-A character
      const vintageSignal = k * x;
      // Asymmetric with more even harmonics
      if (vintageSignal >= 0) {
        return Math.tanh(vintageSignal);
      } else {
        // More compression on negative swing
        return Math.tanh(vintageSignal * 0.7) * 1.1;
      }

    default:
      return Math.tanh(k * x);
  }
}

// Different distortion algorithms
function applyDistortionAlgorithm(x, amount, type) {
  const k = amount * 50 + 1; // Ensure minimum gain

  switch (type) {
    case 'ts9':
      // Tube Screamer: Asymmetric soft clipping with mid-hump
      // Positive side clips earlier, warmer sound
      if (x >= 0) {
        return Math.tanh(k * 0.7 * x);
      } else {
        return Math.tanh(k * x);
      }

    case 'rat':
      // RAT: Hard clipping with sharp edges
      // More aggressive, buzzier distortion
      const ratGain = k * 1.5;
      const ratSignal = ratGain * x;
      if (ratSignal > 1) return 1;
      if (ratSignal < -1) return -1;
      // Slight soft knee near clipping threshold
      if (ratSignal > 0.8) return 0.8 + 0.2 * Math.tanh((ratSignal - 0.8) * 5);
      if (ratSignal < -0.8) return -0.8 + 0.2 * Math.tanh((ratSignal + 0.8) * 5);
      return ratSignal;

    case 'blues':
      // Blues Breaker: Very soft, transparent overdrive
      // Gentle compression, maintains dynamics
      const bluesK = k * 0.5;
      return (3 * bluesK * x) / (1 + 2 * Math.abs(bluesK * x));

    case 'fuzz':
      // Fuzz Face: Germanium-style asymmetric fuzz
      // Gated feel on low signals, splatter on high
      const fuzzGain = k * 2;
      const fuzzSignal = fuzzGain * x;
      // Asymmetric clipping with gate effect
      if (Math.abs(fuzzSignal) < 0.1) {
        return fuzzSignal * 0.5; // Gate effect on quiet signals
      }
      if (fuzzSignal >= 0) {
        return Math.tanh(fuzzSignal * 1.5);
      } else {
        // Asymmetric - negative clips harder
        return Math.max(-0.7, Math.tanh(fuzzSignal * 2));
      }

    case 'muff':
      // Big Muff: Sustaining fuzz with squared-off waveform
      // Creates that thick, wall-of-sound fuzz
      const muffGain = k * 1.2;
      const muffSignal = muffGain * x;
      // Combination of soft and hard clipping for sustain
      const soft = Math.tanh(muffSignal);
      const hard = Math.max(-1, Math.min(1, muffSignal * 2));
      // Blend based on drive amount
      return soft * (1 - amount * 0.5) + hard * (amount * 0.5);

    default:
      // Fallback: standard soft clipping
      return Math.tanh(k * x);
  }
}

// Initialize knob rotations from state
function initKnobs() {
  const knobs = document.querySelectorAll('.knob');
  console.log(`Found ${knobs.length} knobs`);

  knobs.forEach(knob => {
    const pedal = knob.dataset.pedal;
    const param = knob.dataset.param;

    if (state[pedal] && state[pedal][param] !== undefined) {
      const value = state[pedal][param];
      updateKnobRotation(knob, value);
      console.log(`Init knob: ${pedal}.${param} = ${value}`);
    } else {
      console.warn(`Missing state for ${pedal}.${param}`);
    }
  });
}

// Update distortion type display
function updateTypeDisplay() {
  const typeDisplay = document.getElementById('distortion-type-display');
  if (typeDisplay) {
    const currentType = DISTORTION_TYPES[state.distortion.type];
    typeDisplay.textContent = currentType.name;
    typeDisplay.title = currentType.description;
  }
}

// Update amp type display
function updateAmpTypeDisplay() {
  const typeDisplay = document.getElementById('amp-type-display');
  if (typeDisplay) {
    const currentType = AMP_TYPES[state.amp.type];
    typeDisplay.textContent = currentType.name;
    typeDisplay.title = currentType.description;
  }
}

// Cycle to next distortion type
function cycleDistortionType(direction = 1) {
  state.distortion.type = (state.distortion.type + direction + DISTORTION_TYPES.length) % DISTORTION_TYPES.length;
  updateTypeDisplay();
  updateAudioParams('distortion', 'type');
  console.log(`Distortion type: ${DISTORTION_TYPES[state.distortion.type].name}`);
}

// Cycle to next amp type
function cycleAmpType(direction = 1) {
  state.amp.type = (state.amp.type + direction + AMP_TYPES.length) % AMP_TYPES.length;
  updateAmpTypeDisplay();
  updateAudioParams('amp', 'type');
  console.log(`Amp type: ${AMP_TYPES[state.amp.type].name}`);
}

// Setup distortion type selector
function setupTypeSelector() {
  const typeSelector = document.getElementById('distortion-type-selector');
  if (typeSelector) {
    // Click cycles forward
    typeSelector.addEventListener('click', (e) => {
      e.preventDefault();
      cycleDistortionType(1);
    });

    // Right-click cycles backward
    typeSelector.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      cycleDistortionType(-1);
    });
  }

  // Initialize display
  updateTypeDisplay();
}

// Setup amp type selector
function setupAmpTypeSelector() {
  const typeSelector = document.getElementById('amp-type-selector');
  if (typeSelector) {
    // Click cycles forward
    typeSelector.addEventListener('click', (e) => {
      e.preventDefault();
      cycleAmpType(1);
    });

    // Right-click cycles backward
    typeSelector.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      cycleAmpType(-1);
    });
  }

  // Initialize display
  updateAmpTypeDisplay();
}

// Update modulation type display
function updateModTypeDisplay() {
  const typeDisplay = document.getElementById('mod-type-display');
  if (typeDisplay) {
    const currentType = MOD_TYPES[state.modulation.type];
    typeDisplay.textContent = currentType.name;
    typeDisplay.title = currentType.description;
  }
}

// Update reverb type display
function updateReverbTypeDisplay() {
  const typeDisplay = document.getElementById('reverb-type-display');
  if (typeDisplay) {
    const currentType = REVERB_TYPES[state.reverb.type];
    typeDisplay.textContent = currentType.name;
    typeDisplay.title = currentType.description;
  }
}

// Cycle modulation type
function cycleModType(direction = 1) {
  state.modulation.type = (state.modulation.type + direction + MOD_TYPES.length) % MOD_TYPES.length;
  updateModTypeDisplay();
  updateAudioParams('modulation', 'type');
  console.log(`Modulation type: ${MOD_TYPES[state.modulation.type].name}`);
}

// Cycle reverb type
function cycleReverbType(direction = 1) {
  state.reverb.type = (state.reverb.type + direction + REVERB_TYPES.length) % REVERB_TYPES.length;
  updateReverbTypeDisplay();
  updateAudioParams('reverb', 'type');
  console.log(`Reverb type: ${REVERB_TYPES[state.reverb.type].name}`);
}

// Setup modulation type selector
function setupModTypeSelector() {
  const typeSelector = document.getElementById('mod-type-selector');
  if (typeSelector) {
    typeSelector.addEventListener('click', (e) => {
      e.preventDefault();
      cycleModType(1);
    });
    typeSelector.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      cycleModType(-1);
    });
  }
  updateModTypeDisplay();
}

// Setup reverb type selector
function setupReverbTypeSelector() {
  const typeSelector = document.getElementById('reverb-type-selector');
  if (typeSelector) {
    typeSelector.addEventListener('click', (e) => {
      e.preventDefault();
      cycleReverbType(1);
    });
    typeSelector.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      cycleReverbType(-1);
    });
  }
  updateReverbTypeDisplay();
}

// Update knob visual rotation (value 0-1 maps to -135 to +135 degrees)
function updateKnobRotation(knob, value) {
  const rotation = (value * 270) - 135;
  const inner = knob.querySelector('.knob-inner');
  if (inner) {
    inner.style.transform = `rotate(${rotation}deg)`;
  }
}

// Update amp EQ filters based on amp type
function updateAmpEQForType(typeIndex) {
  if (!audioNodes) return;

  const type = AMP_TYPES[typeIndex]?.id || 'clean';

  // Set EQ characteristics based on amp type
  switch (type) {
    case 'clean':
      // Fender: Scooped mids, bright
      audioNodes.ampBassFilter.frequency.value = 100;
      audioNodes.ampMidFilter.frequency.value = 800;
      audioNodes.ampTrebleFilter.frequency.value = 3000;
      audioNodes.ampBassFilter.Q.value = 0.7;
      audioNodes.ampMidFilter.Q.value = 0.8;
      audioNodes.ampTrebleFilter.Q.value = 0.7;
      break;
    case 'crunch':
      // Marshall: Mid-focused
      audioNodes.ampBassFilter.frequency.value = 80;
      audioNodes.ampMidFilter.frequency.value = 650;
      audioNodes.ampTrebleFilter.frequency.value = 3500;
      audioNodes.ampBassFilter.Q.value = 0.8;
      audioNodes.ampMidFilter.Q.value = 1.2;
      audioNodes.ampTrebleFilter.Q.value = 0.8;
      break;
    case 'lead':
      // High-gain lead
      audioNodes.ampBassFilter.frequency.value = 90;
      audioNodes.ampMidFilter.frequency.value = 700;
      audioNodes.ampTrebleFilter.frequency.value = 4000;
      audioNodes.ampBassFilter.Q.value = 1.0;
      audioNodes.ampMidFilter.Q.value = 1.0;
      audioNodes.ampTrebleFilter.Q.value = 0.9;
      break;
    case 'modern':
      // Mesa: Tight bass, scooped mids
      audioNodes.ampBassFilter.frequency.value = 120;
      audioNodes.ampMidFilter.frequency.value = 500;
      audioNodes.ampTrebleFilter.frequency.value = 5000;
      audioNodes.ampBassFilter.Q.value = 1.2;
      audioNodes.ampMidFilter.Q.value = 0.6;
      audioNodes.ampTrebleFilter.Q.value = 1.0;
      break;
    case 'vintage':
      // Vox: Chimey, mid-forward
      audioNodes.ampBassFilter.frequency.value = 100;
      audioNodes.ampMidFilter.frequency.value = 1000;
      audioNodes.ampTrebleFilter.frequency.value = 2500;
      audioNodes.ampBassFilter.Q.value = 0.6;
      audioNodes.ampMidFilter.Q.value = 1.5;
      audioNodes.ampTrebleFilter.Q.value = 0.6;
      break;
  }

  // Update the waveshaper curve
  const gain = mapAmpGain(state.amp.gain, typeIndex);
  audioNodes.ampWaveshaper.curve = makeAmpCurve(gain, typeIndex);
}

// Ramp time constant for smooth parameter changes (prevents clicks)
const RAMP_TIME = 0.02; // 20ms ramp

// Helper to smoothly ramp a parameter
function rampParam(param, value, ctx) {
  param.setTargetAtTime(value, ctx.currentTime, RAMP_TIME);
}

// Update modulation depth based on type
function updateModDepth() {
  if (!audioNodes || !audioNodes.modLFOGain || !state.audioContext) return;

  const type = MOD_TYPES[state.modulation.type]?.id || 'phaser';
  const depth = state.modulation.depth;
  const ctx = state.audioContext;

  // First, mute all routing gains and modulation targets
  rampParam(audioNodes.modPhaserIn.gain, 0, ctx);
  rampParam(audioNodes.modFlangerIn.gain, 0, ctx);
  rampParam(audioNodes.modVibratoIn.gain, 0, ctx);
  rampParam(audioNodes.modTremoloIn.gain, 0, ctx);
  rampParam(audioNodes.modLFOGain.gain, 0, ctx);
  rampParam(audioNodes.modLFOGain2.gain, 0, ctx);
  rampParam(audioNodes.modTremoloLFOGain.gain, 0, ctx);

  switch (type) {
    case 'phaser':
      // Enable phaser routing and modulate allpass filter frequencies
      rampParam(audioNodes.modPhaserIn.gain, 1, ctx);
      rampParam(audioNodes.modLFOGain.gain, depth * 1500, ctx); // 0-1500Hz sweep
      break;

    case 'flanger':
      // Enable flanger routing and modulate delay time
      rampParam(audioNodes.modFlangerIn.gain, 1, ctx);
      rampParam(audioNodes.modLFOGain.gain, depth * 0.004, ctx); // 0-4ms sweep
      break;

    case 'vibrato':
      // Enable vibrato routing and modulate delay time for pitch wobble
      rampParam(audioNodes.modVibratoIn.gain, 1, ctx);
      rampParam(audioNodes.modLFOGain.gain, depth * 0.003, ctx); // 0-3ms sweep
      break;

    case 'tremolo':
      // Enable tremolo routing and modulate amplitude
      rampParam(audioNodes.modTremoloIn.gain, 1, ctx);
      rampParam(audioNodes.modTremoloLFOGain.gain, depth * 0.5, ctx);
      break;

    case 'leslie':
      // Enable tremolo routing (reuses tremolo chain) with both LFOs
      rampParam(audioNodes.modTremoloIn.gain, 1, ctx);
      rampParam(audioNodes.modTremoloLFOGain.gain, depth * 0.3, ctx);
      rampParam(audioNodes.modLFOGain2.gain, depth * 0.2, ctx);
      break;
  }
}

// Update modulation type - reconfigure the modulation chain
function updateModulationType() {
  if (!audioNodes || !state.audioContext) return;

  const type = MOD_TYPES[state.modulation.type]?.id || 'phaser';
  const ctx = state.audioContext;

  // Update LFO frequency for new type (with ramp to avoid click)
  const rate = mapModRate(state.modulation.rate, state.modulation.type);
  rampParam(audioNodes.modLFO.frequency, rate, ctx);
  rampParam(audioNodes.modLFO2.frequency, rate * 1.1, ctx);

  // Set LFO waveform based on effect type
  // Triangle waves are smoother and reduce clicking
  switch (type) {
    case 'phaser':
    case 'flanger':
      audioNodes.modLFO.type = 'triangle';
      break;
    case 'vibrato':
      audioNodes.modLFO.type = 'sine'; // Sine for natural vibrato
      break;
    case 'tremolo':
      audioNodes.modLFO.type = 'sine'; // Sine for smooth tremolo
      break;
    case 'leslie':
      audioNodes.modLFO.type = 'sine';
      audioNodes.modLFO2.type = 'sine';
      break;
  }

  // Reset allpass filter base frequencies for phaser
  if (audioNodes.modAllpass) {
    const phaserFreqs = [200, 400, 800, 1600, 3200, 6400];
    for (let i = 0; i < audioNodes.modAllpass.length; i++) {
      rampParam(audioNodes.modAllpass[i].frequency, phaserFreqs[i], ctx);
    }
  }

  // Update depth for new type (this also mutes unused paths)
  updateModDepth();

  console.log(`Modulation type updated to: ${type}`);
}

// Generate reverb impulse response
function generateReverbIR(ctx, decay, type) {
  const sampleRate = ctx.sampleRate;
  const length = sampleRate * decay;
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const channelData = impulse.getChannelData(channel);

    for (let i = 0; i < length; i++) {
      const t = i / sampleRate;
      let envelope;

      switch (type) {
        case 'spring':
          // Spring reverb: quick initial decay with metallic reflections
          envelope = Math.exp(-3 * t / decay) * (1 + 0.5 * Math.sin(t * 200) * Math.exp(-10 * t));
          break;
        case 'plate':
          // Plate reverb: dense, smooth decay
          envelope = Math.exp(-2 * t / decay);
          break;
        case 'hall':
          // Hall reverb: slow buildup, long tail
          envelope = Math.exp(-1.5 * t / decay) * (1 - Math.exp(-20 * t));
          break;
        default:
          envelope = Math.exp(-2 * t / decay);
      }

      channelData[i] = (Math.random() * 2 - 1) * envelope;
    }
  }

  return impulse;
}

// Update reverb impulse response
function updateReverbIR() {
  if (!audioNodes || !state.audioContext || !audioNodes.reverbConvolver) return;

  const type = REVERB_TYPES[state.reverb.type]?.id || 'spring';
  const decay = mapReverbDecay(state.reverb.decay, state.reverb.type);

  audioNodes.reverbConvolver.buffer = generateReverbIR(state.audioContext, decay, type);
  console.log(`Reverb updated: ${type}, decay: ${decay}s`);
}

// Update audio parameters based on current state
function updateAudioParams(pedal, param) {
  if (!audioNodes) return;

  const value = state[pedal][param];
  console.log(`Updating ${pedal}.${param} = ${value}`);

  if (pedal === 'comp1' && audioNodes.comp1Compressor) {
    switch (param) {
      case 'threshold':
        audioNodes.comp1Compressor.threshold.value = mapThreshold(value);
        break;
      case 'ratio':
        audioNodes.comp1Compressor.ratio.value = mapRatio(value);
        break;
      case 'attack':
        audioNodes.comp1Compressor.attack.value = mapAttack(value);
        break;
      case 'release':
        audioNodes.comp1Compressor.release.value = mapRelease(value);
        break;
      case 'level':
        if (state.comp1.active) {
          audioNodes.comp1Gain.gain.value = mapLevel(value);
        }
        break;
      case 'blend':
        if (state.comp1.active) {
          // Blend: 1 = 100% wet (compressed), 0 = 100% dry
          audioNodes.comp1Gain.gain.value = mapLevel(state.comp1.level) * value;
          audioNodes.comp1Dry.gain.value = mapLevel(state.comp1.level) * (1 - value);
        }
        break;
    }
  } else if (pedal === 'distortion' && audioNodes.distWaveshaper) {
    switch (param) {
      case 'drive':
        audioNodes.distPreGain.gain.value = mapDrive(value);
        audioNodes.distWaveshaper.curve = makeDistortionCurve(value, state.distortion.type);
        break;
      case 'type':
        audioNodes.distWaveshaper.curve = makeDistortionCurve(state.distortion.drive, value);
        updateToneFilterForType(value);
        break;
      case 'tone':
        audioNodes.distToneFilter.frequency.value = mapTone(value, state.distortion.type);
        break;
      case 'level':
        if (state.distortion.active) {
          audioNodes.distPostGain.gain.value = mapLevel(value);
        }
        break;
    }
  } else if (pedal === 'comp2' && audioNodes.comp2Compressor) {
    switch (param) {
      case 'threshold':
        audioNodes.comp2Compressor.threshold.value = mapThreshold(value);
        break;
      case 'ratio':
        audioNodes.comp2Compressor.ratio.value = mapRatio(value);
        break;
      case 'attack':
        audioNodes.comp2Compressor.attack.value = mapAttack(value);
        break;
      case 'release':
        audioNodes.comp2Compressor.release.value = mapRelease(value);
        break;
      case 'level':
        if (state.comp2.active) {
          audioNodes.comp2Gain.gain.value = mapLevel(value);
        }
        break;
      case 'blend':
        if (state.comp2.active) {
          // Blend: 1 = 100% wet (compressed), 0 = 100% dry
          audioNodes.comp2Gain.gain.value = mapLevel(state.comp2.level) * value;
          audioNodes.comp2Dry.gain.value = mapLevel(state.comp2.level) * (1 - value);
        }
        break;
    }
  } else if (pedal === 'amp' && audioNodes.ampWaveshaper) {
    switch (param) {
      case 'bass':
        audioNodes.ampBassFilter.gain.value = mapAmpBass(value);
        break;
      case 'mid':
        audioNodes.ampMidFilter.gain.value = mapAmpMid(value);
        break;
      case 'midfreq':
        audioNodes.ampMidFilter.frequency.value = mapAmpMidFreq(value);
        break;
      case 'treble':
        audioNodes.ampTrebleFilter.gain.value = mapAmpTreble(value);
        break;
      case 'gain':
        const gain = mapAmpGain(value, state.amp.type);
        audioNodes.ampPreGain.gain.value = gain;
        audioNodes.ampWaveshaper.curve = makeAmpCurve(gain, state.amp.type);
        break;
      case 'master':
        if (state.amp.active) {
          audioNodes.ampPostGain.gain.value = mapAmpMaster(value);
        }
        break;
      case 'type':
        updateAmpEQForType(value);
        break;
    }
  } else if (pedal === 'modulation' && audioNodes.modLFO) {
    const ctx = state.audioContext;
    switch (param) {
      case 'rate':
        rampParam(audioNodes.modLFO.frequency, mapModRate(value, state.modulation.type), ctx);
        // Also update second LFO for Leslie effect
        if (audioNodes.modLFO2) {
          rampParam(audioNodes.modLFO2.frequency, mapModRate(value, state.modulation.type) * 1.1, ctx);
        }
        break;
      case 'depth':
        updateModDepth();
        break;
      case 'blend':
        if (state.modulation.active) {
          rampParam(audioNodes.modWetGain.gain, value, ctx);
          rampParam(audioNodes.modDryGain.gain, 1 - value, ctx);
        }
        break;
      case 'type':
        updateModulationType();
        break;
    }
  } else if (pedal === 'reverb' && audioNodes.reverbConvolver) {
    switch (param) {
      case 'decay':
        updateReverbIR();
        break;
      case 'blend':
        if (state.reverb.active) {
          audioNodes.reverbWetGain.gain.value = value;
          audioNodes.reverbDryGain.gain.value = 1 - value;
        }
        break;
      case 'tone':
        audioNodes.reverbToneFilter.frequency.value = mapReverbTone(value);
        break;
      case 'type':
        updateReverbIR();
        break;
    }
  }
}

// Handle knob dragging - single document-level handler
function setupKnobInteraction() {
  // Mouse/touch down on knobs
  document.addEventListener('mousedown', (e) => {
    const knob = e.target.closest('.knob');
    if (knob) {
      activeKnob = knob;
      knobStartY = e.clientY;
      const pedal = knob.dataset.pedal;
      const param = knob.dataset.param;
      knobStartValue = state[pedal][param];
      document.body.style.cursor = 'ns-resize';
      e.preventDefault();
    }
  });

  document.addEventListener('touchstart', (e) => {
    const knob = e.target.closest('.knob');
    if (knob) {
      activeKnob = knob;
      knobStartY = e.touches[0].clientY;
      const pedal = knob.dataset.pedal;
      const param = knob.dataset.param;
      knobStartValue = state[pedal][param];
      e.preventDefault();
    }
  }, { passive: false });

  // Mouse/touch move
  document.addEventListener('mousemove', (e) => {
    if (!activeKnob) return;

    const deltaY = knobStartY - e.clientY;
    const sensitivity = 0.005;
    let newValue = knobStartValue + (deltaY * sensitivity);
    newValue = Math.max(0, Math.min(1, newValue));

    const pedal = activeKnob.dataset.pedal;
    const param = activeKnob.dataset.param;
    state[pedal][param] = newValue;
    updateKnobRotation(activeKnob, newValue);
    updateAudioParams(pedal, param);
  });

  document.addEventListener('touchmove', (e) => {
    if (!activeKnob) return;

    const deltaY = knobStartY - e.touches[0].clientY;
    const sensitivity = 0.005;
    let newValue = knobStartValue + (deltaY * sensitivity);
    newValue = Math.max(0, Math.min(1, newValue));

    const pedal = activeKnob.dataset.pedal;
    const param = activeKnob.dataset.param;
    state[pedal][param] = newValue;
    updateKnobRotation(activeKnob, newValue);
    updateAudioParams(pedal, param);
  }, { passive: false });

  // Mouse/touch up
  document.addEventListener('mouseup', () => {
    activeKnob = null;
    document.body.style.cursor = '';
  });

  document.addEventListener('touchend', () => {
    activeKnob = null;
  });
}

// Update bypass routing for a pedal
function updateBypass(pedalId) {
  if (!audioNodes) {
    console.log(`updateBypass(${pedalId}): no audioNodes`);
    return;
  }

  const isActive = state[pedalId].active;
  console.log(`updateBypass(${pedalId}): active=${isActive}`);

  if (pedalId === 'comp1') {
    if (isActive) {
      // Enable effect: mute bypass, set wet/dry based on blend
      const wetLevel = mapLevel(state.comp1.level) * state.comp1.blend;
      const dryLevel = mapLevel(state.comp1.level) * (1 - state.comp1.blend);
      audioNodes.comp1Bypass.gain.value = 0;
      audioNodes.comp1Gain.gain.value = wetLevel;
      audioNodes.comp1Dry.gain.value = dryLevel;
      console.log(`comp1 ON: bypass=0, wet=${wetLevel}, dry=${dryLevel}`);
    } else {
      // Bypass: mute effect chain, unmute bypass
      audioNodes.comp1Bypass.gain.value = 1;
      audioNodes.comp1Gain.gain.value = 0;
      audioNodes.comp1Dry.gain.value = 0;
      console.log(`comp1 OFF: bypass=1, wet=0, dry=0`);
    }
  } else if (pedalId === 'distortion') {
    if (isActive) {
      audioNodes.distBypass.gain.value = 0;
      audioNodes.distPostGain.gain.value = mapLevel(state.distortion.level);
      console.log(`distortion ON: bypass=0, gain=${mapLevel(state.distortion.level)}`);
    } else {
      audioNodes.distBypass.gain.value = 1;
      audioNodes.distPostGain.gain.value = 0;
      console.log(`distortion OFF: bypass=1, gain=0`);
    }
  } else if (pedalId === 'comp2') {
    if (isActive) {
      // Enable effect: mute bypass, set wet/dry based on blend
      const wetLevel = mapLevel(state.comp2.level) * state.comp2.blend;
      const dryLevel = mapLevel(state.comp2.level) * (1 - state.comp2.blend);
      audioNodes.comp2Bypass.gain.value = 0;
      audioNodes.comp2Gain.gain.value = wetLevel;
      audioNodes.comp2Dry.gain.value = dryLevel;
      console.log(`comp2 ON: bypass=0, wet=${wetLevel}, dry=${dryLevel}`);
    } else {
      audioNodes.comp2Bypass.gain.value = 1;
      audioNodes.comp2Gain.gain.value = 0;
      audioNodes.comp2Dry.gain.value = 0;
      console.log(`comp2 OFF: bypass=1, wet=0, dry=0`);
    }
  } else if (pedalId === 'amp') {
    if (isActive) {
      audioNodes.ampBypass.gain.value = 0;
      audioNodes.ampPostGain.gain.value = mapAmpMaster(state.amp.master);
      console.log(`amp ON: bypass=0, master=${mapAmpMaster(state.amp.master)}`);
    } else {
      audioNodes.ampBypass.gain.value = 1;
      audioNodes.ampPostGain.gain.value = 0;
      console.log(`amp OFF: bypass=1`);
    }
  } else if (pedalId === 'modulation') {
    const ctx = state.audioContext;
    if (isActive) {
      // Enable the correct effect chain routing
      updateModDepth();
      rampParam(audioNodes.modBypass.gain, 0, ctx);
      rampParam(audioNodes.modWetGain.gain, state.modulation.blend, ctx);
      rampParam(audioNodes.modDryGain.gain, 1 - state.modulation.blend, ctx);
      console.log(`modulation ON: bypass=0, blend=${state.modulation.blend}`);
    } else {
      rampParam(audioNodes.modBypass.gain, 1, ctx);
      rampParam(audioNodes.modWetGain.gain, 0, ctx);
      rampParam(audioNodes.modDryGain.gain, 0, ctx);
      console.log(`modulation OFF: bypass=1`);
    }
  } else if (pedalId === 'reverb') {
    if (isActive) {
      audioNodes.reverbBypass.gain.value = 0;
      audioNodes.reverbWetGain.gain.value = state.reverb.blend;
      audioNodes.reverbDryGain.gain.value = 1 - state.reverb.blend;
      console.log(`reverb ON: bypass=0, blend=${state.reverb.blend}`);
    } else {
      audioNodes.reverbBypass.gain.value = 1;
      audioNodes.reverbWetGain.gain.value = 0;
      audioNodes.reverbDryGain.gain.value = 0;
      console.log(`reverb OFF: bypass=1`);
    }
  }
}

// Toggle pedal on/off
function togglePedal(pedalId) {
  state[pedalId].active = !state[pedalId].active;

  const led = document.getElementById(`led-${pedalId}`);
  if (state[pedalId].active) {
    led.classList.add('active');
  } else {
    led.classList.remove('active');
  }

  updateBypass(pedalId);
}

// Setup footswitch interactions
function setupFootswitches() {
  document.querySelectorAll('.footswitch').forEach(footswitch => {
    footswitch.addEventListener('click', () => {
      const pedalId = footswitch.dataset.pedal;
      togglePedal(pedalId);

      // Visual feedback
      footswitch.classList.add('pressed');
      setTimeout(() => footswitch.classList.remove('pressed'), 100);
    });
  });
}

// Keyboard shortcuts (1-6 for each pedal based on order, D for distortion type, A for amp type, M for mod type, R for reverb type)
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    const key = e.key.toLowerCase();

    // Handle number keys 1-6 based on pedal order
    if (key >= '1' && key <= '6') {
      const index = parseInt(key, 10) - 1;
      if (index < state.pedalOrder.length) {
        const pedalId = state.pedalOrder[index];
        togglePedal(pedalId);
        animateFootswitch(pedalId);
      }
      return;
    }

    switch (key) {
      case 'd':
        // Cycle distortion type (shift+d for reverse)
        cycleDistortionType(e.shiftKey ? -1 : 1);
        break;
      case 'a':
        // Cycle amp type (shift+a for reverse)
        cycleAmpType(e.shiftKey ? -1 : 1);
        break;
      case 'm':
        // Cycle modulation type (shift+m for reverse)
        cycleModType(e.shiftKey ? -1 : 1);
        break;
      case 'r':
        // Cycle reverb type (shift+r for reverse)
        cycleReverbType(e.shiftKey ? -1 : 1);
        break;
    }
  });
}

function animateFootswitch(pedalId) {
  const footswitch = document.querySelector(`.footswitch[data-pedal="${pedalId}"]`);
  if (footswitch) {
    footswitch.classList.add('pressed');
    setTimeout(() => footswitch.classList.remove('pressed'), 100);
  }
}

// Populate audio input devices with individual channel options
async function populateInputDevices() {
  try {
    // Request permission first to get device labels
    await navigator.mediaDevices.getUserMedia({ audio: true });

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');

    inputSelect.innerHTML = '<option value="">Select Input Device</option>';
    audioInputs.forEach((device, idx) => {
      const label = device.label || `Microphone ${idx + 1}`;

      // Check if this looks like a multi-channel interface (Scarlett, Focusrite, etc.)
      const isInterface = /scarlett|focusrite|interface|audio|usb/i.test(label);

      if (isInterface) {
        // Add individual channel options for interfaces
        const option1 = document.createElement('option');
        option1.value = `${device.deviceId}:0`;
        option1.textContent = `${label} - Input 1`;
        inputSelect.appendChild(option1);

        const option2 = document.createElement('option');
        option2.value = `${device.deviceId}:1`;
        option2.textContent = `${label} - Input 2`;
        inputSelect.appendChild(option2);
      } else {
        // Single option for simple devices (built-in mic, etc.)
        const option = document.createElement('option');
        option.value = `${device.deviceId}:mono`;
        option.textContent = label;
        inputSelect.appendChild(option);
      }
    });

    inputSelect.disabled = false;
  } catch (err) {
    console.error('Error accessing audio devices:', err);
    inputSelect.innerHTML = '<option value="">Audio access denied</option>';
  }
}

// Create the audio processing chain
function createAudioChain(ctx, source, channel = 'mono') {
  audioNodes = {};

  // === INPUT CHANNEL SELECTION ===
  // For multi-channel interfaces, select the specific input channel
  audioNodes.inputSplitter = ctx.createChannelSplitter(2);
  audioNodes.inputGain = ctx.createGain();

  source.connect(audioNodes.inputSplitter);

  if (channel === 0) {
    // Left channel (Input 1)
    audioNodes.inputSplitter.connect(audioNodes.inputGain, 0);
    console.log('Using input channel: Left (Input 1)');
  } else if (channel === 1) {
    // Right channel (Input 2)
    audioNodes.inputSplitter.connect(audioNodes.inputGain, 1);
    console.log('Using input channel: Right (Input 2)');
  } else {
    // Mono - connect source directly (default behavior)
    source.connect(audioNodes.inputGain);
    console.log('Using input channel: Mono');
  }

  // === COMPRESSOR 1 ===
  audioNodes.comp1Input = ctx.createGain();
  audioNodes.comp1Compressor = ctx.createDynamicsCompressor();
  audioNodes.comp1Gain = ctx.createGain();      // Wet (compressed) signal
  audioNodes.comp1Dry = ctx.createGain();       // Dry (uncompressed) signal for blend
  audioNodes.comp1Bypass = ctx.createGain();    // Full bypass when pedal is off
  audioNodes.comp1Output = ctx.createGain();

  // Set compressor params
  audioNodes.comp1Compressor.threshold.value = mapThreshold(state.comp1.threshold);
  audioNodes.comp1Compressor.ratio.value = mapRatio(state.comp1.ratio);
  audioNodes.comp1Compressor.attack.value = mapAttack(state.comp1.attack);
  audioNodes.comp1Compressor.release.value = mapRelease(state.comp1.release);
  audioNodes.comp1Compressor.knee.value = 6;

  // Initial bypass state (bypassed)
  audioNodes.comp1Gain.gain.value = 0;
  audioNodes.comp1Dry.gain.value = 0;
  audioNodes.comp1Bypass.gain.value = 1;

  // Internal comp1 connections (input to output within pedal)
  // External connections are made later based on pedal order
  audioNodes.comp1Input.connect(audioNodes.comp1Compressor);
  audioNodes.comp1Compressor.connect(audioNodes.comp1Gain);
  audioNodes.comp1Gain.connect(audioNodes.comp1Output);
  audioNodes.comp1Input.connect(audioNodes.comp1Dry);        // Dry path for blend
  audioNodes.comp1Dry.connect(audioNodes.comp1Output);
  audioNodes.comp1Input.connect(audioNodes.comp1Bypass);     // Full bypass path
  audioNodes.comp1Bypass.connect(audioNodes.comp1Output);

  // === DISTORTION ===
  audioNodes.distInput = ctx.createGain();
  audioNodes.distPreGain = ctx.createGain();
  audioNodes.distWaveshaper = ctx.createWaveShaper();
  audioNodes.distToneFilter = ctx.createBiquadFilter();
  audioNodes.distPostGain = ctx.createGain();
  audioNodes.distBypass = ctx.createGain();
  audioNodes.distOutput = ctx.createGain();

  // Set distortion params
  audioNodes.distPreGain.gain.value = mapDrive(state.distortion.drive);
  audioNodes.distWaveshaper.curve = makeDistortionCurve(state.distortion.drive, state.distortion.type);
  audioNodes.distWaveshaper.oversample = '4x';
  audioNodes.distToneFilter.type = 'lowpass';
  audioNodes.distToneFilter.frequency.value = mapTone(state.distortion.tone, state.distortion.type);
  updateToneFilterForType(state.distortion.type);

  // Initial bypass state
  audioNodes.distPostGain.gain.value = 0;
  audioNodes.distBypass.gain.value = 1;

  // Internal distortion connections
  audioNodes.distInput.connect(audioNodes.distPreGain);
  audioNodes.distPreGain.connect(audioNodes.distWaveshaper);
  audioNodes.distWaveshaper.connect(audioNodes.distToneFilter);
  audioNodes.distToneFilter.connect(audioNodes.distPostGain);
  audioNodes.distPostGain.connect(audioNodes.distOutput);
  audioNodes.distInput.connect(audioNodes.distBypass);
  audioNodes.distBypass.connect(audioNodes.distOutput);

  // === COMPRESSOR 2 ===
  audioNodes.comp2Input = ctx.createGain();
  audioNodes.comp2Compressor = ctx.createDynamicsCompressor();
  audioNodes.comp2Gain = ctx.createGain();      // Wet (compressed) signal
  audioNodes.comp2Dry = ctx.createGain();       // Dry (uncompressed) signal for blend
  audioNodes.comp2Bypass = ctx.createGain();    // Full bypass when pedal is off
  audioNodes.comp2Output = ctx.createGain();

  // Set compressor params
  audioNodes.comp2Compressor.threshold.value = mapThreshold(state.comp2.threshold);
  audioNodes.comp2Compressor.ratio.value = mapRatio(state.comp2.ratio);
  audioNodes.comp2Compressor.attack.value = mapAttack(state.comp2.attack);
  audioNodes.comp2Compressor.release.value = mapRelease(state.comp2.release);
  audioNodes.comp2Compressor.knee.value = 6;

  // Initial bypass state
  audioNodes.comp2Gain.gain.value = 0;
  audioNodes.comp2Dry.gain.value = 0;
  audioNodes.comp2Bypass.gain.value = 1;

  // Internal comp2 connections
  audioNodes.comp2Input.connect(audioNodes.comp2Compressor);
  audioNodes.comp2Compressor.connect(audioNodes.comp2Gain);
  audioNodes.comp2Gain.connect(audioNodes.comp2Output);
  audioNodes.comp2Input.connect(audioNodes.comp2Dry);        // Dry path for blend
  audioNodes.comp2Dry.connect(audioNodes.comp2Output);
  audioNodes.comp2Input.connect(audioNodes.comp2Bypass);     // Full bypass path
  audioNodes.comp2Bypass.connect(audioNodes.comp2Output);

  // === AMP SIMULATOR ===
  audioNodes.ampInput = ctx.createGain();
  audioNodes.ampPreGain = ctx.createGain();
  audioNodes.ampWaveshaper = ctx.createWaveShaper();

  // Cabinet simulation using EQ
  audioNodes.ampBassFilter = ctx.createBiquadFilter();
  audioNodes.ampMidFilter = ctx.createBiquadFilter();
  audioNodes.ampTrebleFilter = ctx.createBiquadFilter();

  // High-cut filter to simulate speaker rolloff
  audioNodes.ampCabFilter = ctx.createBiquadFilter();
  // Low-cut to remove mud
  audioNodes.ampHighpassFilter = ctx.createBiquadFilter();

  audioNodes.ampPostGain = ctx.createGain();
  audioNodes.ampBypass = ctx.createGain();
  audioNodes.ampOutput = ctx.createGain();

  // Set amp params
  const ampGain = mapAmpGain(state.amp.gain, state.amp.type);
  audioNodes.ampPreGain.gain.value = ampGain;
  audioNodes.ampWaveshaper.curve = makeAmpCurve(ampGain, state.amp.type);
  audioNodes.ampWaveshaper.oversample = '4x';

  // Bass EQ (low shelf)
  audioNodes.ampBassFilter.type = 'lowshelf';
  audioNodes.ampBassFilter.frequency.value = 100;
  audioNodes.ampBassFilter.gain.value = mapAmpBass(state.amp.bass);

  // Mid EQ (peaking)
  audioNodes.ampMidFilter.type = 'peaking';
  audioNodes.ampMidFilter.frequency.value = mapAmpMidFreq(state.amp.midfreq);
  audioNodes.ampMidFilter.Q.value = 1.0;
  audioNodes.ampMidFilter.gain.value = mapAmpMid(state.amp.mid);

  // Treble EQ (high shelf)
  audioNodes.ampTrebleFilter.type = 'highshelf';
  audioNodes.ampTrebleFilter.frequency.value = 3000;
  audioNodes.ampTrebleFilter.gain.value = mapAmpTreble(state.amp.treble);

  // Cabinet simulation - high cut (speaker rolloff around 5-6kHz)
  audioNodes.ampCabFilter.type = 'lowpass';
  audioNodes.ampCabFilter.frequency.value = 5500;
  audioNodes.ampCabFilter.Q.value = 0.7;

  // High-pass to remove rumble (typical cab doesn't reproduce below ~80Hz well)
  audioNodes.ampHighpassFilter.type = 'highpass';
  audioNodes.ampHighpassFilter.frequency.value = 80;
  audioNodes.ampHighpassFilter.Q.value = 0.7;

  // Initial state - amp ON by default
  audioNodes.ampPostGain.gain.value = mapAmpMaster(state.amp.master);
  audioNodes.ampBypass.gain.value = 0;

  // Internal amp connections
  audioNodes.ampInput.connect(audioNodes.ampPreGain);
  audioNodes.ampPreGain.connect(audioNodes.ampWaveshaper);
  audioNodes.ampWaveshaper.connect(audioNodes.ampBassFilter);
  audioNodes.ampBassFilter.connect(audioNodes.ampMidFilter);
  audioNodes.ampMidFilter.connect(audioNodes.ampTrebleFilter);
  audioNodes.ampTrebleFilter.connect(audioNodes.ampHighpassFilter);
  audioNodes.ampHighpassFilter.connect(audioNodes.ampCabFilter);
  audioNodes.ampCabFilter.connect(audioNodes.ampPostGain);
  audioNodes.ampPostGain.connect(audioNodes.ampOutput);
  audioNodes.ampInput.connect(audioNodes.ampBypass);
  audioNodes.ampBypass.connect(audioNodes.ampOutput);

  // === MODULATION ===
  audioNodes.modInput = ctx.createGain();
  audioNodes.modOutput = ctx.createGain();
  audioNodes.modBypass = ctx.createGain();
  audioNodes.modWetGain = ctx.createGain();
  audioNodes.modDryGain = ctx.createGain();

  // LFO for modulation (using triangle wave for smoother transitions)
  audioNodes.modLFO = ctx.createOscillator();
  audioNodes.modLFO.type = 'triangle';
  audioNodes.modLFO.frequency.value = mapModRate(state.modulation.rate, state.modulation.type);
  audioNodes.modLFOGain = ctx.createGain();
  audioNodes.modLFOGain.gain.value = 0;

  // Second LFO for leslie horn simulation (slightly detuned)
  audioNodes.modLFO2 = ctx.createOscillator();
  audioNodes.modLFO2.type = 'triangle';
  audioNodes.modLFO2.frequency.value = mapModRate(state.modulation.rate, state.modulation.type) * 1.1;
  audioNodes.modLFOGain2 = ctx.createGain();
  audioNodes.modLFOGain2.gain.value = 0;

  // === ROUTING GAIN NODES ===
  // These control which effect chain receives signal (only one active at a time)
  audioNodes.modPhaserIn = ctx.createGain();
  audioNodes.modFlangerIn = ctx.createGain();
  audioNodes.modVibratoIn = ctx.createGain();
  audioNodes.modTremoloIn = ctx.createGain();

  // Initialize all routing gains to 0 (will be set by updateModDepth)
  audioNodes.modPhaserIn.gain.value = 0;
  audioNodes.modFlangerIn.gain.value = 0;
  audioNodes.modVibratoIn.gain.value = 0;
  audioNodes.modTremoloIn.gain.value = 0;

  // Allpass filters for phaser effect (6-stage for richer phasing)
  audioNodes.modAllpass = [];
  const phaserFreqs = [200, 400, 800, 1600, 3200, 6400];
  for (let i = 0; i < 6; i++) {
    const allpass = ctx.createBiquadFilter();
    allpass.type = 'allpass';
    allpass.frequency.value = phaserFreqs[i];
    allpass.Q.value = 1.0;
    audioNodes.modAllpass.push(allpass);
  }

  // Delay for flanger effect
  audioNodes.modDelay = ctx.createDelay(0.05);
  audioNodes.modDelay.delayTime.value = 0.007; // Base delay for flanger

  // Separate vibrato delay - uses shorter base delay for pitch modulation
  audioNodes.modVibratoDelay = ctx.createDelay(0.02);
  audioNodes.modVibratoDelay.delayTime.value = 0.005; // 5ms center point

  // Tremolo/Leslie amplitude modulation
  audioNodes.modTremoloGain = ctx.createGain();
  audioNodes.modTremoloGain.gain.value = 1;

  // Tremolo LFO scaling (to modulate around 1.0, not 0.0)
  audioNodes.modTremoloLFOGain = ctx.createGain();
  audioNodes.modTremoloLFOGain.gain.value = 0;

  // Start LFOs
  audioNodes.modLFO.start();
  audioNodes.modLFO2.start();

  // Connect LFOs through their gain controls
  audioNodes.modLFO.connect(audioNodes.modLFOGain);
  audioNodes.modLFO2.connect(audioNodes.modLFOGain2);

  // === CONNECT INPUT TO ALL ROUTING GAINS ===
  audioNodes.modInput.connect(audioNodes.modPhaserIn);
  audioNodes.modInput.connect(audioNodes.modFlangerIn);
  audioNodes.modInput.connect(audioNodes.modVibratoIn);
  audioNodes.modInput.connect(audioNodes.modTremoloIn);

  // === PHASER CHAIN ===
  // Routing -> allpass cascade -> wet output
  let lastNode = audioNodes.modPhaserIn;
  for (const allpass of audioNodes.modAllpass) {
    lastNode.connect(allpass);
    audioNodes.modLFOGain.connect(allpass.frequency);
    lastNode = allpass;
  }
  lastNode.connect(audioNodes.modWetGain);

  // === FLANGER CHAIN ===
  // Routing -> modulated delay -> wet output
  audioNodes.modFlangerIn.connect(audioNodes.modDelay);
  audioNodes.modLFOGain.connect(audioNodes.modDelay.delayTime);
  audioNodes.modDelay.connect(audioNodes.modWetGain);

  // === VIBRATO CHAIN ===
  // Routing -> short modulated delay (100% wet) -> wet output
  audioNodes.modVibratoIn.connect(audioNodes.modVibratoDelay);
  audioNodes.modLFOGain.connect(audioNodes.modVibratoDelay.delayTime);
  audioNodes.modVibratoDelay.connect(audioNodes.modWetGain);

  // === TREMOLO/LESLIE CHAIN ===
  // Routing -> amplitude modulated gain -> wet output
  audioNodes.modLFO.connect(audioNodes.modTremoloLFOGain);
  audioNodes.modTremoloLFOGain.connect(audioNodes.modTremoloGain.gain);
  audioNodes.modTremoloIn.connect(audioNodes.modTremoloGain);
  audioNodes.modTremoloGain.connect(audioNodes.modWetGain);

  // Leslie uses both LFOs for horn/drum simulation
  audioNodes.modLFOGain2.connect(audioNodes.modTremoloGain.gain);

  // Dry path
  audioNodes.modInput.connect(audioNodes.modDryGain);
  audioNodes.modDryGain.connect(audioNodes.modOutput);
  audioNodes.modWetGain.connect(audioNodes.modOutput);

  // Bypass path
  audioNodes.modInput.connect(audioNodes.modBypass);
  audioNodes.modBypass.connect(audioNodes.modOutput);

  // Initial bypass state
  audioNodes.modWetGain.gain.value = 0;
  audioNodes.modDryGain.gain.value = 0;
  audioNodes.modBypass.gain.value = 1;

  // === REVERB ===
  audioNodes.reverbInput = ctx.createGain();
  audioNodes.reverbOutput = ctx.createGain();
  audioNodes.reverbBypass = ctx.createGain();
  audioNodes.reverbWetGain = ctx.createGain();
  audioNodes.reverbDryGain = ctx.createGain();

  // Convolver for reverb
  audioNodes.reverbConvolver = ctx.createConvolver();

  // Tone filter for reverb
  audioNodes.reverbToneFilter = ctx.createBiquadFilter();
  audioNodes.reverbToneFilter.type = 'lowpass';
  audioNodes.reverbToneFilter.frequency.value = mapReverbTone(state.reverb.tone);
  audioNodes.reverbToneFilter.Q.value = 0.5;

  // Generate initial impulse response
  const initialDecay = mapReverbDecay(state.reverb.decay, state.reverb.type);
  const initialType = REVERB_TYPES[state.reverb.type]?.id || 'spring';
  audioNodes.reverbConvolver.buffer = generateReverbIR(ctx, initialDecay, initialType);

  // Connect reverb chain
  audioNodes.reverbInput.connect(audioNodes.reverbConvolver);
  audioNodes.reverbConvolver.connect(audioNodes.reverbToneFilter);
  audioNodes.reverbToneFilter.connect(audioNodes.reverbWetGain);
  audioNodes.reverbWetGain.connect(audioNodes.reverbOutput);

  // Dry path
  audioNodes.reverbInput.connect(audioNodes.reverbDryGain);
  audioNodes.reverbDryGain.connect(audioNodes.reverbOutput);

  // Bypass path
  audioNodes.reverbInput.connect(audioNodes.reverbBypass);
  audioNodes.reverbBypass.connect(audioNodes.reverbOutput);

  // Initial bypass state
  audioNodes.reverbWetGain.gain.value = 0;
  audioNodes.reverbDryGain.gain.value = 0;
  audioNodes.reverbBypass.gain.value = 1;

  // === STEREO OUTPUT (dual mono) ===
  // Use a channel splitter and merger to send mono signal to both L and R
  audioNodes.stereoSplitter = ctx.createChannelSplitter(2);
  audioNodes.stereoMerger = ctx.createChannelMerger(2);

  // Stereo merger setup (pedal chain connects to splitter via connectPedalsInOrder)
  audioNodes.stereoSplitter.connect(audioNodes.stereoMerger, 0, 0); // Input ch 0 -> Output L
  audioNodes.stereoSplitter.connect(audioNodes.stereoMerger, 0, 1); // Input ch 0 -> Output R

  // Final output
  audioNodes.stereoMerger.connect(ctx.destination);

  // Connect pedals in the configured order
  connectPedalsInOrder();

  console.log('Audio chain created with pedal order:', state.pedalOrder);

  // Apply current pedal states
  updateBypass('comp1');
  updateBypass('distortion');
  updateBypass('comp2');
  updateBypass('amp');
  updateBypass('modulation');
  updateBypass('reverb');

  // Initialize amp LED state
  const ampLed = document.getElementById('led-amp');
  if (ampLed && state.amp.active) {
    ampLed.classList.add('active');
  }
}

// Start audio
async function startAudio() {
  if (state.audioStarted) {
    // Stop audio
    stopMeterAnimation();
    if (state.audioContext) {
      await state.audioContext.close();
      state.audioContext = null;
      audioNodes = null;
    }
    state.audioStarted = false;
    startButton.textContent = 'Start Audio';
    startButton.classList.remove('running');
    updateDraggableState();
    console.log('Audio stopped');
    return;
  }

  try {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Parse device:channel format from selector
    const selectedValue = inputSelect.value || '';
    const [deviceId, channelStr] = selectedValue.split(':');
    const channel = channelStr === 'mono' ? 'mono' : parseInt(channelStr, 10);

    const constraints = {
      audio: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const source = state.audioContext.createMediaStreamSource(stream);

    createAudioChain(state.audioContext, source, channel);

    state.audioStarted = true;
    startButton.textContent = 'Stop Audio';
    startButton.classList.add('running');
    updateDraggableState();

    // Start compressor meter animation
    startMeterAnimation();

    console.log('Audio started! Sample rate:', state.audioContext.sampleRate);
  } catch (err) {
    console.error('Error starting audio:', err);
    alert('Could not start audio. Please check your input device and permissions.');
  }
}

// Gain reduction thresholds for each LED bar (in dB)
const GR_THRESHOLDS = [20, 15, 10, 8, 6, 4, 2, 1];

// Update the bar meter based on gain reduction
function updateGRMeter(meterId, reductionDb) {
  const meter = document.getElementById(meterId);
  if (!meter) return;

  const bars = meter.querySelectorAll('.gr-bar');
  const absReduction = Math.abs(reductionDb);

  bars.forEach(bar => {
    const threshold = parseInt(bar.dataset.db, 10);
    if (absReduction >= threshold) {
      bar.classList.add('active');
    } else {
      bar.classList.remove('active');
    }
  });
}

// Compressor LED meter animation
// Reads gain reduction from compressors and updates LED intensity + bar meters
function updateCompressorMeters() {
  if (!audioNodes) {
    meterAnimationId = null;
    return;
  }

  // Comp1
  if (audioNodes.comp1Compressor && state.comp1.active) {
    const reduction1 = audioNodes.comp1Compressor.reduction;

    // Update LED intensity
    const led1 = document.getElementById('led-comp1');
    if (led1) {
      const intensity1 = Math.min(1, Math.abs(reduction1) / 24);
      led1.style.setProperty('--compression-intensity', intensity1.toFixed(3));
    }

    // Update bar meter
    updateGRMeter('gr-meter-comp1', reduction1);
  } else {
    // Clear meter when inactive
    updateGRMeter('gr-meter-comp1', 0);
  }

  // Comp2
  if (audioNodes.comp2Compressor && state.comp2.active) {
    const reduction2 = audioNodes.comp2Compressor.reduction;

    // Update LED intensity
    const led2 = document.getElementById('led-comp2');
    if (led2) {
      const intensity2 = Math.min(1, Math.abs(reduction2) / 24);
      led2.style.setProperty('--compression-intensity', intensity2.toFixed(3));
    }

    // Update bar meter
    updateGRMeter('gr-meter-comp2', reduction2);
  } else {
    // Clear meter when inactive
    updateGRMeter('gr-meter-comp2', 0);
  }

  // Continue animation loop
  meterAnimationId = requestAnimationFrame(updateCompressorMeters);
}

// Start the meter animation
function startMeterAnimation() {
  if (!meterAnimationId) {
    meterAnimationId = requestAnimationFrame(updateCompressorMeters);
  }
}

// Stop the meter animation
function stopMeterAnimation() {
  if (meterAnimationId) {
    cancelAnimationFrame(meterAnimationId);
    meterAnimationId = null;
  }
  // Reset LED intensities
  const led1 = document.getElementById('led-comp1');
  const led2 = document.getElementById('led-comp2');
  if (led1) led1.style.setProperty('--compression-intensity', '0');
  if (led2) led2.style.setProperty('--compression-intensity', '0');

  // Clear bar meters
  updateGRMeter('gr-meter-comp1', 0);
  updateGRMeter('gr-meter-comp2', 0);
}

// Drag and drop state
let draggedPedal = null;

// Get pedal input/output nodes by pedal ID
function getPedalIO(pedalId) {
  const mapping = {
    comp1: { input: audioNodes.comp1Input, output: audioNodes.comp1Output },
    distortion: { input: audioNodes.distInput, output: audioNodes.distOutput },
    comp2: { input: audioNodes.comp2Input, output: audioNodes.comp2Output },
    amp: { input: audioNodes.ampInput, output: audioNodes.ampOutput },
    modulation: { input: audioNodes.modInput, output: audioNodes.modOutput },
    reverb: { input: audioNodes.reverbInput, output: audioNodes.reverbOutput },
  };
  return mapping[pedalId];
}

// Connect pedals in order based on state.pedalOrder
function connectPedalsInOrder() {
  if (!audioNodes) return;

  // Connect input to first pedal
  const firstPedal = getPedalIO(state.pedalOrder[0]);
  audioNodes.inputGain.connect(firstPedal.input);

  // Connect each pedal to the next
  for (let i = 0; i < state.pedalOrder.length - 1; i++) {
    const currentPedal = getPedalIO(state.pedalOrder[i]);
    const nextPedal = getPedalIO(state.pedalOrder[i + 1]);
    currentPedal.output.connect(nextPedal.input);
  }

  // Connect last pedal to stereo output
  const lastPedal = getPedalIO(state.pedalOrder[state.pedalOrder.length - 1]);
  lastPedal.output.connect(audioNodes.stereoSplitter);

  console.log('Pedals connected in order:', state.pedalOrder);
}

// Setup drag and drop for pedal reordering
function setupDragAndDrop() {
  const pedalBoard = document.querySelector('.pedal-board');
  const pedals = document.querySelectorAll('.pedal');

  pedals.forEach(pedal => {
    pedal.setAttribute('draggable', 'true');

    pedal.addEventListener('dragstart', (e) => {
      if (state.audioStarted) {
        e.preventDefault();
        return;
      }
      draggedPedal = pedal;
      pedal.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    pedal.addEventListener('dragend', () => {
      pedal.classList.remove('dragging');
      draggedPedal = null;
      // Remove all drag-over states
      pedals.forEach(p => p.classList.remove('drag-over'));
    });

    pedal.addEventListener('dragover', (e) => {
      if (state.audioStarted || !draggedPedal || draggedPedal === pedal) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      pedal.classList.add('drag-over');
    });

    pedal.addEventListener('dragleave', () => {
      pedal.classList.remove('drag-over');
    });

    pedal.addEventListener('drop', (e) => {
      e.preventDefault();
      pedal.classList.remove('drag-over');

      if (state.audioStarted || !draggedPedal || draggedPedal === pedal) return;

      // Get pedal IDs
      const draggedId = draggedPedal.id;
      const targetId = pedal.id;

      // Update DOM order
      const rect = pedal.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      if (e.clientX < midpoint) {
        pedalBoard.insertBefore(draggedPedal, pedal);
      } else {
        pedalBoard.insertBefore(draggedPedal, pedal.nextSibling);
      }

      // Update state order
      updatePedalOrder();
    });
  });

  // Update draggable state based on audio
  updateDraggableState();
}

// Update pedal order in state based on DOM order
function updatePedalOrder() {
  const pedals = document.querySelectorAll('.pedal-board .pedal');
  state.pedalOrder = Array.from(pedals).map(p => p.id);
  console.log('Pedal order updated:', state.pedalOrder);

  // Update footswitch labels to match new order
  updateFootswitchLabels();
}

// Update footswitch labels based on current pedal order
function updateFootswitchLabels() {
  state.pedalOrder.forEach((pedalId, index) => {
    const footswitch = document.querySelector(`.footswitch[data-pedal="${pedalId}"]`);
    if (footswitch) {
      const label = footswitch.querySelector('.footswitch-label');
      if (label) {
        label.textContent = index + 1;
      }
    }
  });
}

// Enable/disable dragging based on audio state
function updateDraggableState() {
  const pedals = document.querySelectorAll('.pedal');
  pedals.forEach(pedal => {
    if (state.audioStarted) {
      pedal.classList.add('no-drag');
    } else {
      pedal.classList.remove('no-drag');
    }
  });
}

// Initialize
function init() {
  initKnobs();
  setupKnobInteraction();
  setupFootswitches();
  setupKeyboardShortcuts();
  setupTypeSelector();
  setupAmpTypeSelector();
  setupModTypeSelector();
  setupReverbTypeSelector();
  setupDragAndDrop();
  populateInputDevices();

  // Set initial footswitch labels based on pedal order
  updateFootswitchLabels();

  startButton.addEventListener('click', startAudio);

  // Initialize amp LED to active state
  const ampLed = document.getElementById('led-amp');
  if (ampLed && state.amp.active) {
    ampLed.classList.add('active');
  }

  console.log('Compstortion initialized with amp, modulation, and reverb');
}

document.addEventListener('DOMContentLoaded', init);
