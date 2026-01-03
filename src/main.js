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
  PATTERNS, SESSION_ARCS, onUrlChange, transformPrompt, getPromptVariants,
  exportConfig, importConfig
} from './config.js';

// ============================================================================
// App State
// ============================================================================
let device = null;
let micConnected = false;
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
const connectMicBtn = document.getElementById('connectMicBtn');
const startBtn = document.getElementById('startBtn');
const testBtn = document.getElementById('testBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsPanel = document.getElementById('settingsPanel');
const promptList = document.getElementById('promptList');
const addPromptBtn = document.getElementById('addPromptBtn');
const resetPromptsBtn = document.getElementById('resetPromptsBtn');
const shareBtn = document.getElementById('shareBtn');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
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
const settingsDuration = document.getElementById('settingsDuration');
const petNameInput = document.getElementById('petName');
const pronounProgressionInput = document.getElementById('pronounProgression');
const clickerEnabledInput = document.getElementById('clickerEnabled');
const randomizePromptsInput = document.getElementById('randomizePrompts');

// Clicker audio - works in Vite build (inlined) and raw serving (relative path)
let clickerAudio = null;
try {
  // Try dynamic import first (Vite build inlines as base64)
  const audioModule = await import('./assets/clicker.opus');
  clickerAudio = new Audio(audioModule.default);
} catch {
  // Fall back to relative path (GitHub Pages raw serving)
  clickerAudio = new Audio('./src/assets/clicker.opus');
}
clickerAudio.preload = 'auto';
function playClick() {
  if (!clickerAudio) return;
  clickerAudio.currentTime = 0;
  clickerAudio.play().catch(() => {});
}

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
function updatePromptsSummary() {
  const summary = document.getElementById('promptsSummary');
  if (summary) {
    const count = prompts.filter(p => p.trim()).length;
    summary.textContent = `${count} item${count !== 1 ? 's' : ''}`;
  }
}

function renderPromptList() {
  promptList.innerHTML = '';
  const showPreview = settings.pronounProgression && settings.petName;

  prompts.forEach((p, i) => {
    const container = document.createElement('div');
    container.style.marginBottom = '4px';

    const row = document.createElement('div');
    row.className = 'prompt-row';
    row.innerHTML = `
      <input type="text" class="prompt-input" value="${escapeHtml(p)}" placeholder="Say..." data-index="${i}">
      <button class="delete-prompt" data-index="${i}">×</button>
    `;
    container.appendChild(row);

    // Add preview of transformed version
    const preview = document.createElement('div');
    preview.className = 'prompt-preview' + (showPreview ? ' visible' : '');
    const transformed = transformPrompt(p, settings.petName || 'Puppet');
    if (transformed !== p) {
      preview.innerHTML = `→ <span>${escapeHtml(transformed)}</span>`;
    }
    container.appendChild(preview);

    promptList.appendChild(container);
  });

  updatePromptsSummary();
}

function updatePromptPreviews() {
  const showPreview = settings.pronounProgression && settings.petName;
  const previews = promptList.querySelectorAll('.prompt-preview');
  const inputs = promptList.querySelectorAll('.prompt-input');

  inputs.forEach((input, i) => {
    const preview = previews[i];
    if (!preview) return;

    const transformed = transformPrompt(input.value, settings.petName || 'Puppet');
    if (transformed !== input.value) {
      preview.innerHTML = `→ <span>${escapeHtml(transformed)}</span>`;
      preview.classList.toggle('visible', showPreview);
    } else {
      preview.classList.remove('visible');
    }
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
  if (petNameInput) petNameInput.value = settings.petName || 'Puppet';
  if (pronounProgressionInput) pronounProgressionInput.checked = settings.pronounProgression !== false;
  if (clickerEnabledInput) clickerEnabledInput.checked = settings.clickerEnabled !== false;
  if (randomizePromptsInput) randomizePromptsInput.checked = settings.randomizePrompts === true;
  if (settingsDuration) settingsDuration.value = Math.round(settings.sessionDuration / 60);
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

  // Update preview for this prompt
  const container = e.target.closest('div').parentElement;
  const preview = container?.querySelector('.prompt-preview');
  if (preview && settings.pronounProgression && settings.petName) {
    const transformed = transformPrompt(e.target.value, settings.petName);
    if (transformed !== e.target.value) {
      preview.innerHTML = `→ <span>${escapeHtml(transformed)}</span>`;
      preview.classList.add('visible');
    } else {
      preview.classList.remove('visible');
    }
  }
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
  settings.petName = petNameInput?.value || 'Puppet';
  settings.pronounProgression = pronounProgressionInput?.checked ?? true;
  settings.clickerEnabled = clickerEnabledInput?.checked ?? true;
  settings.randomizePrompts = randomizePromptsInput?.checked ?? false;
  settings.sessionDuration = Math.max(60, (parseInt(settingsDuration?.value) || 10) * 60);
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
  updatePromptPreviews();
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

function handleExport() {
  const blob = exportConfig(prompts, settings);
  navigator.clipboard.writeText(blob).then(() => {
    setStatus('Config copied to clipboard!', 'success');
    setTimeout(() => setStatus('Ready', 'info'), 2000);
  }).catch(() => {
    prompt('Copy this config:', blob);
  });
}

function handleImport() {
  const blob = prompt('Paste config blob:');
  if (!blob) return;

  const config = importConfig(blob);
  if (!config) {
    setStatus('Invalid config blob', 'error');
    setTimeout(() => setStatus('Ready', 'info'), 2000);
    return;
  }

  // Apply imported config
  prompts = config.prompts;
  savePrompts(prompts);

  if (config.settings) {
    settings = { ...settings, ...config.settings };
    saveSettings(settings);
  }

  // Re-render UI
  renderPromptList();
  renderSettings();
  updateFieldStates();

  setStatus('Config imported!', 'success');
  setTimeout(() => setStatus('Ready', 'info'), 2000);
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
async function handleConnectMic() {
  if (micConnected) return;

  if (!speechSupported()) {
    setStatus('Speech recognition not supported in this browser', 'error');
    return;
  }

  try {
    setStatus('Requesting microphone...', 'info');

    // Request mic permission via getUserMedia (more reliable than SpeechRecognition)
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());  // Release immediately

    micConnected = true;
    connectMicBtn.textContent = '✓ Mic';
    connectMicBtn.disabled = true;
    setStatus('Microphone connected', 'success');
  } catch (e) {
    setStatus(`Microphone access denied: ${e.message}`, 'error');
    console.error(e);
  }
}

async function handleConnect() {
  try {
    setStatus('Connecting...', 'info');
    device = await connectVibrator();
    setStatus(`Connected: ${device.name}`, 'success');
    connectBtn.textContent = `✓ ${device.name}`;
    connectBtn.disabled = true;
    testBtn.disabled = false;
  } catch (e) {
    setStatus(`Connection failed: ${e.message}`, 'error');
    console.error(e);
  }
}

async function handleTest() {
  if (!device) return;
  try {
    const intensity = 0.10;  // Fixed 10% for safety testing
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
  // Mic connected = call-and-response mode, otherwise loading mode
  const promptMode = micConnected;

  if (promptMode) {
    const validPrompts = prompts.filter(p => p.trim());
    if (validPrompts.length === 0) {
      setStatus('No prompts configured', 'error');
      return;
    }

    // Create listener once before the loop to avoid repeated permission prompts
    listener = new SpeechListener();
  }

  isRunning = true;
  session = createSession(settings);
  document.body.classList.add('session-active');
  startBtn.textContent = 'Stop';

  // Prepare prompts for this session (optionally randomized)
  let sessionPrompts = prompts.filter(p => p.trim());
  if (settings.randomizePrompts && sessionPrompts.length > 1) {
    // Fisher-Yates shuffle
    for (let i = sessionPrompts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sessionPrompts[i], sessionPrompts[j]] = [sessionPrompts[j], sessionPrompts[i]];
    }
  }

  try {
    while (isRunning) {
      // Check if session duration has elapsed
      if (isSessionComplete(session)) {
        setStatus('Session complete!', 'success');
        showFeedback('Session Complete', true);
        break;
      }

      if (promptMode) {
        // Call-and-response mode with speech recognition
        const basePrompt = sessionPrompts[currentPromptIndex % sessionPrompts.length];

        // Get current progress for display (without advancing state)
        const currentProgress = (Date.now() - session.startTime) / session.duration;
        let displayPrompt = basePrompt;

        if (settings.pronounProgression && settings.petName) {
          // Blend probability: 0% at progress<0.4, then linear to 100% at progress=1
          const blendChance = currentProgress < 0.4 ? 0 : (currentProgress - 0.4) / 0.6;
          if (Math.random() < blendChance) {
            displayPrompt = transformPrompt(basePrompt, settings.petName);
          }
        }

        showPrompt(`Say: ${displayPrompt}`);
        setStatus('Listening...', 'info');

        const transcript = await listener.listen();
        if (!isRunning) break;

        console.log('Heard:', transcript);

        // Accept both original and transformed versions
        const variants = getPromptVariants(basePrompt, settings.petName, settings.pronounProgression);
        let result = { match: false };
        for (const variant of variants) {
          result = fuzzyMatch(transcript, variant);
          if (result.match) break;
        }
        console.log('Match result:', result, 'against variants:', variants);

        if (result.match) {
          const { intensity, delay, reward, progress } = getNextValues(settings, session);

          // Click first, then vibe (forward conditioning)
          if (settings.clickerEnabled) {
            playClick();
            await new Promise(r => setTimeout(r, 200 + Math.random() * 300));  // 200-500ms before vibe
          }

          showFeedback(settings.rewardText, true);
          const progressPct = Math.round(progress * 100);
          setStatus(`${progressPct}% | ${Math.round(intensity * 100)}% for ${(reward / 1000).toFixed(1)}s`, 'success');
          console.log(`Progress: ${progressPct}%, Intensity: ${Math.round(intensity * 100)}%, Reward: ${reward}ms, Next delay: ${delay}ms`);

          if (device) {
            await device.activate(intensity);
            await new Promise(r => setTimeout(r, reward));
            await device.stop();
            await new Promise(r => setTimeout(r, 50));  // Let device settle after stop
          } else {
            await new Promise(r => setTimeout(r, reward));  // still wait reward duration
          }

          currentPromptIndex = (currentPromptIndex + 1) % sessionPrompts.length;

          // Delay starts AFTER reward/stim finishes
          if (!isRunning) break;
          await new Promise(r => setTimeout(r, delay));
        } else {
          showFeedback('Try again', false);
          setStatus(`No match: "${transcript}"`, 'error');
          await new Promise(r => setTimeout(r, 1500));
        }
      } else {
        // Loading/pairing mode - auto clicker+vibe on timer, no speech
        const { intensity, delay, reward, progress } = getNextValues(settings, session);

        promptEl.classList.remove('visible');
        feedbackEl.classList.remove('visible');

        // Click first, then vibe (forward conditioning)
        if (settings.clickerEnabled) {
          playClick();
          await new Promise(r => setTimeout(r, 200 + Math.random() * 300));  // 200-500ms before vibe
        }

        const progressPct = Math.round(progress * 100);
        setStatus(`Loading ${progressPct}% | ${Math.round(intensity * 100)}% for ${(reward / 1000).toFixed(1)}s`, 'success');
        console.log(`Loading mode - Progress: ${progressPct}%, Intensity: ${Math.round(intensity * 100)}%, Reward: ${reward}ms, Next delay: ${delay}ms`);

        if (device) {
          await device.activate(intensity);
          await new Promise(r => setTimeout(r, reward));
          await device.stop();
          await new Promise(r => setTimeout(r, 50));  // Let device settle after stop
        } else {
          await new Promise(r => setTimeout(r, reward));  // still wait reward duration
        }

        // Delay starts AFTER reward/stim finishes
        if (!isRunning) break;
        await new Promise(r => setTimeout(r, delay));
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
    if (listener) {
      listener.stop();  // Fully stop recognition
    }
    document.body.classList.remove('session-active');
    startBtn.textContent = 'Start';
    promptEl.classList.remove('visible');
    feedbackEl.classList.remove('visible');
  }
}

function stopSequence() {
  isRunning = false;
  if (listener) {
    listener.stop();  // Fully stop recognition (not just cancel)
  }
  device?.stop();
  document.body.classList.remove('session-active');
  startBtn.textContent = 'Start';
  promptEl.classList.remove('visible');
  feedbackEl.classList.remove('visible');
  setStatus('Stopped', 'info');
}

function showStartModal() {
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
  runSequence();  // session-active class is added inside runSequence after validation
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
connectMicBtn?.addEventListener('click', handleConnectMic);
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
exportBtn?.addEventListener('click', handleExport);
importBtn?.addEventListener('click', handleImport);
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
[rewardTextInput, petNameInput, settingsDuration, switchMin, switchMax, intensityMin, intensityMax, delayMin, delayMax, rewardMin, rewardMax].forEach(el => {
  el?.addEventListener('blur', handleSettingsChange);
});
pronounProgressionInput?.addEventListener('change', handleSettingsChange);
clickerEnabledInput?.addEventListener('change', handleSettingsChange);
randomizePromptsInput?.addEventListener('change', handleSettingsChange);

// Collapsible sections
document.querySelectorAll('.collapsible-header').forEach(header => {
  header.addEventListener('click', () => {
    header.closest('.collapsible-section').classList.toggle('open');
  });
});

// Update summaries when settings change
function updateCollapsibleSummaries() {
  const intensitySummary = document.getElementById('intensitySummary');
  const rewardSummary = document.getElementById('rewardSummary');
  const delaySummary = document.getElementById('delaySummary');

  if (intensitySummary) {
    intensitySummary.textContent = `${intensityMin?.value || 10}-${intensityMax?.value || 70}%`;
  }
  if (rewardSummary) {
    rewardSummary.textContent = `${rewardMin?.value || 0.5}-${rewardMax?.value || 1.2}s`;
  }
  if (delaySummary) {
    delaySummary.textContent = `${delayMin?.value || 4}-${delayMax?.value || 12}s`;
  }
}

// Update summaries on input change
[intensityMin, intensityMax, rewardMin, rewardMax, delayMin, delayMax].forEach(el => {
  el?.addEventListener('input', updateCollapsibleSummaries);
});
updateCollapsibleSummaries();

// Handle URL changes (for shared links pasted into already-open page)
onUrlChange(() => {
  prompts = loadPrompts();
  settings = loadSettings();
  if (isSharedConfig()) {
    setStatus('Loaded shared config!', 'success');
  }
});

// ============================================================================
// Visualization
// ============================================================================
const vizModal = document.getElementById('vizModal');
const vizCanvas = document.getElementById('vizCanvas');
const vizRegenerate = document.getElementById('vizRegenerate');
const vizClose = document.getElementById('vizClose');
const vizStats = document.getElementById('vizStats');
const visualizeBtn = document.getElementById('visualizeBtn');

function simulateSession() {
  // Create a fresh session using current settings
  const simSession = createSession(settings);
  const durationMs = settings.sessionDuration * 1000;
  const avgDelayMs = (settings.delay.min + settings.delay.max) / 2 * 1000;
  const estimatedPrompts = Math.ceil(durationMs / avgDelayMs) + 10; // +buffer

  const dataPoints = [];
  let simulatedTime = 0;

  // Track pattern switches
  let lastIntensityPattern = simSession.intensity.currentPattern;
  let lastDelayPattern = simSession.delay.currentPattern;
  let lastRewardPattern = simSession.reward.currentPattern;

  for (let i = 0; i < estimatedPrompts && simulatedTime < durationMs; i++) {
    // Override session start time to simulate progress
    simSession.startTime = Date.now() - simulatedTime;
    const progress = simulatedTime / durationMs;

    // Calculate session arc bounds for this point in time
    const intensityArc = SESSION_ARCS[settings.intensity.metapattern]?.(progress) || { min: 0, max: 1 };
    const delayArc = SESSION_ARCS[settings.delay.metapattern]?.(progress) || { min: 0, max: 1 };
    const rewardArc = SESSION_ARCS[settings.reward.metapattern]?.(progress) || { min: 0, max: 1 };

    // Detect pattern switches
    const patternSwitches = [];
    if (simSession.intensity.currentPattern !== lastIntensityPattern) {
      patternSwitches.push('intensity');
      lastIntensityPattern = simSession.intensity.currentPattern;
    }
    if (simSession.delay.currentPattern !== lastDelayPattern) {
      patternSwitches.push('delay');
      lastDelayPattern = simSession.delay.currentPattern;
    }
    if (simSession.reward.currentPattern !== lastRewardPattern) {
      patternSwitches.push('reward');
      lastRewardPattern = simSession.reward.currentPattern;
    }

    const values = getNextValues(settings, simSession);

    dataPoints.push({
      time: simulatedTime,
      progress,
      intensity: values.intensity,
      delay: values.delay,
      reward: values.reward,
      // Arc bounds (normalized 0-1 within configured min/max)
      intensityArcMin: settings.intensity.min + (settings.intensity.max - settings.intensity.min) * intensityArc.min,
      intensityArcMax: settings.intensity.min + (settings.intensity.max - settings.intensity.min) * intensityArc.max,
      delayArcMin: settings.delay.min + (settings.delay.max - settings.delay.min) * delayArc.min,
      delayArcMax: settings.delay.min + (settings.delay.max - settings.delay.min) * delayArc.max,
      rewardArcMin: settings.reward.min + (settings.reward.max - settings.reward.min) * rewardArc.min,
      rewardArcMax: settings.reward.min + (settings.reward.max - settings.reward.min) * rewardArc.max,
      patternSwitches,
    });

    simulatedTime += values.delay;
  }

  // Debug: log time gaps to verify spacing
  console.log('Session simulation:', {
    duration: `${settings.sessionDuration / 60}min`,
    delaySettings: `${settings.delay.min}-${settings.delay.max}s, arc=${settings.delay.metapattern}`,
    totalPrompts: dataPoints.length,
    first5times: dataPoints.slice(0, 5).map(d => (d.time / 1000).toFixed(1)),
    last5times: dataPoints.slice(-5).map(d => (d.time / 1000).toFixed(1)),
    first5delays: dataPoints.slice(0, 5).map(d => (d.delay / 1000).toFixed(1)),
    last5delays: dataPoints.slice(-5).map(d => (d.delay / 1000).toFixed(1)),
  });

  return dataPoints;
}

function drawVisualization(dataPoints) {
  const ctx = vizCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // Set canvas resolution
  const rect = vizCanvas.getBoundingClientRect();
  vizCanvas.width = rect.width * dpr;
  vizCanvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  // Clear
  ctx.fillStyle = '#0a0a12';
  ctx.fillRect(0, 0, width, height);

  if (dataPoints.length === 0) return;

  const durationMs = settings.sessionDuration * 1000;

  // Three stacked sub-graphs
  const graphs = [
    {
      label: 'Intensity',
      color: '#00ff88',
      colorFaded: 'rgba(0, 255, 136, 0.15)',
      getValue: d => d.intensity,
      getArcMin: d => d.intensityArcMin,
      getArcMax: d => d.intensityArcMax,
      min: settings.intensity.min,
      max: settings.intensity.max,
      configMin: settings.intensity.min,
      configMax: settings.intensity.max,
      unit: '%',
      formatVal: v => Math.round(v * 100),
      metapattern: settings.intensity.metapattern,
    },
    {
      label: 'Delay',
      color: '#00d4ff',
      colorFaded: 'rgba(0, 212, 255, 0.15)',
      getValue: d => d.delay / 1000,
      getArcMin: d => d.delayArcMin,
      getArcMax: d => d.delayArcMax,
      min: settings.delay.min,
      max: settings.delay.max,
      configMin: settings.delay.min,
      configMax: settings.delay.max,
      unit: 's',
      formatVal: v => v.toFixed(1),
      metapattern: settings.delay.metapattern,
    },
    {
      label: 'Reward',
      color: '#ff6b6b',
      colorFaded: 'rgba(255, 107, 107, 0.15)',
      getValue: d => d.reward / 1000,
      getArcMin: d => d.rewardArcMin,
      getArcMax: d => d.rewardArcMax,
      min: settings.reward.min,
      max: settings.reward.max,
      configMin: settings.reward.min,
      configMax: settings.reward.max,
      unit: 's',
      formatVal: v => v.toFixed(1),
      metapattern: settings.reward.metapattern,
    },
  ];

  const padding = { top: 8, right: 16, bottom: 28, left: 55 };
  const graphGap = 12;
  const graphHeight = (height - padding.top - padding.bottom - graphGap * 2) / 3;
  const plotWidth = width - padding.left - padding.right;

  // Draw each sub-graph
  graphs.forEach((graph, graphIndex) => {
    const graphTop = padding.top + graphIndex * (graphHeight + graphGap);
    const graphBottom = graphTop + graphHeight;

    // Background
    ctx.fillStyle = '#0d0d18';
    ctx.fillRect(padding.left, graphTop, plotWidth, graphHeight);

    // Helper to convert value to Y coordinate
    const valueToY = (val) => {
      const normalized = (val - graph.min) / (graph.max - graph.min);
      return graphBottom - normalized * graphHeight;
    };

    // Helper to convert time to X coordinate
    const timeToX = (time) => padding.left + (time / durationMs) * plotWidth;

    // Draw session arc envelope (shaded region)
    ctx.fillStyle = graph.colorFaded;
    ctx.beginPath();
    // Top edge (max values)
    dataPoints.forEach((d, i) => {
      const x = timeToX(d.time);
      const y = valueToY(graph.getArcMax(d));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    // Bottom edge (min values) - reverse order
    for (let i = dataPoints.length - 1; i >= 0; i--) {
      const d = dataPoints[i];
      const x = timeToX(d.time);
      const y = valueToY(graph.getArcMin(d));
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Draw envelope border lines
    ctx.strokeStyle = graph.color;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Max line
    ctx.beginPath();
    dataPoints.forEach((d, i) => {
      const x = timeToX(d.time);
      const y = valueToY(graph.getArcMax(d));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Min line
    ctx.beginPath();
    dataPoints.forEach((d, i) => {
      const x = timeToX(d.time);
      const y = valueToY(graph.getArcMin(d));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // Draw pattern switch indicators
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    const switchKey = graph.label.toLowerCase();
    dataPoints.forEach(d => {
      if (d.patternSwitches.includes(switchKey)) {
        const x = timeToX(d.time);
        ctx.beginPath();
        ctx.moveTo(x, graphTop);
        ctx.lineTo(x, graphBottom);
        ctx.stroke();
      }
    });

    // Draw grid lines
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = graphTop + (graphHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
    }

    // Draw actual values line
    ctx.strokeStyle = graph.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    dataPoints.forEach((d, i) => {
      const x = timeToX(d.time);
      const y = valueToY(graph.getValue(d));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Draw dots
    ctx.fillStyle = graph.color;
    dataPoints.forEach(d => {
      const x = timeToX(d.time);
      const y = valueToY(graph.getValue(d));
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Y-axis labels
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    // Min and max labels
    ctx.fillText(`${graph.formatVal(graph.max)}${graph.unit}`, padding.left - 6, graphTop + 4);
    ctx.fillText(`${graph.formatVal(graph.min)}${graph.unit}`, padding.left - 6, graphBottom - 4);

    // Graph label
    ctx.fillStyle = graph.color;
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(`${graph.label}`, padding.left + 6, graphTop + 4);

    // Arc label
    ctx.fillStyle = '#555';
    ctx.font = '9px system-ui';
    const arcLabel = graph.metapattern.replace(/_/g, ' ');
    ctx.fillText(`(${arcLabel})`, padding.left + 6 + ctx.measureText(graph.label).width + 6, graphTop + 5);
  });

  // X-axis labels (only once at bottom)
  ctx.fillStyle = '#888';
  ctx.font = '11px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const durationMin = settings.sessionDuration / 60;
  for (let i = 0; i <= 4; i++) {
    const x = padding.left + (plotWidth / 4) * i;
    const mins = (durationMin / 4) * i;
    ctx.fillText(`${mins.toFixed(1)}m`, x, height - padding.bottom + 10);
  }

  // Stats
  const avgIntensity = dataPoints.reduce((s, d) => s + d.intensity, 0) / dataPoints.length;
  const avgDelay = dataPoints.reduce((s, d) => s + d.delay, 0) / dataPoints.length / 1000;
  const avgReward = dataPoints.reduce((s, d) => s + d.reward, 0) / dataPoints.length / 1000;

  vizStats.innerHTML = `<strong>${dataPoints.length} prompts</strong> over ${durationMin.toFixed(0)} min &nbsp;|&nbsp; ` +
    `<span style="color:#00ff88">Avg intensity: ${Math.round(avgIntensity * 100)}%</span> &nbsp;|&nbsp; ` +
    `<span style="color:#00d4ff">Avg delay: ${avgDelay.toFixed(1)}s</span> &nbsp;|&nbsp; ` +
    `<span style="color:#ff6b6b">Avg reward: ${avgReward.toFixed(2)}s</span>`;
}

function showVisualization() {
  // Make sure settings are up to date
  handleSettingsChange();
  vizModal.classList.add('visible');
  regenerateVisualization();
}

function regenerateVisualization() {
  const dataPoints = simulateSession();
  drawVisualization(dataPoints);
}

function hideVisualization() {
  vizModal.classList.remove('visible');
}

visualizeBtn?.addEventListener('click', showVisualization);
vizRegenerate?.addEventListener('click', regenerateVisualization);
vizClose?.addEventListener('click', hideVisualization);
vizModal?.addEventListener('click', (e) => {
  if (e.target === vizModal) hideVisualization();
});

// Init status
if (!isSharedConfig()) {
  setStatus('Ready', 'info');
}
