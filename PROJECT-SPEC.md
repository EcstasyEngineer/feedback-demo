# Hypnotic Neurofeedback POC - Project Specification

## Overview

A browser-based hypnosis/neurofeedback tool combining:
1. **Haptic feedback** via Bluetooth toys (Lovense vibration, DG-Lab Coyote e-stim)
2. **Voice transcription** for guided audio/instructions
3. **Eye tracking** for gaze-based interaction and calibration
4. **Visual avatar** (optional) for anthropomorphic presence

Target: Single-file or minimal-build web app, deployable to GitHub Pages.

---

## Components

### 1. Haptic Device Control (PARTIAL - In Progress)

**Status:** Working POC in `haptic-unified.html`

**Lovense (vibration):**
- Fully working
- Real-time intensity control via slider
- Uses simple text commands (`Vibrate:N;`)

**DG-Lab Coyote V2 (e-stim):**
- Basic functionality working
- Channel A/B mapping fixed (WAVE_A=1506, WAVE_B=1505 - see COYOTE-PROTOCOL.md)
- **Known issues needing Windows desktop debugging:**
  - Power scaling feels off (0-2047 range, currently using 50% max)
  - Waveform parameters (X/Y/Z) need tuning
  - Latency concerns
  - Needs direct BLE debugging with device

**Coyote V3:**
- Code exists but UNTESTED (no V3 hardware available)
- May have same A/B flip issue as V2

**Next steps:**
- Modularize into separate JS files
- Dedicated Coyote debugging session on Windows with direct BLE access
- Consider splitting Lovense vs Coyote into separate modules

---

### 2. Voice Transcription (READY)

**Status:** Working POC in `speech-demo.html` with full documentation in `SPEECH-RECOGNITION-INTEGRATION.md`

**Tech:**
- Chrome: Offline via SODA (Speech On-Device API) - 60MB download via `chrome://settings/accessibility` → Live Caption
- Edge: Cloud-based (Microsoft services)
- Uses native Web Speech API - no libraries needed

