// Pedal state
const state = {
  comp1: { active: false, threshold: 0.5, ratio: 0.5, attack: 0.3, release: 0.5, level: 0.5 },
  distortion: { active: false, drive: 0.5, tone: 0.5, level: 0.5 },
  comp2: { active: false, threshold: 0.5, ratio: 0.5, attack: 0.3, release: 0.5, level: 0.5 },
  audioStarted: false,
  audioContext: null,
  nodes: null,
};

// DOM Elements
const startButton = document.getElementById('start-audio');
const inputSelect = document.getElementById('input-select');

// Audio node references
let audioNodes = {
  source: null,
  // Comp 1
  comp1Input: null,
  comp1Compressor: null,
  comp1Gain: null,
  comp1Bypass: null,
  comp1Output: null,
  // Distortion
  distInput: null,
  distPreGain: null,
  distWaveshaper: null,
  distToneFilter: null,
  distPostGain: null,
  distBypass: null,
  distOutput: null,
  // Comp 2
  comp2Input: null,
  comp2Compressor: null,
  comp2Gain: null,
  comp2Bypass: null,
  comp2Output: null,
};

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
  // 0-1 -> 1 to 50 (pre-gain multiplier)
  return 1 + (value * 49);
}

function mapTone(value) {
  // 0-1 -> 200Hz to 8000Hz
  return 200 + (value * 7800);
}

// Create distortion curve for waveshaper
function makeDistortionCurve(amount) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const deg = Math.PI / 180;
  const k = amount * 100;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// Initialize knob rotations from state
function initKnobs() {
  document.querySelectorAll('.knob').forEach(knob => {
    const pedal = knob.dataset.pedal;
    const param = knob.dataset.param;
    const value = state[pedal][param];
    updateKnobRotation(knob, value);
  });
}

// Update knob visual rotation (value 0-1 maps to -135 to +135 degrees)
function updateKnobRotation(knob, value) {
  const rotation = (value * 270) - 135;
  const inner = knob.querySelector('.knob-inner');
  inner.style.transform = `rotate(${rotation}deg)`;
}

// Update audio parameters based on current state
function updateAudioParams(pedal, param) {
  if (!state.audioContext || !audioNodes.comp1Compressor) return;

  const value = state[pedal][param];

  if (pedal === 'comp1') {
    switch (param) {
      case 'threshold':
        audioNodes.comp1Compressor.threshold.setValueAtTime(mapThreshold(value), state.audioContext.currentTime);
        break;
      case 'ratio':
        audioNodes.comp1Compressor.ratio.setValueAtTime(mapRatio(value), state.audioContext.currentTime);
        break;
      case 'attack':
        audioNodes.comp1Compressor.attack.setValueAtTime(mapAttack(value), state.audioContext.currentTime);
        break;
      case 'release':
        audioNodes.comp1Compressor.release.setValueAtTime(mapRelease(value), state.audioContext.currentTime);
        break;
      case 'level':
        audioNodes.comp1Gain.gain.setValueAtTime(mapLevel(value), state.audioContext.currentTime);
        break;
    }
  } else if (pedal === 'distortion') {
    switch (param) {
      case 'drive':
        audioNodes.distPreGain.gain.setValueAtTime(mapDrive(value), state.audioContext.currentTime);
        audioNodes.distWaveshaper.curve = makeDistortionCurve(value);
        break;
      case 'tone':
        audioNodes.distToneFilter.frequency.setValueAtTime(mapTone(value), state.audioContext.currentTime);
        break;
      case 'level':
        audioNodes.distPostGain.gain.setValueAtTime(mapLevel(value), state.audioContext.currentTime);
        break;
    }
  } else if (pedal === 'comp2') {
    switch (param) {
      case 'threshold':
        audioNodes.comp2Compressor.threshold.setValueAtTime(mapThreshold(value), state.audioContext.currentTime);
        break;
      case 'ratio':
        audioNodes.comp2Compressor.ratio.setValueAtTime(mapRatio(value), state.audioContext.currentTime);
        break;
      case 'attack':
        audioNodes.comp2Compressor.attack.setValueAtTime(mapAttack(value), state.audioContext.currentTime);
        break;
      case 'release':
        audioNodes.comp2Compressor.release.setValueAtTime(mapRelease(value), state.audioContext.currentTime);
        break;
      case 'level':
        audioNodes.comp2Gain.gain.setValueAtTime(mapLevel(value), state.audioContext.currentTime);
        break;
    }
  }
}

// Handle knob dragging
function setupKnobInteraction() {
  document.querySelectorAll('.knob').forEach(knob => {
    let isDragging = false;
    let startY = 0;
    let startValue = 0;

    const onMouseDown = (e) => {
      isDragging = true;
      startY = e.clientY || e.touches?.[0]?.clientY || 0;
      const pedal = knob.dataset.pedal;
      const param = knob.dataset.param;
      startValue = state[pedal][param];
      document.body.style.cursor = 'ns-resize';
      e.preventDefault();
    };

    const onMouseMove = (e) => {
      if (!isDragging) return;

      const currentY = e.clientY || e.touches?.[0]?.clientY || 0;
      const deltaY = startY - currentY;
      const sensitivity = 0.005;
      let newValue = startValue + (deltaY * sensitivity);
      newValue = Math.max(0, Math.min(1, newValue));

      const pedal = knob.dataset.pedal;
      const param = knob.dataset.param;
      state[pedal][param] = newValue;
      updateKnobRotation(knob, newValue);
      updateAudioParams(pedal, param);
    };

    const onMouseUp = () => {
      isDragging = false;
      document.body.style.cursor = '';
    };

    knob.addEventListener('mousedown', onMouseDown);
    knob.addEventListener('touchstart', onMouseDown, { passive: false });

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('touchmove', onMouseMove, { passive: false });

    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchend', onMouseUp);
  });
}

