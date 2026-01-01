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
  'I obey',
  'Yes Master',
  'Thank you',
  'I submit',
  'Please',
  'I need it',
  'I belong to you',
  'Use me',
  'I am yours',
  'More please',
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

// Metapattern functions - scale effective max based on session progress
const METAPATTERNS = {
  constant: t => 1,           // full range always
  climb: t => t,              // range opens up over session
  descent: t => 1 - t,        // range closes down over session
};

const DEFAULT_SETTINGS = {
  rewardText: 'Good Puppet',
  sessionDuration: 10 * 60,   // 10 minutes in seconds
  intensity: {
    metapattern: 'constant',  // session-level pattern
    patterns: ['climb', 'surge', 'wave'],  // micro patterns
    min: 0.1,   // 10%
    max: 0.7,   // 70%
  },
  delay: {
    metapattern: 'climb',     // starts quick, slows down over session
    patterns: ['constant'],   // predictable within the moment
    min: 4.0,   // seconds - anticipation builds
    max: 12.0,  // long enough to crave the next one
  },
  reward: {
    metapattern: 'constant',  // full range always
    patterns: ['climb', 'surge', 'wave'],  // unpredictable
    min: 0.5,   // seconds - quick hit
    max: 1.2,   // brief burst of pleasure
  },
  patternSwitch: {
    minInstances: 4,
    maxInstances: 12,
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
 * Apply metapattern to scale effective max
 */
function applyMetapattern(metapatternName, min, max, sessionProgress) {
  const metaFn = METAPATTERNS[metapatternName] || METAPATTERNS.constant;
  const scale = metaFn(sessionProgress);
  const effectiveMax = min + (max - min) * scale;
  return { min, max: effectiveMax };
}

/**
 * Get next values and advance session state
 */
export function getNextValues(settings, session) {
  const progress = getSessionProgress(session);

  // Apply metapatterns to get effective ranges
  const intensityRange = applyMetapattern(
    settings.intensity.metapattern,
    settings.intensity.min,
    settings.intensity.max,
    progress
  );
  const delayRange = applyMetapattern(
    settings.delay.metapattern,
    settings.delay.min * 1000,
    settings.delay.max * 1000,
    progress
  );
  const rewardRange = applyMetapattern(
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

export { PATTERNS, METAPATTERNS, DEFAULT_SETTINGS };