**What's done:**
- Interactive demo with status cards
- Interim + final transcript display
- Auto-restart with error tracking
- `SpeechHandler` class ready for integration
- Gotchas documented (DevTools offline doesn't work, confidence=0 for SODA, etc.)

**Integration needs:**
- Wire `onTranscript` callback to session controller
- Consider: keyword triggers? voice commands?

---

### 3. Eye Tracking (NOT STARTED)

**Status:** Research phase

**Candidates:**
| Library | Pros | Cons |
|---------|------|------|
| WebGazer.js | Popular, works in browser | Calibration heavy, accuracy varies |
| MediaPipe Face Mesh | Google-backed, accurate landmarks | Need to extract gaze from mesh |
| xr-animator | Seen face grid in debug | May be overkill, primarily for XR |

**Requirements:**
- Track gaze position (x, y on screen)
- Detect if user is looking at target zone
- Minimal calibration (or use follow-the-finger AS calibration)

**Open questions:**
- Is webcam-based gaze tracking accurate enough for this use case?
- Fallback for no camera access?

---

### 4. Visual Avatar / Finger (OPTIONAL)

**Status:** Conceptual

**Options:**
1. **VRM model** (VRoid) - More "presence," anthropomorphic feel
2. **Simple 3D hand** - Three.js + hand rig
3. **2D graphic** - CSS/Canvas animated finger/pendulum
4. **Abstract** - Glowing orb, geometric shape

**Legal note:**
- Do NOT use copyrighted characters (Ganyu, etc.) on public demos
- Use VRoid Hub CC0 models, original creations, or abstract shapes

**Tech if using VRM:**
- Three.js + @pixiv/three-vrm
- Animate hand/finger bone for pendulum motion

---

## UX Concept

### Core Flow (Draft)

```
1. SETUP
   - Connect haptic device (optional)
   - Enable microphone (for transcription)
   - Enable camera (for eye tracking)

2. CALIBRATION (follow-the-finger)
   - Display moving target (finger/orb)
   - User follows with gaze
   - System learns user's gaze patterns
   - This IS the induction start (dual purpose)

3. ACTIVE SESSION
   - Audio plays (live or pre-recorded)
   - Haptic feedback synced to audio/state
   - Eye tracking monitors engagement

4. NEUROFEEDBACK (if gaze drifts)
   - Visual: Screen greys, edges darken (vignette)
   - Audio: Low-pass filter (muffled), optional tinnitus
   - Haptic: Reduce/change pattern
   - Goal: Gently guide attention back
```

### Open Design Questions

1. **If follow-the-finger is calibration, what's the fixation target during session?**
   - Static point?
   - Slow-moving pattern?
   - The avatar's eyes?

2. **What triggers neurofeedback?**
   - Gaze outside target zone?
   - Gaze on "distractors"?
   - Blink rate / eye closure?

3. **How aggressive should feedback be?**
   - Gentle nudge vs jarring snap-back
   - Gradual transition vs immediate

---

## Architecture

### Proposed File Structure

```
/src
  /haptic
    lovense.js       # Lovense BLE protocol
    coyote.js        # Coyote V2/V3 BLE protocol
    manager.js       # Unified device manager
  /audio
    transcription.js # Speech recognition wrapper
    effects.js       # Audio feedback (low-pass, etc.)
  /vision
    eyetracking.js   # Gaze detection wrapper
    calibration.js   # Calibration routine
  /visual
    avatar.js        # VRM/3D rendering (optional)
    feedback.js      # Screen effects (vignette, grey-out)
  /core
    session.js       # Main session controller
    state.js         # State machine for session flow
  index.html
  main.js            # Entry point
```

### Build Setup

**Development:**
```bash
npm init -y
npm i -D vite
npx vite
```

**Production:**
```bash
npx vite build
# Outputs to /dist, deployable to GitHub Pages
```

---

## Technical Decisions Made

| Decision | Rationale |
|----------|-----------|
| No Buttplug.io | 1.5-5MB WASM bundle vs ~20KB direct BLE |
| Web Bluetooth API | Native browser support, no install needed |
| Vite for dev | Zero-config, fast HMR, easy production build |
| ES Modules | Clean separation, tree-shakeable |
| Single-page app | Simpler deployment, no routing needed |

---

## Known Issues / Tech Debt

1. **Coyote V2 power scaling** - Needs calibration against physical sensation
2. **Coyote V2 waveform tuning** - X/Y/Z parameters not fully understood
3. **Coyote V3 untested** - May have A/B flip, needs hardware
4. **BLE reconnection** - Currently requires page refresh
5. **No error recovery UI** - Silent failures in some cases

---

## References

- `COYOTE-PROTOCOL.md` - Full V2/V3 BLE protocol documentation
- `HAPTIC-RESEARCH.md` - Background research (if exists)
- DG-LAB-OPENSOURCE: https://github.com/DG-LAB-OPENSOURCE/DG-LAB-OPENSOURCE

---

## Next Actions

### Immediate: Minimal "I Obey" POC

Simple call-and-response demo using Vite:

1. Screen shows **"Say: I obey"** in big text
2. User speaks → transcription captures it
3. If match → vibe activates, screen shows **"Good pet"**
4. Vibe runs for a few seconds, then stops

**Transcription brittleness notes:**
- Speech-to-text is imperfect ("I obey" might come back as "i o bay", "I obey.", etc.)
- Options for fuzzy matching:
  - Levenshtein distance
  - Syllable counting (2 syllables starting with "I")
  - Phonetic matching (Soundex/Metaphone)
  - Just check for "obey" substring
- Document that this WILL be ass sometimes - it's a known limitation

### Modularization

1. [ ] Separate Lovense into `src/haptic/lovense.js`
2. [ ] Separate Coyote into `src/haptic/coyote.js` (treat as experimental)
3. [ ] Lovense-only focus for broader compatibility (most vibrators use similar protocols)
4. [ ] Set up Vite project structure

### Later

5. [ ] Evaluate eye tracking libraries (WebGazer vs MediaPipe)
6. [ ] Design session state machine
7. [ ] Create minimal visual feedback (vignette, grey-out)
8. [ ] Windows desktop session for Coyote V2 tuning
