# PDLBRD - Pedalboard Plugin Builder

## Vision
A web app where users design custom guitar pedalboards, then export them as real AU/VST3 plugins they can use in Logic Pro, Ableton, etc.

---

## User Flow
1. User visits PDLBRD web app
2. Designs their pedalboard (drag pedals, tweak knobs, set signal chain order)
3. Saves preset to their account
4. Clicks "Download Plugin" button
5. Receives a `.component` (AU) or `.vst3` file
6. Drops it in their plugin folder, opens Logic, uses it

---

## Architecture Options

### Option A: Server-Side Compilation (Most Flexible)
```
[Web App] → [Preset JSON] → [Build Server] → [Compiled Plugin Download]
```
- Backend receives preset configuration
- Injects settings into plugin template code
- Compiles AU/VST3 on server (macOS build machine for AU)
- Returns downloadable binary
- **Pros**: True custom plugins, optimized per-preset
- **Cons**: Complex infrastructure, code signing costs for distribution ($99/yr Apple Developer), build times

### Option B: Universal Plugin + Preset Files (Simpler) ⭐ RECOMMENDED
```
[Web App] → [Download .pdlbrd preset file]
[User installs PDLBRD Plugin once]
[Plugin loads .pdlbrd files]
```
- One "PDLBRD Player" plugin that users install once
- Web app exports `.pdlbrd` preset files (JSON)
- Plugin has file browser to load presets
- **Pros**: Simpler, no server compilation, one-time install, **FREE for personal use**
- **Cons**: Less "magic", requires initial plugin install

### Option C: Hybrid - Preset URL Loading
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

---

# Phase 1: Development Environment Setup

## 1. Install Required Software

### 1a. Install Xcode
- Download Xcode from Mac App Store
- Open Xcode once to accept license and install command line tools
- Verify installation: `xcode-select --version`

