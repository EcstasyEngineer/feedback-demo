/**
 * Call-and-Response Demo
 *
 * 1. Connect vibrator
 * 2. Screen shows prompt (e.g., "Say: I obey")
 * 3. User speaks → if match → vibe + reward feedback
 */

import { connect as connectVibrator } from './haptic/vibrator.js';
import { SpeechListener, fuzzyMatch, isSupported as speechSupported } from './speech/recognition.js';
import {
  loadPrompts, savePrompts, resetPrompts, generateShareUrl, isSharedConfig, DEFAULT_PROMPTS,
  loadSettings, saveSettings, resetSettings, createSession, getNextValues, isSessionComplete,
  PATTERNS, METAPATTERNS, onUrlChange
} from './config.js';

// ============================================================================
// App State
// ============================================================================
let device = null;
let listener = null;
let prompts = [];
let settings = {};
let session = null;
let currentPromptIndex = 0;
let isRunning = false;

// DOM elements
const statusEl = document.getElementById('status');
const promptEl = document.getElementById('prompt');
const feedbackEl = document.getElementById('feedback');
const connectBtn = document.getElementById('connectBtn');
const startBtn = document.getElementById('startBtn');
const testBtn = document.getElementById('testBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const promptList = document.getElementById('promptList');
const addPromptBtn = document.getElementById('addPromptBtn');
const resetPromptsBtn = document.getElementById('resetPromptsBtn');
const shareBtn = document.getElementById('shareBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const startModal = document.getElementById('startModal');
const startSessionBtn = document.getElementById('startSessionBtn');

// Session settings elements
const rewardTextInput = document.getElementById('rewardText');
const sessionDurationInput = document.getElementById('sessionDuration');
const intensityMeta = document.getElementById('intensityMeta');
const intensityPatterns = document.getElementById('intensityPatterns');
const intensityMin = document.getElementById('intensityMin');
const intensityMax = document.getElementById('intensityMax');
const delayMeta = document.getElementById('delayMeta');
const delayPatterns = document.getElementById('delayPatterns');
const delayMin = document.getElementById('delayMin');
const delayMax = document.getElementById('delayMax');
const rewardMeta = document.getElementById('rewardMeta');
const rewardPatterns = document.getElementById('rewardPatterns');
const rewardMin = document.getElementById('rewardMin');
const rewardMax = document.getElementById('rewardMax');
const switchMin = document.getElementById('switchMin');
const switchMax = document.getElementById('switchMax');

function setStatus(msg, type = 'info') {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
}

function showPrompt(text) {
  promptEl.textContent = text;
  promptEl.classList.add('visible');
  feedbackEl.classList.remove('visible');
}

function showFeedback(text, success = true) {
  feedbackEl.textContent = text;
  feedbackEl.className = `feedback visible ${success ? 'success' : 'fail'}`;
  promptEl.classList.remove('visible');
}

// ============================================================================
// Settings Panel
// ============================================================================
function renderPromptList() {
  promptList.innerHTML = '';
  prompts.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'prompt-row';
    row.innerHTML = `
      <input type="text" class="prompt-input" value="${escapeHtml(p)}" placeholder="Say..." data-index="${i}">
      <button class="delete-prompt" data-index="${i}">×</button>
    `;
    promptList.appendChild(row);
  });
}

function populatePatternCheckboxes() {
  const patternNames = [...Object.keys(PATTERNS), 'random'];
  [intensityPatterns, delayPatterns, rewardPatterns].forEach(container => {
    if (!container) return;
    container.innerHTML = patternNames.map(name =>
      `<label class="pattern-checkbox">
        <input type="checkbox" value="${name}">
        ${name.charAt(0).toUpperCase() + name.slice(1)}
      </label>`
    ).join('');
  });
}

function setPatternCheckboxes(container, selectedPatterns) {
  if (!container) return;
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    const isChecked = selectedPatterns.includes(cb.value);
    cb.checked = isChecked;
    cb.closest('.pattern-checkbox').classList.toggle('checked', isChecked);
  });
}

function renderSettings() {
  if (rewardTextInput) rewardTextInput.value = settings.rewardText;
  if (switchMin) switchMin.value = settings.patternSwitch.minInstances;
  if (switchMax) switchMax.value = settings.patternSwitch.maxInstances;
  if (intensityMeta) intensityMeta.value = settings.intensity.metapattern;
  if (intensityMin) intensityMin.value = Math.round(settings.intensity.min * 100);
  if (intensityMax) intensityMax.value = Math.round(settings.intensity.max * 100);
  setPatternCheckboxes(intensityPatterns, settings.intensity.patterns);
  if (delayMeta) delayMeta.value = settings.delay.metapattern;
  if (delayMin) delayMin.value = settings.delay.min;
  if (delayMax) delayMax.value = settings.delay.max;
  setPatternCheckboxes(delayPatterns, settings.delay.patterns);
  if (rewardMeta) rewardMeta.value = settings.reward.metapattern;
  if (rewardMin) rewardMin.value = settings.reward.min;
  if (rewardMax) rewardMax.value = settings.reward.max;
  setPatternCheckboxes(rewardPatterns, settings.reward.patterns);
}

