/**
 * Speech Recognition Module
 *
 * Wrapper around Web Speech API with offline SODA support (Chrome).
 * Enable offline: chrome://settings/accessibility → Live Caption (~60MB)
 */

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

/**
 * Check if Speech Recognition is supported
 */
export function isSupported() {
  return !!SpeechRecognition;
}

/**
 * Check if local/offline processing is available
 * @returns {Promise<'available'|'downloadable'|'unavailable'|'unknown'>}
 */
export async function checkLocalAvailable() {
  if (!SpeechRecognition) return 'unavailable';

  if (typeof SpeechRecognition.available === 'function') {
    try {
      return await SpeechRecognition.available({
        langs: ['en-US'],
        processLocally: true,
      });
    } catch (e) {
      return 'unknown';
    }
  }
  return 'unknown';
}

/**
 * Speech Listener - waits for a single utterance
 * Reuses the same SpeechRecognition instance to avoid repeated permission prompts.
 */
export class SpeechListener {
  constructor(options = {}) {
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported in this browser');
    }

    this.lang = options.lang || 'en-US';
    this._recognition = null;
    this._listening = false;
    this._resolve = null;
    this._reject = null;
    this._transcript = '';
    this._resultIndex = 0;  // Track which results we've processed

    // file:// URLs don't persist mic permissions, so keep recognition always active
    this._isFileProtocol = window.location.protocol === 'file:';
    this._alwaysActive = false;
    this._recognitionRunning = false;  // Track if recognition is actually running

    this._initRecognition();
  }

  _initRecognition() {
    const recognition = new SpeechRecognition();
    recognition.continuous = true;         // Keep listening for full phrase
    recognition.interimResults = true;     // Get partial results (helps with offline)
    recognition.lang = this.lang;

    recognition.onresult = (event) => {
      // Only process NEW results (from _resultIndex onward)
      let transcript = '';
      for (let i = this._resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      this._transcript = transcript;

      // Check if we have a final result
      const lastResult = event.results[event.results.length - 1];
      if (lastResult.isFinal) {
        // Mark all current results as processed for next listen() call
        this._resultIndex = event.results.length;
        this._finishListening(this._transcript);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        this._finishListening('');
      } else if (event.error === 'aborted') {
        // Intentional abort, ignore
      } else {
        this._finishListening('', new Error(`Speech error: ${event.error}`));
      }
    };

    recognition.onend = () => {
      this._recognitionRunning = false;

      // Recognition stopped - return whatever we have
      if (this._listening) {
        this._finishListening(this._transcript);
      }

      // Restart recognition to keep it always active
      if (this._alwaysActive) {
        this._resultIndex = 0;  // Reset index for fresh results
        try {
          recognition.start();
          this._recognitionRunning = true;
        } catch (e) {
          // Already started or other error, ignore
        }
      }
    };

    this._recognition = recognition;
  }

  _finishListening(transcript, error = null) {
    if (!this._listening) return;

    this._listening = false;
    const resolve = this._resolve;
    const reject = this._reject;
    this._resolve = null;
    this._reject = null;
    this._transcript = '';

    // On file://, keep recognition running to avoid permission re-prompts
    if (!this._alwaysActive) {
      this._recognitionRunning = false;  // Mark stopped immediately, don't wait for onend
      try {
        this._recognition.stop();
      } catch (e) {
        // Ignore stop errors
      }
    }

    if (error) {
      reject?.(error);
    } else {
      resolve?.(transcript);
    }
  }

  /**
   * Listen for a single utterance
   * @returns {Promise<string>} The transcribed text
   */
  listen() {
    return new Promise((resolve, reject) => {
      if (this._listening) {
        reject(new Error('Already listening'));
        return;
      }

      this._listening = true;
      this._resolve = resolve;
      this._reject = reject;
      this._transcript = '';

      // Always-active mode: keep recognition running between listens
      // This avoids issues with stop/restart cycle failing on some browsers
      this._alwaysActive = true;

      // If already running, just wait for next result
      if (this._recognitionRunning) {
        return;
      }

      try {
        this._recognition.start();
        this._recognitionRunning = true;
      } catch (e) {
        // Error - try reinitializing
        this._recognitionRunning = false;
        this._initRecognition();
        try {
          this._recognition.start();
          this._recognitionRunning = true;
        } catch (e2) {
          this._listening = false;
          reject(e2);
        }
      }
    });
  }

  /**
   * Cancel current listening
   */
  cancel() {
    this._listening = false;
    this._resolve = null;
    this._reject = null;

    if (this._alwaysActive) {
      // In always-active mode, just clear state but keep recognition running
      return;
    }

    if (this._recognition) {
      try {
        this._recognition.abort();
      } catch (e) {
        // Ignore
      }
      this._recognition = null;
    }
  }

  /**
   * Stop recognition completely (for session end)
   */
  stop() {
    this._alwaysActive = false;
    this._listening = false;
    this._recognitionRunning = false;
    this._resolve = null;
    this._reject = null;
    this._resultIndex = 0;

    if (this._recognition) {
      try {
        this._recognition.stop();
      } catch (e) {
        // Ignore
      }
    }
  }

  /**
   * Check if currently listening
   */
  get isListening() {
    return this._listening;
  }
}

/**
 * Fuzzy match helper - check if transcript matches expected phrase
 * @param {string} transcript - What the user said
 * @param {string} expected - What we expected
 * @param {object} options - Matching options
 */
export function fuzzyMatch(transcript, expected, options = {}) {
  const {
    threshold = 0.7,  // How similar (0-1)
    substring = true, // Check if expected is substring
  } = options;

  const clean = (s) => s.toLowerCase().trim().replace(/[^\w\s]/g, '');

  const t = clean(transcript);
  const e = clean(expected);

  // Exact match
  if (t === e) return { match: true, confidence: 1.0, method: 'exact' };

  // Substring match (e.g., "I obey" in "I obey master")
  if (substring && t.includes(e)) {
    return { match: true, confidence: 0.9, method: 'substring' };
  }

  // Check if key word is present (e.g., "obey" in "i o bay")
  const keyWord = e.split(' ').pop(); // Last word is usually the key
  if (t.includes(keyWord)) {
    return { match: true, confidence: 0.8, method: 'keyword' };
  }

  // Simple character overlap ratio
  const overlap = [...e].filter(c => t.includes(c)).length / e.length;
  if (overlap >= threshold) {
    return { match: true, confidence: overlap, method: 'overlap' };
  }

  return { match: false, confidence: overlap, method: 'none' };
}
