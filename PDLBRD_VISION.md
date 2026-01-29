# PDLBRD - Pedalboard Plugin Builder

## Vision
A web app where users design custom guitar pedalboards, then export them as real AU/VST3 plugins they can use in Logic Pro, Ableton, etc.

## How It Would Work

### User Flow
1. User visits PDLBRD web app
2. Designs their pedalboard (drag pedals, tweak knobs, set signal chain order)
3. Saves preset to their account
4. Clicks "Download Plugin" button
5. Receives a `.component` (AU) or `.vst3` file
6. Drops it in their plugin folder, opens Logic, uses it

### Architecture Options

#### Option A: Server-Side Compilation (Most Flexible)
```
[Web App] → [Preset JSON] → [Build Server] → [Compiled Plugin Download]
```
- Backend receives preset configuration
- Injects settings into plugin template code
- Compiles AU/VST3 on server (macOS build machine for AU)
- Returns downloadable binary
- **Pros**: True custom plugins, optimized per-preset
- **Cons**: Complex infrastructure, code signing costs ($99/yr Apple Developer), build times

#### Option B: Universal Plugin + Preset Files (Simpler)
```
[Web App] → [Download .pdlbrd preset file]
[User installs PDLBRD Plugin once]
[Plugin loads .pdlbrd files]
```
- One "PDLBRD Player" plugin that users install once
- Web app exports `.pdlbrd` preset files (JSON)
- Plugin has file browser to load presets
- **Pros**: Simpler, no server compilation, one-time install
- **Cons**: Less "magic", requires initial plugin install

#### Option C: Hybrid - Preset URL Loading
```
[Web App] → [Shareable URL with encoded preset]
[PDLBRD Plugin] → [Paste URL or preset code] → [Loads configuration]
```
- Plugin can load presets via URL/code
- Share presets as links
- **Pros**: Easy sharing, no file management
- **Cons**: Still requires base plugin install

---

## Recommended Approach: Option B (MVP) → Option A (Future)

### Phase 1: Build the Universal PDLBRD Plugin
**Tech Stack**: JUCE (C++) - industry standard, outputs AU + VST3 + AAX

**Plugin Features**:
- All DSP from Compstortion ported to C++:
  - 2x Compressors with blend
  - Distortion (TS9, RAT, Blues, Fuzz, Muff algorithms)
  - Amp Sim (Clean, Crunch, Lead, Modern, Vintage)
  - Modulation (Phaser, Flanger, Chorus, Tremolo, Vibrato)
  - Reverb (Spring, Plate, Hall)
- Configurable signal chain order
- Preset loader (reads JSON or custom format)
- Minimal UI (or full UI matching web app)

**Deliverable**: PDLBRD.component (AU) + PDLBRD.vst3

### Phase 2: Enhance Web App for Export
- Add "Download for DAW" button
- Export preset as `.pdlbrd` file (JSON with all settings)
- Instructions for installing the plugin

### Phase 3: (Optional) Server-Side Compilation
- Build server that compiles custom-named plugins
- User gets "MyCustomTone.component" instead of generic plugin
- Preset baked into binary (no file loading needed)

---

## Technical Implementation

### JUCE Plugin Structure
```
PDLBRD/
├── Source/
│   ├── PluginProcessor.cpp    # Main DSP
│   ├── PluginEditor.cpp       # UI (optional)
│   ├── DSP/
│   │   ├── Compressor.cpp
│   │   ├── Distortion.cpp
│   │   ├── AmpSim.cpp
│   │   ├── Modulation.cpp
│   │   └── Reverb.cpp
│   └── PresetManager.cpp      # Load .pdlbrd files
├── PDLBRD.jucer               # JUCE project file
└── Presets/                   # Factory presets
```

### DSP Porting (JS → C++)
The algorithms are already written in main.js. Key functions to port:
- `makeDistortionCurve()` → Waveshaper curves
- `makeAmpCurve()` → Amp saturation
- `generateReverbIR()` → Convolution impulse responses
- Compressor → JUCE's `dsp::Compressor` or custom
- Modulation → LFOs + delays/allpass filters

### Preset Format (.pdlbrd)
```json
{
  "name": "My Preset",
  "version": "1.0",
  "pedalOrder": ["comp1", "distortion", "modulation", "reverb", "comp2", "amp"],
  "pedals": {
    "comp1": { "active": true, "threshold": 0.5, "ratio": 0.5, ... },
    "distortion": { "active": true, "drive": 0.7, "type": 2, ... },
    ...
  }
}
```

---

## Development Roadmap

### Milestone 1: JUCE Proof of Concept (1-2 weeks)
- [ ] Set up JUCE project
- [ ] Port one effect (distortion) to C++
- [ ] Build working AU plugin
- [ ] Test in Logic Pro

### Milestone 2: Full DSP Port (2-3 weeks)
- [ ] Port all compressor code
- [ ] Port all distortion types
- [ ] Port amp sim with EQ
- [ ] Port modulation effects
- [ ] Port reverb (convolution)
- [ ] Implement signal chain routing

### Milestone 3: Preset System (1 week)
- [ ] Design .pdlbrd file format
- [ ] Implement preset loader in plugin
- [ ] Add preset browser UI
- [ ] Web app export functionality

### Milestone 4: Polish & Release (1-2 weeks)
- [ ] Plugin UI (optional - can be minimal)
- [ ] Factory presets
- [ ] Code signing (for macOS Gatekeeper)
- [ ] Documentation
- [ ] Distribution (direct download or plugin hosts)

---

## Prerequisites
- **macOS** for AU development
- **Xcode** installed
- **JUCE** framework (free for open source/GPL, paid for proprietary)
- **Apple Developer Account** ($99/yr) for code signing (optional but recommended)

## Getting Started
```bash
# Install JUCE
# Download from https://juce.com/get-juce/download

# Create new Audio Plugin project in Projucer
# Enable AU and VST3 formats
# Start porting DSP code
```

---

## Questions to Consider
1. **UI**: Full GUI matching web app, or minimal/headless plugin?
2. **Licensing**: Open source (GPL w/ JUCE) or proprietary (JUCE license)?
3. **Distribution**: Direct download, GitHub releases, or plugin marketplace?
4. **Presets**: Only user presets, or include factory presets?