function escapeHtml(str) {
  return str.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function handlePromptChange(e) {
  if (!e.target.classList.contains('prompt-input')) return;
  const index = parseInt(e.target.dataset.index);
  if (isNaN(index)) return;

  prompts[index] = e.target.value;
  savePrompts(prompts);
}

function handleDeletePrompt(e) {
  if (!e.target.classList.contains('delete-prompt')) return;
  const index = parseInt(e.target.dataset.index);
  if (isNaN(index)) return;

  prompts.splice(index, 1);
  if (prompts.length === 0) {
    prompts = [''];
  }
  savePrompts(prompts);
  renderPromptList();
}

function handleAddPrompt() {
  prompts.push('');
  savePrompts(prompts);
  renderPromptList();
  const inputs = promptList.querySelectorAll('.prompt-input');
  inputs[inputs.length - 1]?.focus();
}

function handleReset() {
  if (confirm('Reset all settings and prompts to defaults?')) {
    prompts = resetPrompts();
    settings = resetSettings();
    renderPromptList();
    renderSettings();
    updateFieldStates();
  }
}

function handleSelectAll(e) {
  if (!e.target.classList.contains('select-all-btn')) return;
  const targetId = e.target.dataset.target;
  const container = document.getElementById(targetId);
  if (!container) return;

  const checkboxes = container.querySelectorAll('input[type="checkbox"]');
  const allChecked = [...checkboxes].every(cb => cb.checked);

  checkboxes.forEach(cb => {
    cb.checked = !allChecked;
    cb.closest('.pattern-checkbox')?.classList.toggle('checked', !allChecked);
  });

  handleSettingsChange();
}

function getSelectedPatterns(container) {
  if (!container) return ['constant'];
  const checked = [...container.querySelectorAll('input[type="checkbox"]:checked')].map(cb => cb.value);
  return checked.length > 0 ? checked : ['constant'];
}

function isConstantOnly(patterns) {
  return patterns.length === 1 && patterns[0] === 'constant';
}

function shouldGreyOutMin(metapattern, patterns) {
  // Only grey out min when BOTH metapattern and micro pattern are constant
  // (that's the only case where min is irrelevant - value is always max)
  return metapattern === 'constant' && isConstantOnly(patterns);
}

function updateFieldStates() {
  // Grey out min fields when both metapattern and micro pattern are constant
  if (intensityMin) {
    intensityMin.disabled = shouldGreyOutMin(settings.intensity.metapattern, settings.intensity.patterns);
    intensityMin.style.opacity = intensityMin.disabled ? '0.4' : '1';
  }
  if (delayMin) {
    delayMin.disabled = shouldGreyOutMin(settings.delay.metapattern, settings.delay.patterns);
    delayMin.style.opacity = delayMin.disabled ? '0.4' : '1';
  }
  if (rewardMin) {
    rewardMin.disabled = shouldGreyOutMin(settings.reward.metapattern, settings.reward.patterns);
    rewardMin.style.opacity = rewardMin.disabled ? '0.4' : '1';
  }
}

function handleSettingsChange() {
  settings.rewardText = rewardTextInput?.value || 'Good Puppet';
  settings.patternSwitch.minInstances = Math.max(1, parseInt(switchMin?.value) || 4);
  settings.patternSwitch.maxInstances = Math.max(1, parseInt(switchMax?.value) || 12);
  settings.intensity.metapattern = intensityMeta?.value || 'constant';
  settings.intensity.patterns = getSelectedPatterns(intensityPatterns);
  settings.intensity.min = Math.max(0.01, Math.min(1, (parseInt(intensityMin?.value) || 30) / 100));
  settings.intensity.max = Math.max(0.01, Math.min(1, (parseInt(intensityMax?.value) || 100) / 100));
  settings.delay.metapattern = delayMeta?.value || 'constant';
  settings.delay.patterns = getSelectedPatterns(delayPatterns);
  settings.delay.min = Math.max(0.1, parseFloat(delayMin?.value) || 1);
  settings.delay.max = Math.max(0.1, parseFloat(delayMax?.value) || 3);
  settings.reward.metapattern = rewardMeta?.value || 'constant';
  settings.reward.patterns = getSelectedPatterns(rewardPatterns);
  settings.reward.min = Math.max(0.1, parseFloat(rewardMin?.value) || 2);
  settings.reward.max = Math.max(0.1, parseFloat(rewardMax?.value) || 4);

  // Ensure patternSwitch min <= max
  if (settings.patternSwitch.minInstances > settings.patternSwitch.maxInstances) {
    if (document.activeElement === switchMin) {
      settings.patternSwitch.maxInstances = settings.patternSwitch.minInstances;
      if (switchMax) switchMax.value = settings.patternSwitch.maxInstances;
    } else {
      settings.patternSwitch.minInstances = settings.patternSwitch.maxInstances;
      if (switchMin) switchMin.value = settings.patternSwitch.minInstances;
    }
  }

  // Ensure min <= max (push the other value when one changes)
  if (settings.intensity.min > settings.intensity.max) {
    if (document.activeElement === intensityMin || intensityMin?.disabled) {
      settings.intensity.max = settings.intensity.min;
      if (intensityMax) intensityMax.value = Math.round(settings.intensity.max * 100);
    } else {
      settings.intensity.min = settings.intensity.max;
      if (intensityMin) intensityMin.value = Math.round(settings.intensity.min * 100);
    }
  }
  if (settings.delay.min > settings.delay.max) {
    if (document.activeElement === delayMin || delayMin?.disabled) {
      settings.delay.max = settings.delay.min;
      if (delayMax) delayMax.value = settings.delay.max;
    } else {
      settings.delay.min = settings.delay.max;
      if (delayMin) delayMin.value = settings.delay.min;
    }
  }
  if (settings.reward.min > settings.reward.max) {
    if (document.activeElement === rewardMin || rewardMin?.disabled) {
      settings.reward.max = settings.reward.min;
      if (rewardMax) rewardMax.value = settings.reward.max;
    } else {
      settings.reward.min = settings.reward.max;
      if (rewardMin) rewardMin.value = settings.reward.min;
    }
  }

  saveSettings(settings);
  updateFieldStates();
}

function handleShare() {
  const url = generateShareUrl(prompts, settings);
  navigator.clipboard.writeText(url).then(() => {
    setStatus('Share link copied!', 'success');
    setTimeout(() => setStatus('Ready', 'info'), 2000);
  }).catch(() => {
    prompt('Copy this link:', url);
  });
}

function openSettings() {
  populatePatternCheckboxes();
  renderPromptList();
  renderSettings();
  updateFieldStates();
  settingsPanel.classList.add('visible');
}

function closeSettings() {
  prompts = prompts.filter(p => p.trim());
  if (prompts.length === 0) {
    prompts = [...DEFAULT_PROMPTS];
  }
  savePrompts(prompts);
  handleSettingsChange();
  settingsPanel.classList.remove('visible');
}

// ============================================================================
// Device & Speech
// ============================================================================
async function handleConnect() {
  try {
    setStatus('Connecting...', 'info');
    device = await connectVibrator();
    setStatus(`Connected: ${device.name}`, 'success');
    connectBtn.textContent = `✓ ${device.name}`;
    connectBtn.disabled = true;
    startBtn.disabled = false;
    testBtn.disabled = false;
  } catch (e) {
    setStatus(`Connection failed: ${e.message}`, 'error');
    console.error(e);
  }
}

async function handleTest() {
  if (!device) return;
  try {
    const intensity = settings.intensity.min;
    setStatus(`Testing vibe at ${Math.round(intensity * 100)}%...`, 'info');
    await device.send(intensity);
    setStatus('Vibe ON', 'success');
    await new Promise(r => setTimeout(r, 2000));
    await device.send(0);
    setStatus('Vibe OFF', 'info');
  } catch (e) {
    setStatus(`Test failed: ${e.message}`, 'error');
    console.error(e);
  }
}

async function runSequence() {
  if (!device) {
    setStatus('Connect a device first', 'error');
    return;
  }

  if (!speechSupported()) {
    setStatus('Speech recognition not supported', 'error');
    return;
  }

  const validPrompts = prompts.filter(p => p.trim());
  if (validPrompts.length === 0) {
    setStatus('No prompts configured', 'error');
    return;
  }

  isRunning = true;
  session = createSession(settings);
  startBtn.textContent = 'Stop';

  try {
    while (isRunning) {
      // Check if session duration has elapsed
      if (isSessionComplete(session)) {
        setStatus('Session complete!', 'success');
        showFeedback('Session Complete', true);
        break;
      }

      const promptText = validPrompts[currentPromptIndex];
      listener = new SpeechListener();

      showPrompt(`Say: ${promptText}`);
      setStatus('Listening...', 'info');

      const transcript = await listener.listen();
      if (!isRunning) break;

      console.log('Heard:', transcript);
      const result = fuzzyMatch(transcript, promptText);
      console.log('Match result:', result);

      if (result.match) {
        const { intensity, delay, reward, progress } = getNextValues(settings, session);

        showFeedback(settings.rewardText, true);
        const progressPct = Math.round(progress * 100);
        setStatus(`${progressPct}% | ${Math.round(intensity * 100)}% for ${(reward / 1000).toFixed(1)}s`, 'success');
        console.log(`Progress: ${progressPct}%, Intensity: ${Math.round(intensity * 100)}%, Reward: ${reward}ms, Next delay: ${delay}ms`);

        await device.activate(intensity);
        await new Promise(r => setTimeout(r, reward));
        await device.stop();

        currentPromptIndex = (currentPromptIndex + 1) % validPrompts.length;

        if (!isRunning) break;
        await new Promise(r => setTimeout(r, delay));
      } else {
        showFeedback('Try again', false);
        setStatus(`No match: "${transcript}"`, 'error');
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  } catch (e) {
    if (isRunning) {
      setStatus(`Error: ${e.message}`, 'error');
      console.error(e);
    }
  } finally {
    isRunning = false;
    session = null;
    document.body.classList.remove('session-active');
    startBtn.textContent = 'Start';
    promptEl.classList.remove('visible');
    feedbackEl.classList.remove('visible');
  }
}

function stopSequence() {
  isRunning = false;
  if (listener) {
    listener.cancel();
  }
  device?.stop();
  document.body.classList.remove('session-active');
  startBtn.textContent = 'Start';
  promptEl.classList.remove('visible');
  feedbackEl.classList.remove('visible');
  setStatus('Stopped', 'info');
}

async function showStartModal() {
  // Pre-init speech recognition to get mic permission early
  if (speechSupported()) {
    try {
      const testListener = new SpeechListener();
      await testListener.listen().catch(() => {});
      testListener.cancel();
    } catch (e) { /* ignore */ }
  }
  sessionDurationInput.value = Math.round(settings.sessionDuration / 60);
  startModal.classList.add('visible');
  sessionDurationInput.focus();
  sessionDurationInput.select();
}

function hideStartModal() {
  startModal.classList.remove('visible');
}

function beginSession() {
  settings.sessionDuration = Math.max(60, (parseInt(sessionDurationInput?.value) || 10) * 60);
  saveSettings(settings);
  hideStartModal();
  document.body.classList.add('session-active');
  runSequence();
}

function handleStartStop() {
  if (isRunning) {
    stopSequence();
  } else {
    showStartModal();
  }
}

// ============================================================================
// Init
// ============================================================================
prompts = loadPrompts();
settings = loadSettings();

if (isSharedConfig()) {
  setStatus('Loaded shared config - customize in settings', 'success');
}

// Event listeners
connectBtn?.addEventListener('click', handleConnect);
startBtn?.addEventListener('click', handleStartStop);
testBtn?.addEventListener('click', handleTest);
settingsBtn?.addEventListener('click', openSettings);
closeSettingsBtn?.addEventListener('click', closeSettings);
settingsPanel?.addEventListener('click', (e) => {
  // Close if clicking the backdrop (not the content)
  if (e.target === settingsPanel) closeSettings();
});
startModal?.addEventListener('click', (e) => {
  // Close if clicking the backdrop (not the content)
  if (e.target === startModal) hideStartModal();
});
startSessionBtn?.addEventListener('click', beginSession);
sessionDurationInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') beginSession();
  if (e.key === 'Escape') hideStartModal();
});
addPromptBtn?.addEventListener('click', handleAddPrompt);
resetPromptsBtn?.addEventListener('click', handleReset);
shareBtn?.addEventListener('click', handleShare);
settingsPanel?.addEventListener('click', handleSelectAll);
promptList?.addEventListener('input', handlePromptChange);
promptList?.addEventListener('click', handleDeletePrompt);

// Settings change listeners - use blur for text/number inputs, change for selects/checkboxes
[intensityPatterns, delayPatterns, rewardPatterns].forEach(container => {
  container?.addEventListener('change', (e) => {
    if (e.target.type === 'checkbox') {
      e.target.closest('.pattern-checkbox')?.classList.toggle('checked', e.target.checked);
      handleSettingsChange();
    }
  });
});
[intensityMeta, delayMeta, rewardMeta].forEach(el => {
  el?.addEventListener('change', handleSettingsChange);
});
[rewardTextInput, switchMin, switchMax, intensityMin, intensityMax, delayMin, delayMax, rewardMin, rewardMax].forEach(el => {
  el?.addEventListener('blur', handleSettingsChange);
});

// Handle URL changes (for shared links pasted into already-open page)
onUrlChange(() => {
  prompts = loadPrompts();
  settings = loadSettings();
  if (isSharedConfig()) {
    setStatus('Loaded shared config!', 'success');
  }
});

// Init status
if (!speechSupported()) {
  setStatus('Speech recognition not supported in this browser', 'error');
} else if (!isSharedConfig()) {
  setStatus('Ready - connect a device to start', 'info');
}
