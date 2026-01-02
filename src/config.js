/**
 * Configuration Module
 *
 * Manages prompts and session settings with localStorage persistence
 * and URL sharing support.
 */

const STORAGE_KEY = 'callresponse_prompts';
const SETTINGS_KEY = 'callresponse_settings';

// ============================================================================
// Prompts
// ============================================================================

const DEFAULT_PROMPTS = [
  // Direct obedience
  'I obey',
  'I submit',
  'I surrender',
  'I do not resist',
  // Master acknowledgment
  'Yes Master',
  'Master Knows Best',
  'I belong to Master',
  // Mental state
  'My mind is empty',
  'Obedience is pleasure',
  'Pleasure is obedience',
  // Desire
  'I need to be used',
  'I need to be controlled',
];

export function loadPrompts() {
  // Check URL first
  const urlConfig = parseUrlConfig();
  if (urlConfig?.prompts) return urlConfig.prompts;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Handle both old format (array of objects) and new format (array of strings)
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (typeof parsed[0] === 'string') return parsed;
        // Migrate old format
        return parsed.map(p => p.say || p);
      }
    }
  } catch (e) {
    console.warn('Failed to load prompts:', e);
  }

  return [...DEFAULT_PROMPTS];
}

export function savePrompts(prompts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
  } catch (e) {
    console.warn('Failed to save prompts:', e);
  }
}

export function resetPrompts() {
  localStorage.removeItem(STORAGE_KEY);
  return [...DEFAULT_PROMPTS];
}

let cachedUrlConfig = null;

function parseUrlConfig() {
  const hash = window.location.hash.slice(1);
  if (!hash) return null;

  try {
    // New format: base64 encoded JSON
    if (hash.startsWith('c=')) {
      const decoded = atob(hash.slice(2));
      cachedUrlConfig = JSON.parse(decoded);
      return cachedUrlConfig;
    }

    // Legacy format: prompts=a,b,c
    const params = new URLSearchParams(hash);
    const promptsParam = params.get('prompts');
    if (promptsParam) {
      const prompts = promptsParam.split(',')
        .map(p => decodeURIComponent(p.split(':')[0].trim()))
        .filter(p => p);
      cachedUrlConfig = { prompts };
      return cachedUrlConfig;
    }
  } catch (e) {
    console.warn('Failed to parse URL config:', e);
  }
  return null;
}

export function generateShareUrl(prompts, settings) {
  const config = {
    prompts,
    settings: {
      rewardText: settings.rewardText,
      petName: settings.petName,
      pronounProgression: settings.pronounProgression,
      clickerEnabled: settings.clickerEnabled,
      promptsEnabled: settings.promptsEnabled,
      randomizePrompts: settings.randomizePrompts,
      sessionDuration: settings.sessionDuration,
      intensity: settings.intensity,
      delay: settings.delay,
      reward: settings.reward,
      patternSwitch: settings.patternSwitch,
    }
  };

  const encoded = btoa(JSON.stringify(config));
  const url = new URL(window.location.href);
  url.hash = `c=${encoded}`;
  return url.toString();
}

export function isSharedConfig() {
  return parseUrlConfig() !== null;
}

/**
 * Export config as a copyable text blob (base64 JSON)
 */
export function exportConfig(prompts, settings) {
  const config = {
    prompts,
    settings: {
      rewardText: settings.rewardText,
      petName: settings.petName,
      pronounProgression: settings.pronounProgression,
      clickerEnabled: settings.clickerEnabled,
      promptsEnabled: settings.promptsEnabled,
      randomizePrompts: settings.randomizePrompts,
      sessionDuration: settings.sessionDuration,
      intensity: settings.intensity,
      delay: settings.delay,
      reward: settings.reward,
      patternSwitch: settings.patternSwitch,
    }
  };
  return btoa(JSON.stringify(config));
}

/**
 * Import config from a text blob
 * @returns {{ prompts: string[], settings: object } | null}
 */
export function importConfig(blob) {
  try {
    const decoded = atob(blob.trim());
    const config = JSON.parse(decoded);
    if (!config.prompts || !Array.isArray(config.prompts)) {
      throw new Error('Invalid config: missing prompts');
    }
    return config;
  } catch (e) {
    console.warn('Failed to import config:', e);
    return null;
  }
}

export function onUrlChange(callback) {
  window.addEventListener('hashchange', () => {
    cachedUrlConfig = null; // Clear cache
    callback();
  });
}

