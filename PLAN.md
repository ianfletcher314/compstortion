# Compstortion - Guitar Pedal Web App

A browser-based guitar effects pedal with **Compression → Distortion → Compression** signal chain, designed to look and feel like a physical stomp box.

## Overview

Build a GitHub Pages site (like your synth and metronome) that processes live guitar input via USB audio interface using the Web Audio API.

## Signal Chain

```
Guitar → USB Interface → [Compressor 1] → [Distortion] → [Compressor 2] → Output
```

Each stage can be toggled on/off independently via stomp switches.

---

## Phase 1: Project Setup

- [x] Create basic HTML/CSS/JS structure
- [ ] Set up GitHub Pages deployment
- [x] Create responsive layout that works on desktop and mobile
- [x] Add basic stomp box visual design (metal enclosure, knobs, LED indicators)

## Phase 2: Audio Engine

- [ ] Implement `getUserMedia()` for USB audio interface input
- [ ] Create Web Audio API audio context and signal routing
- [ ] Build bypass/routing system for toggling each stage
- [ ] Add input/output level metering

## Phase 3: Compressor Stage (x2)

Each compressor needs:
- [ ] Threshold knob (-60dB to 0dB)
- [ ] Ratio knob (1:1 to 20:1)
- [ ] Attack knob (0.1ms to 100ms)
- [ ] Release knob (10ms to 1000ms)
- [ ] Makeup gain knob
- [ ] Gain reduction meter (LED style)
- [ ] Footswitch with LED indicator

Implementation options:
1. **DynamicsCompressorNode** - Built-in, limited control
2. **Custom compressor** - More control using AnalyserNode + GainNode for envelope following

## Phase 4: Distortion Stage

- [ ] Drive/gain knob
- [ ] Tone knob (low-pass filter)
- [ ] Output level knob
- [ ] Distortion type selector (soft clip, hard clip, fuzz, tube-style)
- [ ] Footswitch with LED indicator

Implementation:
- Use `WaveShaperNode` with custom curves for different distortion characters
- Pre-filter (high-pass) to tighten low end before clipping
- Post-filter (tone control) using `BiquadFilterNode`

## Phase 5: UI/UX - Stomp Box Design

Visual elements:
- [x] Metal enclosure texture/gradient
- [x] Realistic knob graphics with rotation animation
- [x] Rubber stomp switches that depress on click
- [x] LED indicators (red/green) for each stage
- [ ] Jack sockets on sides (decorative)
- [x] Screw details in corners
- [x] Label/branding area

Interactions:
- [x] Click/drag knobs to adjust values
- [x] Click stomp switches to toggle stages
- [x] Keyboard shortcuts for stomp switches (1, 2, 3)
- [x] Touch support for mobile

## Phase 6: Presets & Settings

- [ ] Save/load presets to localStorage
- [ ] Export/import preset JSON files
- [ ] Default preset library (clean boost, heavy compression, distortion flavors)
- [ ] Audio device selector (for users with multiple interfaces)
- [ ] Buffer size/latency settings

---

## VST Export - Important Notes

**Reality check:** You cannot directly "bounce" a web app to a native VST plugin. VSTs are compiled native code (C++/Rust). However, here are viable options:

### Option A: JUCE/iPlug2 Companion Project
- [ ] Create a separate C++ project using JUCE or iPlug2
- [ ] Port the DSP algorithms from JavaScript to C++
- [ ] Build VST3/AU plugins for Pro Tools and Logic Pro X
- [ ] This is essentially building the plugin twice (web + native)

### Option B: Faust DSP
- [ ] Write the DSP in Faust (functional DSP language)
- [ ] Faust can compile to both:
  - JavaScript/WebAssembly for the web version
  - VST/AU plugins natively
- [ ] Single source of truth for the algorithms

### Option C: WebAudio to CLAP/VST via WASM (Experimental)
- [ ] Use a framework like Elementary Audio or Cmajor
- [ ] These allow writing DSP once and deploying to multiple targets
- [ ] Still relatively new/experimental

### Recommended Approach: Option B (Faust)

1. Write DSP in Faust
2. Use `faust2webaudio` for the GitHub Pages version
3. Use `faust2juce` to generate VST3/AU for DAWs
4. Consistent sound between web and plugin versions

---

## Tech Stack

- **HTML5/CSS3** - Structure and stomp box styling
- **JavaScript (vanilla or with Web Audio library)** - Audio processing
- **Faust** (optional) - DSP algorithms portable to VST
- **GitHub Pages** - Hosting

## File Structure

```
compstortion/
├── index.html
├── css/
│   └── pedal.css
├── js/
│   ├── main.js
│   ├── audio-engine.js
│   ├── compressor.js
│   ├── distortion.js
│   └── ui.js
├── assets/
│   ├── knob.png
│   ├── led-on.png
│   ├── led-off.png
│   └── enclosure-texture.png
├── presets/
│   └── default-presets.json
└── faust/ (if using Faust)
    ├── compressor.dsp
    └── distortion.dsp
```

---

## Timeline Suggestion

1. **MVP**: Basic working audio with simple UI (get sound flowing)
2. **Polish**: Stomp box visuals, all knobs functional
3. **Presets**: Save/load system
4. **VST**: Port to native plugin (separate effort)

---

## Resources

- [Web Audio API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Faust Programming Language](https://faust.grame.fr/)
- [JUCE Framework](https://juce.com/)
- [WaveShaperNode for Distortion](https://developer.mozilla.org/en-US/docs/Web/API/WaveShaperNode)
