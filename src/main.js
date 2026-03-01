import { $, $$, showStatus, hideStatus, showToast } from './utils.js';
import { STORAGE_KEY, state } from './state.js';
import { initDebugPanel, debugStartGroup, debugEndGroup, debugLog } from './debug.js';
import { initPromptLibrary } from './prompt-library.js';
import { initGallery, loadHistoryGallery, populateFilterOptions, applyGalleryFilters, addToGallery, processResult, downloadImage } from './gallery.js';
import { initQueue, getCurrentJob } from './queue.js';
import { runGeneration } from './api.js';

// --- Settings ---

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (saved.apiBase) $('#apiBase').value = saved.apiBase;
    if (saved.apiKey) $('#apiKey').value = saved.apiKey;
    if (saved.model) {
      const modelSelect = $('#model');
      const validModel = Array.from(modelSelect.options).some(o => o.value === saved.model);
      if (validModel) modelSelect.value = saved.model;
    }
    if (saved.aspectRatio) $('#aspectRatio').value = saved.aspectRatio;
    if (saved.quality) $('#quality').value = saved.quality;
    if (saved.thinkingLevel) $('#thinkingLevel').value = saved.thinkingLevel;
    if (saved.enhanceModel) $('#enhanceModel').value = saved.enhanceModel;
    if (saved.enhanceEnabled !== undefined) $('#enhanceToggle').checked = saved.enhanceEnabled;
  } catch (_) {}
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      apiBase: $('#apiBase').value,
      apiKey: $('#apiKey').value,
      model: $('#model').value,
      aspectRatio: $('#aspectRatio').value,
      quality: $('#quality').value,
      thinkingLevel: $('#thinkingLevel').value,
      enhanceModel: $('#enhanceModel').value,
      enhanceEnabled: $('#enhanceToggle').checked
    }));
    const indicator = $('#saveIndicator');
    indicator.classList.add('visible');
    setTimeout(() => indicator.classList.remove('visible'), 1500);
  } catch (_) {}
}

// --- Dropzone ---

function setupDropzone(dropEl, index) {
  const fileInput = dropEl.querySelector('input[type="file"]');
  ['dragenter', 'dragover'].forEach(e =>
    dropEl.addEventListener(e, (ev) => { ev.preventDefault(); dropEl.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach(e =>
    dropEl.addEventListener(e, () => dropEl.classList.remove('dragover'))
  );
  dropEl.addEventListener('drop', (ev) => {
    ev.preventDefault();
    if (ev.dataTransfer.files.length) loadFile(ev.dataTransfer.files[0], dropEl, index);
  });
  fileInput.addEventListener('change', (ev) => {
    if (ev.target.files.length) loadFile(ev.target.files[0], dropEl, index);
  });
}

function loadFile(file, dropEl, index) {
  state.imageFiles[index] = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    const b64 = e.target.result;
    state.images[index] = b64;
    dropEl.classList.add('has-image');
    dropEl.innerHTML =
      '<button class="remove-btn" onclick="window._dropzone.remove(' + index + ', this.parentElement)">&times;</button>' +
      '<img class="preview" src="' + b64 + '" />' +
      '<input type="file" accept="image/*" />';
    setupDropzone(dropEl, index);
  };
  reader.readAsDataURL(file);
}

window._dropzone = {
  remove(index, dropEl) {
    state.images[index] = null;
    state.imageFiles[index] = null;
    dropEl.classList.remove('has-image');
    dropEl.innerHTML =
      '<input type="file" accept="image/*" />' +
      '<div class="dropzone-icon">&#128444;</div>' +
      '<p class="dropzone-text">Drop image or <strong>browse</strong></p>';
    setupDropzone(dropEl, index);
  }
};

// --- Init ---

function init() {
  loadSettings();
  initDebugPanel();
  initPromptLibrary();
  initGallery();
  initQueue();

  // Load history then populate filters
  loadHistoryGallery().then(() => populateFilterOptions());

  // Auto-save settings on change
  ['apiBase', 'apiKey', 'model', 'aspectRatio', 'quality', 'thinkingLevel', 'enhanceModel'].forEach(id => {
    $('#' + id).addEventListener('change', saveSettings);
    $('#' + id).addEventListener('input', saveSettings);
  });
  $('#enhanceToggle').addEventListener('change', saveSettings);

  // Tips toggle
  const tipsToggle = $('#tipsToggle');
  const tipsContent = $('#tipsContent');
  if (tipsToggle && tipsContent) {
    tipsToggle.addEventListener('click', () => {
      tipsToggle.classList.toggle('open');
      tipsContent.classList.toggle('visible');
    });
  }

  // Toggle API key visibility
  $('#toggleKeyVis').addEventListener('click', () => {
    const input = $('#apiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Mode toggle
  $$('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.mode-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentMode = btn.dataset.mode;
      $('#imageInputs').classList.toggle('hidden', state.currentMode === 't2i');
      $('#aspectGroup').classList.toggle('hidden', state.currentMode === 'i2i');
      $('#qualityGroup').classList.toggle('hidden', state.currentMode === 'i2i');
    });
  });

  // Dropzones
  setupDropzone($('#drop1'), 0);
  setupDropzone($('#drop2'), 1);

  // Generate button
  $('#generateBtn').addEventListener('click', async () => {
    const btn = $('#generateBtn');
    btn.disabled = true;
    btn.textContent = 'Generating...';
    $('#enhancedPreview').classList.remove('visible');
    showStatus('Starting generation...');
    debugStartGroup('Generation #' + (state.imageCounter + 1));
    debugLog('Generate button clicked', 'info');
    try {
      const job = getCurrentJob();
      debugLog('Job created', 'info', {
        prompt: job.prompt.slice(0, 80), model: job.model, mode: job.mode,
        aspect: job.aspectRatio, quality: job.quality, thinking: job.thinkingLevel
      });
      const result = await runGeneration(job);
      const resultObj = await processResult(job, result);
      addToGallery(resultObj);
      populateFilterOptions();
      applyGalleryFilters();
      downloadImage(resultObj.b64, resultObj.sequenceNumber);
      hideStatus();
      debugLog('Complete: #' + String(resultObj.sequenceNumber).padStart(3, '0') + ' ' + resultObj.dimensions + ' ~' + resultObj.fileSizeKB + 'KB', 'success');
      debugEndGroup('success');
      showToast('\\u2728 Image generated successfully!', 'success');

      const newestCard = document.getElementById('gallery-card-' + resultObj.sequenceNumber);
      if (newestCard) newestCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (err) {
      showStatus(err.message || String(err), true);
      debugLog('Generation failed', 'error', err.message || String(err));
      debugEndGroup('error');
      showToast('\\u274c ' + (err.message || String(err)), 'error');
      console.error('Generation error:', err);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Generate';
    }
  });
}

init();