export { DEFAULT_PROMPTS };

// ============================================================================
// Patterns - Normalized 0-1 values, interpolated to min/max at runtime
// ============================================================================

const PATTERNS = {
  constant: [1],  // Uses max value only
  climb: [0, 0.2, 0.4, 0.6, 0.8, 1],
  descend: [1, 0.8, 0.6, 0.4, 0.2, 0],
  pulse: [0.5, 0.8, 0.5, 0.8, 0.5, 1],
  tease: [0.3, 0.6, 0.3, 0.7, 0.3, 0.8, 0.3, 1],
  surge: [0.4, 0.4, 0.6, 0.6, 0.8, 0.8, 1, 1],
  wave: [0.3, 0.5, 0.8, 1, 0.8, 0.5, 0.3],
  heartbeat: [0.2, 1, 0.4, 0.8, 0.2],
  staircase: [0.25, 0.25, 0.5, 0.5, 0.75, 0.75, 1, 1],
};

// ============================================================================
// Session Settings
// ============================================================================

// Session arc functions - return {min, max} as fractions of the configured range
// t = session progress (0 to 1)
// All return normalized values where 0 = configured min, 1 = configured max
const SESSION_ARCS = {
  // Full range always
  constant: t => ({ min: 0, max: 1 }),

  // Anchored at bottom (min fixed)
  open_up: t => ({ min: 0, max: t }),
  close_down: t => ({ min: 0, max: 1 - t }),

  // Anchored at top (max fixed)
  open_down: t => ({ min: 1 - t, max: 1 }),
  close_up: t => ({ min: t, max: 1 }),

  // Slide up (constant width, moves from bottom to top)
  slide_up_wide: t => ({ min: t * 0.25, max: 0.75 + t * 0.25 }),     // 75% width
  slide_up: t => ({ min: t * 0.5, max: 0.5 + t * 0.5 }),             // 50% width
  slide_up_narrow: t => ({ min: t * 0.75, max: 0.25 + t * 0.75 }),   // 25% width

  // Slide down (constant width, moves from top to bottom)
  slide_down_wide: t => ({ min: 0.25 - t * 0.25, max: 1 - t * 0.25 }),   // 75% width
  slide_down: t => ({ min: 0.5 - t * 0.5, max: 1 - t * 0.5 }),           // 50% width
  slide_down_narrow: t => ({ min: 0.75 - t * 0.75, max: 1 - t * 0.75 }), // 25% width

  // Focus (width shrinks as it moves)
  focus_high: t => {
    const width = 1 - t * 0.8;  // 100% -> 20%
    return { min: Math.max(0, t - width/2), max: Math.min(1, t + width/2) };
  },
  focus_low: t => {
    const width = 1 - t * 0.8;
    const center = 1 - t;
    return { min: Math.max(0, center - width/2), max: Math.min(1, center + width/2) };
  },
};

const DEFAULT_SETTINGS = {
  rewardText: 'Good Puppet',
  petName: 'Puppet',
  pronounProgression: true,  // gradually shift "I" → petName over session
  clickerEnabled: false,     // play click sound with reward
  promptsEnabled: true,      // false = loading mode (auto clicker+vibe on timer)
  randomizePrompts: true,    // shuffle prompt order each session
  sessionDuration: 600,  // 10 minutes in seconds
  intensity: {
    metapattern: 'close_up',
    patterns: ['climb', 'surge', 'wave'],
    min: 0.1,
    max: 0.7,
  },
  delay: {
    metapattern: 'focus_high',
    patterns: ['random'],
    min: 4,
    max: 12,
  },
  reward: {
    metapattern: 'close_down',
    patterns: ['descend', 'surge', 'wave'],
    min: 0.5,
    max: 1.2,
  },
  patternSwitch: {
    minInstances: 8,
    maxInstances: 16,
  },
};

function migrateSettings(s) {
  // Migrate old single-pattern format to new multi-pattern format
  const migrate = (cat) => {
    if (cat.pattern && !cat.patterns) {
      cat.patterns = [cat.pattern];
      delete cat.pattern;
    }
    return cat;
  };
  if (s.intensity) s.intensity = migrate(s.intensity);
  if (s.delay) s.delay = migrate(s.delay);
  if (s.reward) s.reward = migrate(s.reward);
  return s;
}

