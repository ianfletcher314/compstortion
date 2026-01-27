// Pedal state
const state = {
  comp1: { active: false, threshold: 0.5, ratio: 0.5, attack: 0.3, release: 0.5, level: 0.5 },
  distortion: { active: false, drive: 0.5, tone: 0.5, level: 0.5 },
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

function mapTone(value) {
  // 0-1 -> 500Hz to 8000Hz
  return 500 + (value * 7500);
}

// Create distortion curve for waveshaper
function makeDistortionCurve(amount) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const k = amount * 50;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    // Soft clipping curve
    curve[i] = Math.tanh(k * x) / Math.tanh(k || 1);
  }
  return curve;
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
        audioNodes.distWaveshaper.curve = makeDistortionCurve(value);
        break;
      case 'tone':
        audioNodes.distToneFilter.frequency.value = mapTone(value);
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

// Keyboard shortcuts (1, 2, 3 for each pedal)
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

    switch (e.key) {
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
  audioNodes.distWaveshaper.curve = makeDistortionCurve(state.distortion.drive);
  audioNodes.distWaveshaper.oversample = '4x';
  audioNodes.distToneFilter.type = 'lowpass';
  audioNodes.distToneFilter.frequency.value = mapTone(state.distortion.tone);
  audioNodes.distToneFilter.Q.value = 0.7;

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
  populateInputDevices();

  startButton.addEventListener('click', startAudio);

  console.log('Compstortion initialized');
}

document.addEventListener('DOMContentLoaded', init);
