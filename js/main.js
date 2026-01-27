// Pedal state
const state = {
  comp1: { active: false, threshold: 0.5, ratio: 0.5, attack: 0.3, release: 0.5 },
  distortion: { active: false, drive: 0.5, tone: 0.5, level: 0.5 },
  comp2: { active: false, threshold: 0.5, ratio: 0.5, attack: 0.3, release: 0.5 },
  audioStarted: false,
  audioContext: null,
};

// DOM Elements
const startButton = document.getElementById('start-audio');
const inputSelect = document.getElementById('input-select');

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

      // TODO: Update audio parameters when audio engine is implemented
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

// Toggle pedal on/off
function togglePedal(pedalId) {
  state[pedalId].active = !state[pedalId].active;

  const led = document.getElementById(`led-${pedalId}`);
  if (state[pedalId].active) {
    led.classList.add('active');
  } else {
    led.classList.remove('active');
  }

  // TODO: Update audio routing when audio engine is implemented
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

// Start audio (placeholder for Phase 2)
async function startAudio() {
  if (state.audioStarted) {
    // Stop audio
    if (state.audioContext) {
      await state.audioContext.close();
      state.audioContext = null;
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

    // For now, just connect input to output (passthrough)
    // TODO: Insert effect chain in Phase 2-4
    source.connect(state.audioContext.destination);

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