export function loadSettings() {
  // Check URL first
  const urlConfig = parseUrlConfig();
  if (urlConfig?.settings) {
    const s = migrateSettings(urlConfig.settings);
    return {
      rewardText: s.rewardText || DEFAULT_SETTINGS.rewardText,
      petName: s.petName || DEFAULT_SETTINGS.petName,
      pronounProgression: s.pronounProgression ?? DEFAULT_SETTINGS.pronounProgression,
      clickerEnabled: s.clickerEnabled ?? DEFAULT_SETTINGS.clickerEnabled,
      promptsEnabled: s.promptsEnabled ?? DEFAULT_SETTINGS.promptsEnabled,
      sessionDuration: s.sessionDuration || DEFAULT_SETTINGS.sessionDuration,
      intensity: { ...DEFAULT_SETTINGS.intensity, ...s.intensity },
      delay: { ...DEFAULT_SETTINGS.delay, ...s.delay },
      reward: { ...DEFAULT_SETTINGS.reward, ...s.reward },
      patternSwitch: { ...DEFAULT_SETTINGS.patternSwitch, ...s.patternSwitch },
    };
  }

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = migrateSettings(JSON.parse(stored));
      return {
        rewardText: parsed.rewardText || DEFAULT_SETTINGS.rewardText,
        petName: parsed.petName || DEFAULT_SETTINGS.petName,
        pronounProgression: parsed.pronounProgression ?? DEFAULT_SETTINGS.pronounProgression,
        clickerEnabled: parsed.clickerEnabled ?? DEFAULT_SETTINGS.clickerEnabled,
        promptsEnabled: parsed.promptsEnabled ?? DEFAULT_SETTINGS.promptsEnabled,
        sessionDuration: parsed.sessionDuration || DEFAULT_SETTINGS.sessionDuration,
        intensity: { ...DEFAULT_SETTINGS.intensity, ...parsed.intensity },
        delay: { ...DEFAULT_SETTINGS.delay, ...parsed.delay },
        reward: { ...DEFAULT_SETTINGS.reward, ...parsed.reward },
        patternSwitch: { ...DEFAULT_SETTINGS.patternSwitch, ...parsed.patternSwitch },
      };
    }
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

export function resetSettings() {
  localStorage.removeItem(SETTINGS_KEY);
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
}