// Update bypass routing for a pedal
function updateBypass(pedalId) {
  if (!state.audioContext) return;

  const isActive = state[pedalId].active;

  if (pedalId === 'comp1') {
    if (isActive) {
      // Enable effect: mute bypass, unmute effect chain
      audioNodes.comp1Bypass.gain.setValueAtTime(0, state.audioContext.currentTime);
      audioNodes.comp1Gain.gain.setValueAtTime(mapLevel(state.comp1.level), state.audioContext.currentTime);
    } else {
      // Bypass: mute effect chain, unmute bypass
      audioNodes.comp1Bypass.gain.setValueAtTime(1, state.audioContext.currentTime);
      audioNodes.comp1Gain.gain.setValueAtTime(0, state.audioContext.currentTime);
    }
  } else if (pedalId === 'distortion') {
    if (isActive) {
      audioNodes.distBypass.gain.setValueAtTime(0, state.audioContext.currentTime);
      audioNodes.distPostGain.gain.setValueAtTime(mapLevel(state.distortion.level), state.audioContext.currentTime);
    } else {
      audioNodes.distBypass.gain.setValueAtTime(1, state.audioContext.currentTime);
      audioNodes.distPostGain.gain.setValueAtTime(0, state.audioContext.currentTime);
    }
  } else if (pedalId === 'comp2') {
    if (isActive) {
      audioNodes.comp2Bypass.gain.setValueAtTime(0, state.audioContext.currentTime);
      audioNodes.comp2Gain.gain.setValueAtTime(mapLevel(state.comp2.level), state.audioContext.currentTime);
    } else {
      audioNodes.comp2Bypass.gain.setValueAtTime(1, state.audioContext.currentTime);
      audioNodes.comp2Gain.gain.setValueAtTime(0, state.audioContext.currentTime);
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
  console.log(`${pedalId} is now ${state[pedalId].active ? 'ON' : 'OFF'}`);
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
  // === COMPRESSOR 1 ===
  audioNodes.comp1Input = ctx.createGain();
  audioNodes.comp1Compressor = ctx.createDynamicsCompressor();
  audioNodes.comp1Gain = ctx.createGain();
  audioNodes.comp1Bypass = ctx.createGain();
  audioNodes.comp1Output = ctx.createGain();

  // Set initial compressor params
  audioNodes.comp1Compressor.threshold.value = mapThreshold(state.comp1.threshold);
  audioNodes.comp1Compressor.ratio.value = mapRatio(state.comp1.ratio);
  audioNodes.comp1Compressor.attack.value = mapAttack(state.comp1.attack);
  audioNodes.comp1Compressor.release.value = mapRelease(state.comp1.release);
  audioNodes.comp1Compressor.knee.value = 6;

  // Initial bypass state (bypassed by default)
  audioNodes.comp1Gain.gain.value = 0;
  audioNodes.comp1Bypass.gain.value = 1;

  // Connect comp1: input -> [compressor -> gain] + [bypass] -> output
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

  // Set initial distortion params
  audioNodes.distPreGain.gain.value = mapDrive(state.distortion.drive);
  audioNodes.distWaveshaper.curve = makeDistortionCurve(state.distortion.drive);
  audioNodes.distWaveshaper.oversample = '4x';
  audioNodes.distToneFilter.type = 'lowpass';
  audioNodes.distToneFilter.frequency.value = mapTone(state.distortion.tone);
  audioNodes.distToneFilter.Q.value = 0.7;

  // Initial bypass state
  audioNodes.distPostGain.gain.value = 0;
  audioNodes.distBypass.gain.value = 1;

  // Connect distortion: input -> [preGain -> waveshaper -> tone -> postGain] + [bypass] -> output
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

  // Set initial compressor params
  audioNodes.comp2Compressor.threshold.value = mapThreshold(state.comp2.threshold);
  audioNodes.comp2Compressor.ratio.value = mapRatio(state.comp2.ratio);
  audioNodes.comp2Compressor.attack.value = mapAttack(state.comp2.attack);
  audioNodes.comp2Compressor.release.value = mapRelease(state.comp2.release);
  audioNodes.comp2Compressor.knee.value = 6;

  // Initial bypass state
  audioNodes.comp2Gain.gain.value = 0;
  audioNodes.comp2Bypass.gain.value = 1;

  // Connect comp2: input -> [compressor -> gain] + [bypass] -> output
  audioNodes.distOutput.connect(audioNodes.comp2Input);
  audioNodes.comp2Input.connect(audioNodes.comp2Compressor);
  audioNodes.comp2Compressor.connect(audioNodes.comp2Gain);
  audioNodes.comp2Gain.connect(audioNodes.comp2Output);
  audioNodes.comp2Input.connect(audioNodes.comp2Bypass);
  audioNodes.comp2Bypass.connect(audioNodes.comp2Output);

  // Connect final output
  audioNodes.comp2Output.connect(ctx.destination);

  // Apply current pedal states (in case any were toggled before audio started)
  updateBypass('comp1');
  updateBypass('distortion');
  updateBypass('comp2');
}

// Start audio
async function startAudio() {
  if (state.audioStarted) {
    // Stop audio
    if (state.audioContext) {
      await state.audioContext.close();
      state.audioContext = null;
      audioNodes = {};
    }
    state.audioStarted = false;
    startButton.textContent = 'Start Audio';
    startButton.classList.remove('running');
    return;
  }

  try {
    // Create audio context
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

    // Create the full effect chain
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