### 1b. Install JUCE Framework
- Download JUCE from https://juce.com/get-juce/download
- Extract to `/Applications/JUCE` or `~/JUCE`
- Open Projucer app (JUCE's project manager)
- Set global paths in Projucer: Projucer → Global Paths → Set JUCE path

### 1c. Configure Projucer
- Open Projucer preferences
- Add Xcode as an exporter
- Set default plugin formats (AU, VST3)
- Configure code signing identity (can be "Sign to Run Locally" for development)

### 1d. Create GitHub Repository
- Create new repo: `pdlbrd` or `pdlbrd-plugin`
- Clone locally
- Add `.gitignore` for JUCE/Xcode projects
- Set up branch protection for main

## 2. Create JUCE Audio Plugin Project

### 2a. Create New Project in Projucer
- File → New Project → Audio Plug-In
- Project Name: "PDLBRD"
- Set project folder location

### 2b. Configure Plugin Settings
- Plugin Name: "PDLBRD"
- Plugin Manufacturer: Your name or company
- Plugin Manufacturer Code: 4 characters (e.g., "Pflr")
- Plugin Code: 4 characters (e.g., "Pdlb")
- Plugin Description: "Custom pedalboard plugin"
- Plugin AU Export Prefix: "PDLBRD"

### 2c. Configure Plugin Formats
- Enable: AU (Audio Unit)
- Enable: VST3
- Enable: Standalone (for testing without DAW)
- Disable: AAX (Pro Tools - requires separate license)

### 2d. Configure Plugin Characteristics
- Plugin is a Synth: No
- Plugin MIDI Input: No (guitar plugin, not MIDI)
- Plugin MIDI Output: No
- MIDI Effect Plugin: No
- Plugin Channel Configurations: {1, 1}, {2, 2} (mono and stereo)

### 2e. Set Up Project File Structure
```
PDLBRD/
├── Source/
│   ├── PluginProcessor.h
│   ├── PluginProcessor.cpp
│   ├── PluginEditor.h
│   ├── PluginEditor.cpp
│   └── DSP/
│       └── (effect modules go here)
├── PDLBRD.jucer
├── Builds/
│   └── MacOSX/
│       └── PDLBRD.xcodeproj
└── JuceLibraryCode/
```

### 2f. Initial Build Test
- Open Builds/MacOSX/PDLBRD.xcodeproj in Xcode
- Select "PDLBRD - AU" scheme
- Build (Cmd+B)
- Verify it compiles without errors
- Test standalone version runs

### 2g. Test in Logic Pro
- Build AU version
- Open Logic Pro
- Go to Logic Pro → Settings → Plug-in Manager
- Click "Reset & Rescan Selection"
- Create new project with audio track
- Verify PDLBRD appears in plugin list under your manufacturer name

---

# Phase 2: DSP Module Architecture

## 3. Design DSP Module System

### 3a. Create Base Effect Class
- Create abstract base class `EffectModule`
- Define interface:
  ```cpp
  class EffectModule {
  public:
      virtual void prepare(double sampleRate, int samplesPerBlock) = 0;
      virtual void process(AudioBuffer<float>& buffer) = 0;
      virtual void setParameter(const String& name, float value) = 0;
      virtual float getParameter(const String& name) = 0;
      virtual void setBypass(bool bypassed) = 0;
      virtual bool isBypassed() = 0;
  };
  ```

### 3b. Design Parameter System
- Create `Parameter` struct with:
  - Name (string)
  - Value (float 0-1 normalized)
  - Range (min, max for display)
  - Mapping function (linear, logarithmic, etc.)
- Create `ParameterManager` class to handle all parameters

### 3c. Design Signal Chain Router
- Create `SignalChain` class
- Holds ordered list of `EffectModule` pointers
- Methods:
  - `addEffect(EffectModule*)`
  - `removeEffect(EffectModule*)`
  - `reorderEffects(std::vector<int> newOrder)`
  - `process(AudioBuffer<float>& buffer)`

### 3d. Create DSP Utility Functions
- Create `DSPUtils` namespace with:
  - `linearToDecibels(float)`
  - `decibelsToLinear(float)`
  - `mapRange(float value, float inMin, float inMax, float outMin, float outMax)`
  - `softClip(float sample)`
  - `hardClip(float sample)`

---

# Phase 3: Port Compressor Module

## 4. Implement Compressor DSP

### 4a. Create Compressor Class Header
- Create `Source/DSP/Compressor.h`
- Inherit from `EffectModule`
- Define parameters:
  - threshold (float, -60 to 0 dB)
  - ratio (float, 1:1 to 20:1)
  - attack (float, 0.1ms to 100ms)
  - release (float, 10ms to 1000ms)
  - makeupGain (float, 0 to 24 dB)
  - blend (float, 0 to 1 for parallel compression)

### 4b. Implement Compressor Detection
- Implement envelope follower
- Calculate RMS or peak level
- Apply attack/release smoothing:
  ```cpp
  if (inputLevel > envelope)
      envelope += attackCoeff * (inputLevel - envelope);
  else
      envelope += releaseCoeff * (inputLevel - envelope);
  ```

### 4c. Implement Gain Reduction Calculation
- Calculate gain reduction based on threshold and ratio:
  ```cpp
  if (inputLevelDb > thresholdDb) {
      gainReductionDb = (inputLevelDb - thresholdDb) * (1 - 1/ratio);
  }
  ```
- Apply soft knee option

### 4d. Implement Parallel Compression (Blend)
- Store dry signal before processing
- Apply compression to wet signal
- Mix: `output = dry * (1 - blend) + wet * blend`

### 4e. Implement Makeup Gain
- Apply output gain after compression
- Auto-makeup option: automatically compensate for gain reduction

### 4f. Test Compressor Module
- Create unit tests for gain reduction calculations
- Test with sine wave input
- Verify attack and release behavior
- Test in standalone plugin with audio file

---

# Phase 4: Port Distortion Module

## 5. Implement Distortion DSP

### 5a. Create Distortion Class Header
- Create `Source/DSP/Distortion.h`
- Define parameters:
  - drive (float, 0 to 1)
  - tone (float, 0 to 1)
  - level (float, 0 to 1)
  - type (int, enum for different algorithms)

### 5b. Define Distortion Types Enum
```cpp
enum class DistortionType {
    TS9,      // Tube Screamer - mid-focused overdrive
    RAT,      // ProCo RAT - hard clipping
    Blues,    // Blues Breaker - transparent overdrive
    Fuzz,     // Fuzz Face - germanium fuzz
    Muff      // Big Muff - sustaining fuzz
};
```

### 5c. Implement TS9 Algorithm
- Port from JS `applyDistortionAlgorithm` for 'ts9' case
- Asymmetric soft clipping:
  ```cpp
  if (x >= 0)
      return tanh(k * 0.7f * x);
  else
      return tanh(k * x);
  ```

### 5d. Implement RAT Algorithm
- Hard clipping with soft knee
- More aggressive, buzzier character
- Port from JS RAT case

### 5e. Implement Blues Breaker Algorithm
- Very soft, transparent overdrive
- Gentle compression, maintains dynamics
- Formula: `(3 * k * x) / (1 + 2 * abs(k * x))`

### 5f. Implement Fuzz Face Algorithm
- Germanium-style asymmetric fuzz
- Gate effect on quiet signals
- Asymmetric clipping on loud signals

### 5g. Implement Big Muff Algorithm
- Sustaining fuzz with squared-off waveform
- Combination of soft and hard clipping
- Blend based on drive amount

### 5h. Implement Waveshaper
- Create lookup table for each distortion type
- Use oversampling (4x) to reduce aliasing:
  - Upsample input
  - Apply waveshaper
  - Apply anti-aliasing filter
  - Downsample output

### 5i. Implement Tone Control
- Different frequency responses per type:
  - TS9: Mid-hump, 800Hz + 6kHz range
  - RAT: Wide range, 200Hz + 8kHz
  - Blues: Bright, 1kHz + 7kHz
  - Fuzz: Vintage, 400Hz + 5kHz
  - Muff: Extreme range, 300Hz + 9kHz
- Implement as lowpass filter with variable Q

### 5j. Test Distortion Module
- Test each algorithm with sine wave (look at harmonics)
- Verify tone control affects frequency response
- Test drive range from clean to fully saturated
- A/B compare with web app version

---

# Phase 5: Port Amp Simulator Module

## 6. Implement Amp Sim DSP

### 6a. Create AmpSim Class Header
- Create `Source/DSP/AmpSim.h`
- Define parameters:
  - gain (float, 0 to 1)
  - bass (float, 0 to 1, maps to -12 to +12 dB)
  - mid (float, 0 to 1, maps to -12 to +12 dB)
  - midFreq (float, 0 to 1, maps to 200Hz to 2kHz)
  - treble (float, 0 to 1, maps to -12 to +12 dB)
  - master (float, 0 to 1)
  - type (int, enum for amp types)

### 6b. Define Amp Types Enum
```cpp
enum class AmpType {
    Clean,    // Fender-style clean
    Crunch,   // Marshall-style edge of breakup
    Lead,     // High-gain lead
    Modern,   // Mesa-style tight high-gain
    Vintage   // Vox-style chimey breakup
};
```

### 6c. Implement Preamp Saturation Stage
- Different saturation curves per amp type
- Port `applyAmpAlgorithm` from JS
- Clean: Very soft saturation, mostly clean
- Crunch: Asymmetric tube saturation
- Lead: Double-stage saturation
- Modern: Hard clipping with soft character
- Vintage: Asymmetric with even harmonics

### 6d. Implement 3-Band EQ
- Bass: Low shelf filter at 100Hz
- Mid: Peaking filter with variable frequency (200Hz-2kHz)
- Treble: High shelf filter at 3kHz
- Use JUCE's `dsp::IIR::Filter` classes

### 6e. Implement Cabinet Simulation
- High-cut filter at ~5.5kHz (speaker rolloff)
- High-pass filter at ~80Hz (remove rumble)
- Optional: Load impulse responses for more realistic cab sim

### 6f. Configure EQ Per Amp Type
- Port `updateAmpEQForType` from JS
- Each amp type has different:
  - EQ center frequencies
  - Q values
  - Default gain staging

### 6g. Test Amp Sim Module
- Test each amp type
- Verify EQ affects frequency response correctly
- Test gain staging from clean to high-gain
- Compare with web app version

---

# Phase 6: Port Modulation Module

## 7. Implement Modulation DSP

### 7a. Create Modulation Class Header
- Create `Source/DSP/Modulation.h`
- Define parameters:
  - rate (float, 0 to 1)
  - depth (float, 0 to 1)
  - blend (float, 0 to 1)
  - type (int, enum for modulation types)

### 7b. Define Modulation Types Enum
```cpp
enum class ModulationType {
    Phaser,
    Flanger,
    Chorus,
    Tremolo,
    Vibrato
};
```

### 7c. Implement LFO (Low Frequency Oscillator)
- Create `LFO` class
- Waveforms: sine, triangle
- Frequency range: 0.1Hz to 10Hz (type dependent)
- Phase offset support for stereo

### 7d. Implement Phaser
- 6-stage allpass filter cascade
- LFO modulates allpass filter frequencies
- Base frequencies: 200, 400, 800, 1600, 3200, 6400 Hz
- Depth controls modulation range

### 7e. Implement Flanger
- Short modulated delay line (1-10ms)
- LFO modulates delay time
- Add feedback for more intense effect
- Mix with dry signal

### 7f. Implement Chorus
- Similar to flanger but longer delay (20-30ms)
- Multiple voices with slight detuning
- Less feedback than flanger

### 7g. Implement Tremolo
- Amplitude modulation
- LFO directly modulates output gain
- Depth controls modulation amount
- Sine wave for smooth tremolo

### 7h. Implement Vibrato
- Pitch modulation via delay line
- Short modulated delay (like flanger)
- 100% wet signal (no dry mix)
- Creates pitch wobble effect

### 7i. Implement Delay Line
- Create `DelayLine` class using circular buffer
- Interpolation for smooth modulation (linear or cubic)
- Maximum delay time: 50ms

### 7j. Test Modulation Module
- Test each modulation type
- Verify rate and depth controls work correctly
- Check for artifacts (clicks, aliasing)
- Compare with web app version

---

# Phase 7: Port Reverb Module

## 8. Implement Reverb DSP

### 8a. Create Reverb Class Header
- Create `Source/DSP/Reverb.h`
- Define parameters:
  - decay (float, 0 to 1)
  - tone (float, 0 to 1)
  - blend (float, 0 to 1)
  - type (int, enum for reverb types)

### 8b. Define Reverb Types Enum
```cpp
enum class ReverbType {
    Spring,   // Quick decay, metallic reflections
    Plate,    // Dense, smooth decay
    Hall      // Slow buildup, long tail
};
```

### 8c. Option A: Algorithmic Reverb
- Use JUCE's `dsp::Reverb` class as starting point
- Customize parameters per reverb type
- Pros: Low CPU, no IR files needed
- Cons: Less realistic

### 8d. Option B: Convolution Reverb
- Generate impulse responses programmatically (like JS version)
- Or load IR files for more realistic reverb
- Use JUCE's `dsp::Convolution` class
- Pros: More realistic
- Cons: Higher CPU, needs IR management

### 8e. Implement Spring Reverb Character
- Port `generateReverbIR` from JS for 'spring' type
- Quick initial decay
- Metallic reflections (sine modulation in envelope)
- Shorter decay time range: 0.5-2.5 seconds

### 8f. Implement Plate Reverb Character
- Dense, smooth decay envelope
- No early reflections modulation
- Medium decay time range: 1-4 seconds

### 8g. Implement Hall Reverb Character
- Slow buildup (pre-delay feel)
- Long, smooth tail
- Long decay time range: 2-8 seconds

### 8h. Implement Reverb Tone Control
- Lowpass filter on wet signal
- Range: 1kHz to 9kHz
- Darker settings for vintage sound

### 8i. Test Reverb Module
- Test each reverb type
- Verify decay times are correct
- Check CPU usage (especially for convolution)
- Compare with web app version

---

# Phase 8: Signal Chain Integration

## 9. Integrate All Modules

### 9a. Create Effect Instances in PluginProcessor
- Instantiate each effect module:
  ```cpp
  std::unique_ptr<Compressor> comp1, comp2;
  std::unique_ptr<Distortion> distortion;
  std::unique_ptr<AmpSim> amp;
  std::unique_ptr<Modulation> modulation;
  std::unique_ptr<Reverb> reverb;
  ```

### 9b. Implement Signal Chain Class
- Create `SignalChain` class
- Stores effect order as vector of effect pointers
- Default order: comp1 → distortion → modulation → reverb → comp2 → amp
- Process method loops through effects in order

### 9c. Implement Chain Reordering
- Method to reorder effects:
  ```cpp
  void setOrder(std::vector<std::string> newOrder);
  ```
- Validate order contains all required effects
- Update internal effect pointer order

### 9d. Implement Per-Effect Bypass
- Each effect has bypass flag
- When bypassed, pass audio through unchanged
- Preserve effect state when bypassed (no reset)

### 9e. Implement Global Bypass
- Bypass entire signal chain
- Pass dry input directly to output
- Useful for A/B comparison

### 9f. Handle Sample Rate Changes
- Call `prepare()` on all effects when sample rate changes
- Recalculate filter coefficients
- Resize delay buffers as needed

### 9g. Handle Buffer Size Changes
- Call `prepare()` on all effects when buffer size changes
- Reallocate any buffers that depend on block size

### 9h. Test Full Signal Chain
- Test default effect order
- Test reordering effects
- Test individual bypasses
- Test full chain bypass
- Verify no audio glitches during reorder

---

# Phase 9: Plugin Parameter System

## 10. Implement JUCE Parameters

### 10a. Define Parameter Layout
- Use `AudioProcessorValueTreeState` for parameter management
- Define all parameters with ranges:
  ```cpp
  createParameterLayout() {
      // Comp1 parameters
      params.push_back(std::make_unique<AudioParameterFloat>(
          "comp1_threshold", "Comp1 Threshold", -60.0f, 0.0f, -20.0f));
      // ... etc for all parameters
  }
  ```

### 10b. Create Parameter IDs
- Define string constants for all parameter IDs
- Naming convention: `effectname_parametername`
- Example: `comp1_threshold`, `distortion_drive`, `amp_bass`

### 10c. Implement Parameter Listeners
- Attach listeners to update DSP when parameters change
- Use `AudioProcessorValueTreeState::Listener` interface
- Update effect module parameters in listener callbacks

### 10d. Implement Parameter Smoothing
- Use `SmoothedValue` for parameters that could cause clicks
- Smooth over ~20ms to avoid zipper noise
- Apply to: gains, filter frequencies, mix amounts

### 10e. Add Parameter Groups
- Group parameters by effect for better organization
- Improves DAW display (some DAWs show groups)
- Example groups: "Compressor 1", "Distortion", "Amp", etc.

### 10f. Test Parameter System
- Verify all parameters control their DSP correctly
- Test parameter smoothing (no clicks on fast changes)
- Test parameter save/recall (host automation)
- Test parameter ranges and defaults

---

# Phase 10: Preset System

## 11. Implement Preset Management

### 11a. Design Preset File Format
- Use JSON for `.pdlbrd` files:
  ```json
  {
    "name": "My Preset",
    "version": "1.0",
    "pedalOrder": ["comp1", "distortion", "mod", "reverb", "comp2", "amp"],
    "pedals": {
      "comp1": {
        "active": true,
        "threshold": 0.5,
        "ratio": 0.5,
        "attack": 0.3,
        "release": 0.5,
        "level": 0.5,
        "blend": 1.0
      },
      // ... other pedals
    }
  }
  ```

### 11b. Create PresetManager Class
- Methods:
  - `loadPreset(File file)`
  - `savePreset(File file)`
  - `getPresetList()` (factory + user presets)
  - `loadPresetFromJSON(String json)`
  - `exportPresetToJSON()`

### 11c. Implement JSON Parsing
- Use JUCE's `JSON` class
- Parse preset file into `var` object
- Validate required fields exist
- Handle version differences gracefully

### 11d. Implement Preset Loading
- Parse JSON to get parameter values
- Update all DSP parameters
- Update effect order
- Update bypass states
- Trigger UI refresh

### 11e. Implement Preset Saving
- Gather all current parameter values
- Get current effect order
- Get bypass states
- Serialize to JSON
- Write to file

### 11f. Add Factory Presets
- Create preset folder in plugin bundle
- Include 10-20 factory presets:
  - Clean tones
  - Crunch tones
  - High gain
  - Effects-heavy
  - Genre-specific (blues, metal, etc.)

### 11g. Implement User Preset Storage
- Define user preset location:
  - macOS: `~/Library/Audio/Presets/PDLBRD/`
  - Windows: `%APPDATA%/PDLBRD/Presets/`
- Create directory if it doesn't exist
- List user presets alongside factory presets

### 11h. Test Preset System
- Test loading factory presets
- Test saving user presets
- Test preset file compatibility
- Test corrupt/invalid preset handling

---

# Phase 11: Plugin UI

## 12. Design and Implement Plugin Interface

### 12a. Choose UI Approach
- Option A: Minimal UI (just preset browser + basic controls)
- Option B: Full UI matching web app (skeuomorphic pedals)
- Option C: Modern/flat UI with all controls
- Recommendation: Start with Option A, expand later

### 12b. Create UI Layout (Minimal Version)
```
┌─────────────────────────────────────────┐
│  PDLBRD                    [Preset ▼]   │
├─────────────────────────────────────────┤
│  Signal Chain: [Comp1][Dist][Mod]...    │
├─────────────────────────────────────────┤
│  Selected: Distortion                   │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │Drive│ │Tone │ │Level│ │Type │       │
│  └─────┘ └─────┘ └─────┘ └─────┘       │
├─────────────────────────────────────────┤
│  [Bypass]              [Load] [Save]    │
└─────────────────────────────────────────┘
```

### 12c. Implement Preset Browser UI
- Dropdown or list showing all presets
- Factory and user presets separated
- Search/filter functionality (optional)
- Load button or double-click to load

### 12d. Implement Signal Chain Display
- Show effect order as clickable buttons
- Drag to reorder (or up/down arrows)
- Click to select for editing
- Visual indication of bypass state

### 12e. Implement Parameter Controls
- Create reusable knob component
- Display parameters for selected effect
- Knobs update in real-time
- Show parameter name and value

### 12f. Implement Bypass Buttons
- Per-effect bypass toggle
- Global bypass toggle
- Visual state indication (lit when active)

### 12g. Apply Visual Styling
- Dark theme to match web app
- Accent color for active elements
- Consistent typography
- Proper spacing and alignment

### 12h. Make UI Resizable (Optional)
- Define minimum and maximum sizes
- Scale components appropriately
- Maintain aspect ratio or allow free resize

### 12i. Test UI
- Test all controls function correctly
- Test preset browser
- Test signal chain reordering
- Test on different screen sizes/resolutions
- Test in different DAWs (may render differently)

---

# Phase 12: Web App Integration

## 13. Add Export Functionality to Web App

### 13a. Add "Download for DAW" Button
- Add button to drawer or main UI
- Only show when user has saved presets (or current unsaved state)
- Style consistently with existing UI

### 13b. Implement Preset Export Function
- Create `exportForPlugin()` function
- Format: match `.pdlbrd` JSON structure exactly
- Include all current settings
- Include pedal order

### 13c. Implement File Download
- Convert JSON to Blob
- Create download link
- Trigger download with filename: `presetname.pdlbrd`
- Clean up blob URL after download

### 13d. Add Export from Saved Presets
- Add download button next to each saved preset
- Export directly from Supabase preset data
- Convert Supabase format to plugin format if different

### 13e. Create Plugin Download Page
- Landing page explaining PDLBRD plugin
- Download links for macOS (AU + VST3)
- Download links for Windows (VST3)
- Installation instructions
- Link to documentation

### 13f. Test Web App Export
- Export preset from web app
- Load in plugin
- Verify all settings match
- Test with various preset configurations

---

# Phase 13: Build and Distribution

## 14. Local Use (FREE - No Apple Developer Account Needed)

### 14a. Build Plugin in Xcode
- Open the Xcode project generated by Projucer
- Select "PDLBRD - AU" scheme
- Build (Cmd+B)
- Plugin is automatically ad-hoc signed for local use

### 14b. Install Plugin Locally
- Find built plugin in `~/Library/Audio/Plug-Ins/Components/` (Xcode copies it there)
- Or manually copy `PDLBRD.component` to:
  - User only: `~/Library/Audio/Plug-Ins/Components/`
  - All users: `/Library/Audio/Plug-Ins/Components/`

### 14c. Allow Plugin in macOS Security
- Open Logic Pro (or other DAW)
- Logic will scan and may block the unsigned plugin
- Go to **System Settings → Privacy & Security**
- Scroll down to find the blocked plugin message
- Click **"Allow Anyway"**
- Return to Logic and rescan plugins (Logic Pro → Settings → Plug-in Manager → Reset & Rescan)

### 14d. Verify Plugin Works
- Create new Logic project with audio track
- Open plugin list (Audio FX slot)
- Find PDLBRD under your manufacturer name
- Insert on track and verify it loads
- Test audio passes through

### 14e. Install Factory Presets
- Copy `.pdlbrd` preset files to:
  - `~/Library/Audio/Presets/PDLBRD/`
- Create the folder if it doesn't exist
- Presets will appear in plugin's preset browser

---

## 15. Distribution to Others (OPTIONAL - Requires $99/yr Apple Developer Account)

> **Note**: This section is only needed if you want to distribute the plugin to other users without them seeing security warnings. For personal use, skip this section entirely.

### 15a. Code Signing (macOS)
- Obtain Apple Developer ID ($99/year) from https://developer.apple.com/programs/
- Create "Developer ID Application" certificate in Xcode
- Configure Projucer to use your signing identity
- Rebuild - plugin will be properly signed

### 15b. Notarization (macOS)
- Required for macOS 10.15+ to avoid Gatekeeper warnings
- Submit to Apple for notarization:
  ```bash
  xcrun notarytool submit PDLBRD.component.zip --apple-id YOUR_EMAIL --team-id YOUR_TEAM --password YOUR_APP_PASSWORD --wait
  xcrun stapler staple PDLBRD.component
  ```

### 15c. Create Installer Package (macOS)
- Create `.pkg` installer that copies plugin to correct locations:
  - AU: `/Library/Audio/Plug-Ins/Components/`
  - VST3: `/Library/Audio/Plug-Ins/VST3/`
- Sign the installer package as well
- Or provide manual installation instructions

### 15d. Windows Build
- Set up Windows build environment (or use CI)
- Build VST3 version
- Create installer or zip file
- Test in Windows DAWs

### 15e. Create Release Package
- Plugin binaries (AU, VST3)
- Factory presets
- README with installation instructions
- License file
- Version history / changelog

### 15f. Set Up Distribution
- Option A: GitHub Releases (free hosting)
- Option B: Direct download from website
- Option C: Plugin marketplaces (KVR, Plugin Boutique)
- Include checksums for downloads

### 15g. Create Documentation
- Installation guide
- User manual (how to use plugin)
- Preset format documentation (for advanced users)
- FAQ / troubleshooting

---

# Phase 14: Future Enhancements (Option A Architecture)

> **Note**: This phase is entirely optional and requires significant infrastructure investment. Only pursue this if you want to offer "click to download custom plugin" functionality to users.

## 16. Server-Side Compilation (Advanced)

### 16a. Set Up macOS Build Server
- Mac Mini or Mac in cloud (MacStadium, AWS EC2 Mac)
- Install Xcode, JUCE
- Configure for headless builds
- Set up SSH access

### 16b. Create Build API
- REST API endpoint: `POST /api/build-plugin`
- Accepts: preset JSON, plugin name, target format
- Returns: download URL for compiled plugin

### 16c. Implement Preset Injection
- Template JUCE project with placeholder values
- Script to inject preset values at build time
- Modify plugin name and codes per build

### 16d. Implement Build Queue
- Queue system for build requests
- Build one at a time (or limited parallelism)
- Notify user when build complete
- Clean up old builds

### 16e. Implement Custom Naming
- User specifies plugin name: "MyCustomTone"
- Inject into plugin metadata
- Generate unique plugin codes
- Result: Custom-named plugin appears in DAW

### 16f. Handle Code Signing
- Sign each built plugin with Developer ID
- Notarize each build
- Cache notarization tickets

### 16g. Add to Web App
- Replace "Download Preset" with "Build Plugin"
- Show build progress/status
- Provide download when complete
- Store built plugins for re-download

---

# Appendix A: File Structure

```
pdlbrd/
├── Plugin/                          # JUCE plugin project
│   ├── Source/
│   │   ├── PluginProcessor.cpp
│   │   ├── PluginProcessor.h
│   │   ├── PluginEditor.cpp
│   │   ├── PluginEditor.h
│   │   ├── DSP/
│   │   │   ├── EffectModule.h
│   │   │   ├── Compressor.cpp
│   │   │   ├── Compressor.h
│   │   │   ├── Distortion.cpp
│   │   │   ├── Distortion.h
│   │   │   ├── AmpSim.cpp
│   │   │   ├── AmpSim.h
│   │   │   ├── Modulation.cpp
│   │   │   ├── Modulation.h
│   │   │   ├── Reverb.cpp
│   │   │   ├── Reverb.h
│   │   │   ├── SignalChain.cpp
│   │   │   ├── SignalChain.h
│   │   │   ├── LFO.cpp
│   │   │   ├── LFO.h
│   │   │   ├── DelayLine.cpp
│   │   │   ├── DelayLine.h
│   │   │   └── DSPUtils.h
│   │   ├── Presets/
│   │   │   ├── PresetManager.cpp
│   │   │   ├── PresetManager.h
│   │   │   └── FactoryPresets/
│   │   │       ├── Clean.pdlbrd
│   │   │       ├── Crunch.pdlbrd
│   │   │       └── ...
│   │   └── UI/
│   │       ├── LookAndFeel.cpp
│   │       ├── LookAndFeel.h
│   │       ├── KnobComponent.cpp
│   │       ├── KnobComponent.h
│   │       └── ...
│   ├── PDLBRD.jucer
│   └── Builds/
│       ├── MacOSX/
│       └── VisualStudio2022/
├── WebApp/                          # Existing Compstortion code
│   └── (current web app files)
├── Docs/
│   ├── Installation.md
│   ├── UserManual.md
│   └── PresetFormat.md
└── README.md
```

---

# Appendix B: Parameter Reference

| Effect | Parameter | Range | Default | Description |
|--------|-----------|-------|---------|-------------|
| Comp1/2 | threshold | -60 to 0 dB | -20 dB | Compression threshold |
| Comp1/2 | ratio | 1:1 to 20:1 | 4:1 | Compression ratio |
| Comp1/2 | attack | 0.1 to 100 ms | 10 ms | Attack time |
| Comp1/2 | release | 10 to 1000 ms | 100 ms | Release time |
| Comp1/2 | level | 0 to 2x | 1x | Output level |
| Comp1/2 | blend | 0 to 100% | 100% | Wet/dry mix |
| Distortion | drive | 0 to 100% | 50% | Distortion amount |
| Distortion | tone | 0 to 100% | 50% | Tone filter |
| Distortion | level | 0 to 100% | 50% | Output level |
| Distortion | type | 0-4 | 0 | TS9/RAT/Blues/Fuzz/Muff |
| Amp | gain | 0 to 100% | 30% | Preamp gain |
| Amp | bass | -12 to +12 dB | 0 dB | Bass EQ |
| Amp | mid | -12 to +12 dB | 0 dB | Mid EQ |
| Amp | midFreq | 200 to 2000 Hz | 800 Hz | Mid frequency |
| Amp | treble | -12 to +12 dB | 0 dB | Treble EQ |
| Amp | master | 0 to 100% | 70% | Master volume |
| Amp | type | 0-4 | 0 | Clean/Crunch/Lead/Modern/Vintage |
| Modulation | rate | 0.1 to 10 Hz | 2 Hz | LFO rate |
| Modulation | depth | 0 to 100% | 50% | Effect depth |
| Modulation | blend | 0 to 100% | 50% | Wet/dry mix |
| Modulation | type | 0-4 | 0 | Phaser/Flanger/Chorus/Trem/Vib |
| Reverb | decay | 0.5 to 8 s | 2 s | Reverb time |
| Reverb | tone | 1k to 9k Hz | 5k Hz | Damping filter |
| Reverb | blend | 0 to 100% | 30% | Wet/dry mix |
| Reverb | type | 0-2 | 0 | Spring/Plate/Hall |

---

# Appendix C: Resources

## JUCE
- Documentation: https://juce.com/learn/documentation
- Tutorials: https://juce.com/learn/tutorials
- Forum: https://forum.juce.com
- GitHub: https://github.com/juce-framework/JUCE

## Audio DSP
- "Designing Audio Effect Plugins in C++" by Will Pirkle
- "DAFX: Digital Audio Effects" by Udo Zölzer
- KVR Audio Developer Forum: https://www.kvraudio.com/forum/

## Apple Audio Unit
- Audio Unit Hosting Guide: https://developer.apple.com/documentation/audiounit
- Core Audio Overview: https://developer.apple.com/library/archive/documentation/MusicAudio/Conceptual/CoreAudioOverview/

## Code Signing
- Apple Developer Program: https://developer.apple.com/programs/
- Notarization Guide: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
