# Web Speech API Integration Guide

## TL;DR - Minimal Working Code

```javascript
// Check support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (!SpeechRecognition) {
  console.error('Speech recognition not supported');
}

// Create and configure
const recognition = new SpeechRecognition();
recognition.continuous = true;       // Keep listening (don't stop after first result)
recognition.interimResults = true;   // Get partial results as user speaks
recognition.lang = 'en-US';          // Language

// Handle results
recognition.onresult = (event) => {
  const result = event.results[event.results.length - 1];
  const transcript = result[0].transcript;
  const isFinal = result.isFinal;

  if (isFinal) {
    console.log('Final:', transcript);
    // DO SOMETHING WITH FINAL TRANSCRIPT
  } else {
    console.log('Interim:', transcript);
    // Optional: show live preview
  }
};

// Handle errors
recognition.onerror = (event) => {
  console.error('Speech error:', event.error);
  // Common errors: 'network', 'not-allowed', 'no-speech'
};

// Auto-restart on natural end (silence)
let shouldRestart = true;
recognition.onend = () => {
  if (shouldRestart) {
    recognition.start();
  }
};

// Start/stop functions
function startListening() {
  shouldRestart = true;
  recognition.start();
}

function stopListening() {
  shouldRestart = false;
  recognition.stop();
}
```

---

## What This Is

The Web Speech API is a **browser-native** speech-to-text API. No libraries, no API keys, no setup.

- **Chrome/Edge**: Uses Google/Microsoft cloud by default
- **Chrome + Live Caption enabled**: Uses local SODA model (works offline)
- **Firefox**: Limited/no support
- **Safari**: Uses Apple's speech (macOS only)

---

## Browser Requirements

| Browser | Works | Offline Capable |
|---------|-------|-----------------|
| Chrome 33+ | Yes | Yes (with Live Caption) |
| Edge | Yes | No (cloud only) |
| Firefox | Partial | No |
| Safari | Yes | Maybe (Apple's on-device) |

### Enabling Offline/Local Processing (Chrome)

1. Go to `chrome://settings/accessibility`
2. Enable **"Live Caption"**
3. Downloads ~60MB SODA language model
4. Speech recognition now works offline

---

## Key Properties

```javascript
recognition.continuous = true;
// true = keep listening until manually stopped
// false = stop after first final result (default)

recognition.interimResults = true;
// true = fire onresult for partial/in-progress speech
// false = only fire when utterance is complete (default)

recognition.lang = 'en-US';
// BCP 47 language tag
// Examples: 'en-US', 'en-GB', 'es-ES', 'ja-JP'

recognition.maxAlternatives = 1;
// Number of alternative transcriptions to return (default: 1)
```

---

## Events

### `onresult` - The Important One

```javascript
recognition.onresult = (event) => {
  // event.results is a SpeechRecognitionResultList
  // Each result has alternatives (usually just use [0])

  for (let i = event.resultIndex; i < event.results.length; i++) {
    const result = event.results[i];
    const transcript = result[0].transcript;
    const confidence = result[0].confidence; // 0.0 to 1.0 (often 0 for local)
    const isFinal = result.isFinal;

    if (isFinal) {
      // User finished speaking this phrase
      handleFinalTranscript(transcript);
    } else {
      // User still speaking, this may change
      showInterimPreview(transcript);
    }
  }
};
```

### Other Events

```javascript
recognition.onstart = () => { /* Recognition started */ };
recognition.onend = () => { /* Recognition ended - may auto-restart */ };
recognition.onerror = (e) => { /* Error: e.error */ };
recognition.onspeechstart = () => { /* User started speaking */ };
recognition.onspeechend = () => { /* User stopped speaking */ };
recognition.onaudiostart = () => { /* Mic activated */ };
recognition.onaudioend = () => { /* Mic deactivated */ };
```

---

## Common Error Codes

```javascript
recognition.onerror = (event) => {
  switch (event.error) {
    case 'network':
      // No internet and no local processing available
      break;
    case 'not-allowed':
      // User denied microphone permission
      break;
    case 'no-speech':
      // No speech detected (can ignore, will auto-restart)
      break;
    case 'aborted':
      // Recognition was aborted
      break;
    case 'audio-capture':
      // Microphone not available
      break;
    case 'language-not-supported':
      // Language pack not installed (for local processing)
      break;
  }
};
```

---

## Gotchas We Discovered

### 1. DevTools "Offline" Doesn't Block Speech API
The speech API traffic goes through the browser process, not the page. To test offline, use **Airplane Mode**.

### 2. Auto-Restart Loops on Error
If you auto-restart in `onend`, add error tracking:

```javascript
let hadError = false;

recognition.onerror = (event) => {
  hadError = true;
  // handle error...
};

recognition.onend = () => {
  if (shouldRestart && !hadError) {
    recognition.start();
  }
  hadError = false;
};
```

### 3. Confidence is Often 0.0
Local processing (SODA) returns 0.0 confidence. Don't rely on it.

### 4. `start()` Can Throw
If called while already running:

```javascript
function startListening() {
  try {
    recognition.start();
  } catch (e) {
    // Already started, ignore
  }
}
```

### 5. Edge ≠ Chrome for Local Processing
Edge is Chromium-based but doesn't have SODA. It always uses Microsoft cloud.

---

## Integration Pattern: Call and Response

For your use case (waiting for user response, then acting):

```javascript
class SpeechHandler {
  constructor(onTranscript) {
    this.recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    this.recognition.continuous = false;  // Stop after one utterance
    this.recognition.interimResults = false;  // Only final results
    this.recognition.lang = 'en-US';
    this.onTranscript = onTranscript;
    this.listening = false;

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      this.listening = false;
      this.onTranscript(transcript);
    };

    this.recognition.onerror = (event) => {
      this.listening = false;
      if (event.error !== 'no-speech') {
        console.error('Speech error:', event.error);
      }
    };

    this.recognition.onend = () => {
      this.listening = false;
    };
  }

  listen() {
    if (!this.listening) {
      this.listening = true;
      try {
        this.recognition.start();
      } catch (e) {}
    }
  }

  stop() {
    this.listening = false;
    try {
      this.recognition.stop();
    } catch (e) {}
  }
}

// Usage
const speech = new SpeechHandler((transcript) => {
  console.log('User said:', transcript);
  // Trigger buttplug.io feedback, vroid response, etc.
});

// When ready for user input:
speech.listen();
```

---

## Check Local Processing Availability (Optional)

```javascript
async function checkLocalAvailable() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR && typeof SR.available === 'function') {
    const status = await SR.available({ langs: ['en-US'], processLocally: true });
    // Returns: 'available' | 'downloadable' | 'unavailable'
    return status;
  }
  return 'unknown';
}
```

---

## References

- [MDN: Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [MDN: SpeechRecognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
- [Chrome SODA (local processing)](https://chromestatus.com/feature/6090916291674112)
- [Unit.tools implementation](https://github.com/samuelmtimbo/unit/blob/main/src/api/speech/index.ts)

---

## Files

- `speech-demo.html` - Interactive demo with status display and logging
- This file - Integration documentation
