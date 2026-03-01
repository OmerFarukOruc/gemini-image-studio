import { $, escHtml, showToast, showStatus, hideStatus } from './utils.js';
import { state, queue } from './state.js';
import { runGeneration } from './api.js';
import { processResult, addToGallery, downloadImage, populateFilterOptions, applyGalleryFilters } from './gallery.js';

function getCurrentJob() {
  const prompt = $('#prompt').value.trim();
  if (!prompt) throw new Error('Prompt is required');
  if (!$('#apiKey').value.trim()) throw new Error('API Key is required');
  if (state.currentMode === 'i2i' && !state.imageFiles[0]) throw new Error('At least one image is required');
  return {
    createdAt: Date.now(),
    prompt,
    model: $('#model').value,
    aspectRatio: $('#aspectRatio').value,
    quality: $('#quality').value,
    thinkingLevel: $('#thinkingLevel').value,
    mode: state.currentMode,
    imgs: [state.images[0], state.images[1]],
    files: [state.imageFiles[0], state.imageFiles[1]],
    i2iAspectRatio: $('#i2iAspectRatio').value,
    i2iQuality: $('#i2iQuality').value,
    i2iStyle: $('#i2iStyle').value.trim(),
    enhance: $('#enhanceToggle').checked
  };
}

export { getCurrentJob };

function renderQueue() {
  const panel = $('#queuePanel');
  const list = $('#queueList');

  if (queue.length === 0) { panel.classList.add('hidden'); return; }
  panel.classList.remove('hidden');
  $('#queueBadge').textContent = queue.length;

  const total = queue.length;
  const completed = queue.filter(j => j.status === 'done').length;
  const running = queue.filter(j => j.status === 'running').length;
  const pending = queue.filter(j => j.status === 'pending').length;
  const failed = queue.filter(j => j.status === 'failed').length;

  $('#queueProgressFill').style.width = ((completed + failed) / total * 100) + '%';
  let statusText = completed + ' completed · ' + running + ' running · ' + pending + ' pending';
  if (failed) statusText += ' · ' + failed + ' failed';
  $('#queueStatusText').textContent = statusText;

  let html = '';
  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    const statusLabel = job.status === 'pending' ? 'Pending' : job.status === 'running' ? 'Running...' : job.status === 'done' ? 'Done' : 'Failed';
    const modelShort = job.model.includes('pro') ? 'Pro' : job.model.includes('3.1') ? '3.1 Flash' : job.model.includes('2.0') ? '2.0 Flash' : 'Flash';

    let actionsHtml = '<div class="queue-item-actions">';
    if (job.status === 'pending') {
      actionsHtml += `<button class="queue-item-action" onclick="window._queue.duplicate(${i})">Duplicate</button>`;
      actionsHtml += `<button class="queue-item-action" onclick="window._queue.edit(${i})">Edit</button>`;
      actionsHtml += `<button class="queue-item-remove" onclick="window._queue.remove(${i})">&times;</button>`;
    } else {
      actionsHtml += `<button class="queue-item-action" onclick="window._queue.duplicate(${i})">Duplicate</button>`;
    }
    actionsHtml += '</div>';

    let metaStr = job.mode.toUpperCase() + ' · ' + modelShort + ' · ' + (job.enhance ? 'Enhanced' : 'Raw');
    if (job.mode === 't2i') metaStr += ' · ' + job.aspectRatio + ' · ' + job.quality;

    html += '<div class="queue-item ' + job.status + '">' +
      '<span class="queue-item-num">#' + (i + 1) + '</span>' +
      '<div class="queue-item-info">' +
        '<div class="queue-item-prompt">' + escHtml(job.prompt) + '</div>' +
        '<div class="queue-item-meta">' + metaStr + '</div>' +
      '</div>' +
      '<span class="queue-item-status ' + job.status + '">' + statusLabel + '</span>' +
      actionsHtml +
    '</div>';
  }
  list.innerHTML = html;
}

async function runQueue() {
  if (state.queueRunning) return;
  state.queueRunning = true;
  $('#queueRunBtn').disabled = true;
  $('#queueAddBtn').disabled = true;
  $('#generateBtn').disabled = true;

  for (let i = 0; i < queue.length; i++) {
    const job = queue[i];
    if (job.status !== 'pending') continue;

    job.status = 'running';
    renderQueue();

    try {
      showStatus('Queue ' + (i + 1) + '/' + queue.length + ': ' + (job.enhance ? 'Enhancing & generating...' : 'Generating...'));
      const result = await runGeneration(job);
      const resultObj = await processResult(job, result);
      addToGallery(resultObj);
      populateFilterOptions();
      applyGalleryFilters();
      downloadImage(resultObj.b64, resultObj.sequenceNumber);

      job.status = 'done';
      job.result = resultObj.b64;

      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      job.status = 'failed';
      job.error = err.message;
      showToast('\\u274c Queue #' + (i + 1) + ': ' + err.message, 'error');
    }
    renderQueue();
  }

  hideStatus();
  const doneCount = queue.filter(j => j.status === 'done').length;
  const failCount = queue.filter(j => j.status === 'failed').length;
  if (doneCount > 0) showToast('\\u2728 Queue complete! ' + doneCount + ' generated' + (failCount ? ', ' + failCount + ' failed' : ''), doneCount && !failCount ? 'success' : 'info');
  state.queueRunning = false;
  $('#queueRunBtn').disabled = false;
  $('#queueAddBtn').disabled = false;
  $('#generateBtn').disabled = false;
}

// Expose to onclick handlers
window._queue = {
  duplicate(i) {
    if (queue[i]) {
      const newJob = Object.assign({}, queue[i]);
      newJob.id = Date.now() + Math.random();
      newJob.status = 'pending';
      delete newJob.result;
      delete newJob.error;
      queue.push(newJob);
      renderQueue();
    }
  },
  edit(i) {
    if (queue[i] && queue[i].status === 'pending') {
      $('#prompt').value = queue[i].prompt;
      queue.splice(i, 1);
      renderQueue();
      $('#prompt').scrollIntoView({ behavior: 'smooth', block: 'center' });
      $('#prompt').focus();
    }
  },
  remove(i) {
    if (queue[i] && queue[i].status === 'pending') {
      queue.splice(i, 1);
      renderQueue();
    }
  }
};

export function initQueue() {
  $('#queueAddBtn').addEventListener('click', () => {
    try {
      const job = getCurrentJob();
      job.id = Date.now() + Math.random();
      job.status = 'pending';
      queue.push(job);
      renderQueue();
    } catch (err) {
      showStatus(err.message, true);
    }
  });

  $('#queueClearBtn').addEventListener('click', () => {
    const running = queue.filter(j => j.status === 'running');
    queue.length = 0;
    queue.push(...running);
    renderQueue();
    if (queue.length === 0) $('#queuePanel').classList.add('hidden');
  });

  $('#queueRunBtn').addEventListener('click', runQueue);

  // Ctrl+Shift+Q shortcut
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'q') {
      e.preventDefault();
      $('#queueAddBtn').click();
    }
  });
}
