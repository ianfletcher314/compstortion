// Distortion types based on famous pedals
const DISTORTION_TYPES = [
  { id: 'ts9', name: 'TS9', description: 'Tube Screamer - mid-focused overdrive' },
  { id: 'rat', name: 'RAT', description: 'ProCo RAT - aggressive hard clipping' },
  { id: 'blues', name: 'BLUES', description: 'Blues Breaker - transparent overdrive' },
  { id: 'fuzz', name: 'FUZZ', description: 'Fuzz Face - vintage germanium fuzz' },
  { id: 'muff', name: 'MUFF', description: 'Big Muff - sustaining fuzz' },
];

// Pedal state
const state = {
  comp1: { active: false, threshold: 0.5, ratio: 0.5, attack: 0.3, release: 0.5, level: 0.5 },
  distortion: { active: false, drive: 0.5, tone: 0.5, level: 0.5, type: 0 },
  comp2: { active: false, threshold: 0.5, ratio: 0.5, attack: 0.3, release: 0.5, level: 0.5 },
  audioStarted: false,
  audioContext: null,
};

// Audio node references
let audioNodes = null;

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

// Cycle to next distortion type
function cycleDistortionType(direction = 1) {
  state.distortion.type = (state.distortion.type + direction + DISTORTION_TYPES.length) % DISTORTION_TYPES.length;
  updateTypeDisplay();
  updateAudioParams('distortion', 'type');
  console.log(`Distortion type: ${DISTORTION_TYPES[state.distortion.type].name}`);
}

// Setup distortion type selector
function setupTypeSelector() {
  const typeSelector = document.getElementById('distortion-type-selector');
  if (!typeSelector) return;

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

  // Initialize display
  updateTypeDisplay();
}

// Update knob visual rotation (value 0-1 maps to -135 to +135 degrees)
function updateKnobRotation(knob, value) {
  const rotation = (value * 270) - 135;
  const inner = knob.querySelector('.knob-inner');
  if (inner) {
    inner.style.transform = `rotate(${rotation}deg)`;
  }
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
      // Enable effect: mute bypass, unmute effect chain
      audioNodes.comp1Bypass.gain.value = 0;
      audioNodes.comp1Gain.gain.value = mapLevel(state.comp1.level);
      console.log(`comp1 ON: bypass=0, gain=${mapLevel(state.comp1.level)}`);
    } else {
      // Bypass: mute effect chain, unmute bypass
      audioNodes.comp1Bypass.gain.value = 1;
      audioNodes.comp1Gain.gain.value = 0;
      console.log(`comp1 OFF: bypass=1, gain=0`);
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
      audioNodes.comp2Bypass.gain.value = 0;
      audioNodes.comp2Gain.gain.value = mapLevel(state.comp2.level);
      console.log(`comp2 ON: bypass=0, gain=${mapLevel(state.comp2.level)}`);
    } else {
      audioNodes.comp2Bypass.gain.value = 1;
      audioNodes.comp2Gain.gain.value = 0;
      console.log(`comp2 OFF: bypass=1, gain=0`);
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

// Keyboard shortcuts (1, 2, 3 for each pedal, D for distortion type)
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    switch (e.key.toLowerCase()) {
      case '1':
        togglePedal('comp1');
        animateFootswitch('comp1');
        break;
      case '2':
        togglePedal('distortion');
        animateFootswitch('distortion');
        break;
      case '3':
        togglePedal('comp2');
        animateFootswitch('comp2');
        break;
      case 'd':
        // Cycle distortion type (shift+d for reverse)
        cycleDistortionType(e.shiftKey ? -1 : 1);
        break;
    }
  });
}

function animateFootswitch(pedalId) {
  const footswitch = document.querySelector(`.footswitch[data-pedal="${pedalId}"]`);
  footswitch.classList.add('pressed');
  setTimeout(() => footswitch.classList.remove('pressed'), 100);
}