// ============================================================================
// Session State - Tracks pattern progress during a session
// ============================================================================

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInRange(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function createCategoryState(patterns, switchSettings) {
  const selectedPatterns = patterns.length > 0 ? patterns : ['constant'];
  const currentPattern = pickRandom(selectedPatterns);
  return {
    patterns: selectedPatterns,
    currentPattern,
    index: 0,
    instancesRemaining: randomInRange(switchSettings.minInstances, switchSettings.maxInstances),
  };
}

export function createSession(settings) {
  return {
    intensity: createCategoryState(settings.intensity.patterns, settings.patternSwitch),
    delay: createCategoryState(settings.delay.patterns, settings.patternSwitch),
    reward: createCategoryState(settings.reward.patterns, settings.patternSwitch),
    step: 0,
    startTime: Date.now(),
    duration: settings.sessionDuration * 1000,  // convert to ms
  };
}

/**
 * Get interpolated value from pattern
 */
function getPatternValue(patternName, index, min, max) {
  if (patternName === 'random') {
    return min + Math.random() * (max - min);
  }

  const pattern = PATTERNS[patternName] || PATTERNS.constant;
  const normalized = pattern[index % pattern.length];
  return min + normalized * (max - min);
}

/**
 * Advance category state - switch pattern if needed
 */
function advanceCategory(catState, switchSettings) {
  catState.index++;
  catState.instancesRemaining--;

  if (catState.instancesRemaining <= 0 && catState.patterns.length > 1) {
    // Switch to a different pattern
    const otherPatterns = catState.patterns.filter(p => p !== catState.currentPattern);
    if (otherPatterns.length > 0) {
      catState.currentPattern = pickRandom(otherPatterns);
    } else {
      catState.currentPattern = pickRandom(catState.patterns);
    }
    catState.index = 0;
    catState.instancesRemaining = randomInRange(switchSettings.minInstances, switchSettings.maxInstances);
  }
}

/**
 * Get session progress (0-1)
 */
function getSessionProgress(session) {
  const elapsed = Date.now() - session.startTime;
  return Math.min(1, Math.max(0, elapsed / session.duration));
}

/**
 * Apply session arc to get effective min/max range
 */
function applySessionArc(arcName, min, max, sessionProgress) {
  const arcFn = SESSION_ARCS[arcName] || SESSION_ARCS.constant;
  const normalized = arcFn(sessionProgress);
  const range = max - min;
  return {
    min: min + range * normalized.min,
    max: min + range * normalized.max,
  };
}

/**
 * Get next values and advance session state
 */
export function getNextValues(settings, session) {
  const progress = getSessionProgress(session);

  // Apply session arcs to get effective ranges
  const intensityRange = applySessionArc(
    settings.intensity.metapattern,
    settings.intensity.min,
    settings.intensity.max,
    progress
  );
  const delayRange = applySessionArc(
    settings.delay.metapattern,
    settings.delay.min * 1000,
    settings.delay.max * 1000,
    progress
  );
  const rewardRange = applySessionArc(
    settings.reward.metapattern,
    settings.reward.min * 1000,
    settings.reward.max * 1000,
    progress
  );

  // Get values from micro patterns within effective ranges
  const intensity = getPatternValue(
    session.intensity.currentPattern,
    session.intensity.index,
    intensityRange.min,
    intensityRange.max
  );

  const delay = getPatternValue(
    session.delay.currentPattern,
    session.delay.index,
    delayRange.min,
    delayRange.max
  );

  const reward = getPatternValue(
    session.reward.currentPattern,
    session.reward.index,
    rewardRange.min,
    rewardRange.max
  );

  // Advance each category
  advanceCategory(session.intensity, settings.patternSwitch);
  advanceCategory(session.delay, settings.patternSwitch);
  advanceCategory(session.reward, settings.patternSwitch);
  session.step++;

  return { intensity, delay, reward, progress };
}

/**
 * Check if session duration has elapsed
 */
export function isSessionComplete(session) {
  return getSessionProgress(session) >= 1;
}

/**
 * Get pattern length for UI display
 */
export function getPatternLength(patternName) {
  if (patternName === 'random') return 1;
  return (PATTERNS[patternName] || PATTERNS.constant).length;
}

/**
 * Transform a prompt from first-person to third-person using pet name
 * "I obey" → "Puppet obeys", "Use me" → "Use Puppet"
 */
export function transformPrompt(prompt, petName) {
  let result = prompt;

  // Handle "I am" / "I'm" first (before general "I" replacement)
  result = result.replace(/^I am\b/i, `${petName} is`);
  result = result.replace(/^I'm\b/i, `${petName} is`);

  // Handle "I [verb]" at start - need to add 's' to verb for third person
  if (/^I [a-z]/i.test(result)) {
    result = result.replace(/^I ([a-z]+)/i, (match, verb) => {
      // Conjugate to third person singular
      const conjugated = conjugateVerb(verb);
      return `${petName} ${conjugated}`;
    });
  }

  // Replace "me" as object pronoun (but not in words like "some", "time")
  result = result.replace(/\bme\b/gi, petName);

  // Replace "my" with petName's
  result = result.replace(/\bmy\b/gi, `${petName}'s`);

  return result;
}

/**
 * Conjugate verb to third person singular
 */
function conjugateVerb(verb) {
  const lower = verb.toLowerCase();

  // Irregular verbs
  if (lower === 'am') return 'is';
  if (lower === 'have') return 'has';
  if (lower === 'do') return 'does';
  if (lower === 'go') return 'goes';

  // Verbs ending in consonant + y → ies
  if (/[^aeiou]y$/i.test(lower)) {
    return lower.slice(0, -1) + 'ies';
  }

  // Verbs ending in s, x, z, ch, sh → es
  if (/(?:s|x|z|ch|sh)$/i.test(lower)) {
    return lower + 'es';
  }

  // Default: add 's'
  return lower + 's';
}

/**
 * Get all valid versions of a prompt for speech matching
 */
export function getPromptVariants(prompt, petName, pronounProgression) {
  const variants = [prompt.toLowerCase()];

  if (pronounProgression && petName) {
    const transformed = transformPrompt(prompt, petName).toLowerCase();
    if (transformed !== prompt.toLowerCase()) {
      variants.push(transformed);
    }
  }

  return variants;
}

export { PATTERNS, SESSION_ARCS, DEFAULT_SETTINGS };
