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
 */
export class SpeechListener {
  constructor(options = {}) {
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported in this browser');
    }

    this.lang = options.lang || 'en-US';
    this._recognition = null;
    this._listening = false;
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

      const recognition = new SpeechRecognition();
      recognition.continuous = false;      // Stop after one utterance
      recognition.interimResults = false;  // Only final results
      recognition.lang = this.lang;

      this._recognition = recognition;
      this._listening = true;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        this._listening = false;
        this._recognition = null;
        resolve(transcript);
      };

      recognition.onerror = (event) => {
        this._listening = false;
        this._recognition = null;

        if (event.error === 'no-speech') {
          // No speech detected - resolve with empty string
          resolve('');
        } else {
          reject(new Error(`Speech error: ${event.error}`));
        }
      };

      recognition.onend = () => {
        // If we get here without a result, resolve empty
        if (this._listening) {
          this._listening = false;
          this._recognition = null;
          resolve('');
        }
      };

      try {
        recognition.start();
      } catch (e) {
        this._listening = false;
        this._recognition = null;
        reject(e);
      }
    });
  }

  /**
   * Cancel current listening
   */
  cancel() {
    if (this._recognition) {
      try {
        this._recognition.abort();
      } catch (e) {
        // Ignore
      }
      this._recognition = null;
      this._listening = false;
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