// Populate audio input devices
async function populateInputDevices() {
  try {
    // Request permission first to get device labels
    await navigator.mediaDevices.getUserMedia({ audio: true });

    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');

    inputSelect.innerHTML = '<option value="">Select Input Device</option>';
    audioInputs.forEach(device => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Microphone ${inputSelect.options.length}`;
      inputSelect.appendChild(option);
    });

    inputSelect.disabled = false;
  } catch (err) {
    console.error('Error accessing audio devices:', err);
    inputSelect.innerHTML = '<option value="">Audio access denied</option>';
  }
}

// Create the audio processing chain
function createAudioChain(ctx, source) {
  audioNodes = {};

  // === COMPRESSOR 1 ===
  audioNodes.comp1Input = ctx.createGain();
  audioNodes.comp1Compressor = ctx.createDynamicsCompressor();
  audioNodes.comp1Gain = ctx.createGain();
  audioNodes.comp1Bypass = ctx.createGain();
  audioNodes.comp1Output = ctx.createGain();

  // Set compressor params
  audioNodes.comp1Compressor.threshold.value = mapThreshold(state.comp1.threshold);
  audioNodes.comp1Compressor.ratio.value = mapRatio(state.comp1.ratio);
  audioNodes.comp1Compressor.attack.value = mapAttack(state.comp1.attack);
  audioNodes.comp1Compressor.release.value = mapRelease(state.comp1.release);
  audioNodes.comp1Compressor.knee.value = 6;

  // Initial bypass state (bypassed)
  audioNodes.comp1Gain.gain.value = 0;
  audioNodes.comp1Bypass.gain.value = 1;

  // Connect: input -> [compressor -> gain] + [bypass] -> output
  source.connect(audioNodes.comp1Input);
  audioNodes.comp1Input.connect(audioNodes.comp1Compressor);
  audioNodes.comp1Compressor.connect(audioNodes.comp1Gain);
  audioNodes.comp1Gain.connect(audioNodes.comp1Output);
  audioNodes.comp1Input.connect(audioNodes.comp1Bypass);
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

  // Connect
  audioNodes.comp1Output.connect(audioNodes.distInput);
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
  audioNodes.comp2Gain = ctx.createGain();
  audioNodes.comp2Bypass = ctx.createGain();
  audioNodes.comp2Output = ctx.createGain();

  // Set compressor params
  audioNodes.comp2Compressor.threshold.value = mapThreshold(state.comp2.threshold);
  audioNodes.comp2Compressor.ratio.value = mapRatio(state.comp2.ratio);
  audioNodes.comp2Compressor.attack.value = mapAttack(state.comp2.attack);
  audioNodes.comp2Compressor.release.value = mapRelease(state.comp2.release);
  audioNodes.comp2Compressor.knee.value = 6;

  // Initial bypass state
  audioNodes.comp2Gain.gain.value = 0;
  audioNodes.comp2Bypass.gain.value = 1;

  // Connect
  audioNodes.distOutput.connect(audioNodes.comp2Input);
  audioNodes.comp2Input.connect(audioNodes.comp2Compressor);
  audioNodes.comp2Compressor.connect(audioNodes.comp2Gain);
  audioNodes.comp2Gain.connect(audioNodes.comp2Output);
  audioNodes.comp2Input.connect(audioNodes.comp2Bypass);
  audioNodes.comp2Bypass.connect(audioNodes.comp2Output);

  // Final output
  audioNodes.comp2Output.connect(ctx.destination);

  console.log('Audio chain created');

  // Apply current pedal states
  if (state.comp1.active) updateBypass('comp1');
  if (state.distortion.active) updateBypass('distortion');
  if (state.comp2.active) updateBypass('comp2');
}

// Start audio
async function startAudio() {
  if (state.audioStarted) {
    // Stop audio
    if (state.audioContext) {
      await state.audioContext.close();
      state.audioContext = null;
      audioNodes = null;
    }
    state.audioStarted = false;
    startButton.textContent = 'Start Audio';
    startButton.classList.remove('running');
    console.log('Audio stopped');
    return;
  }

  try {
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();

    const deviceId = inputSelect.value || undefined;
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

    createAudioChain(state.audioContext, source);

    state.audioStarted = true;
    startButton.textContent = 'Stop Audio';
    startButton.classList.add('running');

    console.log('Audio started! Sample rate:', state.audioContext.sampleRate);
  } catch (err) {
    console.error('Error starting audio:', err);
    alert('Could not start audio. Please check your input device and permissions.');
  }
}

// Initialize
function init() {
  initKnobs();
  setupKnobInteraction();
  setupFootswitches();
  setupKeyboardShortcuts();
  setupTypeSelector();
  populateInputDevices();

  startButton.addEventListener('click', startAudio);

  console.log('Compstortion initialized');
}

document.addEventListener('DOMContentLoaded', init);
