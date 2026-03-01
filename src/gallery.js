import { $, escHtml, showToast } from './utils.js';
import { galleryItems, selectedForCompare, sessionId, state } from './state.js';
import { saveToHistory, updateHistoryStats, loadHistory, clearHistoryDB } from './history.js';

export function downloadImage(b64, seqNum) {
  const name = ($('#sessionName') && $('#sessionName').value) ? $('#sessionName').value.trim() : '';
  const prefix = name || 'gemini-' + sessionId;
  const filename = prefix + '-' + String(seqNum).padStart(3, '0') + '.png';
  const byteChars = atob(b64);
  const byteArray = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
  const blob = new Blob([byteArray], { type: 'image/png' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function processResult(job, result) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const dimensions = img.naturalWidth + '\u00d7' + img.naturalHeight;
      const fileSizeKB = Math.round(result.b64.length * 0.75 / 1024);
      const resultObj = {
        b64: result.b64,
        prompt: job.prompt,
        enhancedPrompt: result.enhancedPrompt,
        model: job.model,
        aspectRatio: job.mode === 't2i' ? job.aspectRatio : (job.i2iAspectRatio || 'Auto'),
        quality: job.mode === 't2i' ? job.quality : job.i2iQuality,
        thinkingLevel: job.thinkingLevel || 'minimal',
        mode: job.mode,
        generationTimeMs: result.generationTimeMs,
        dimensions,
        fileSizeKB,
        createdAt: job.createdAt,
        sequenceNumber: ++state.imageCounter,
        sessionId
      };
      galleryItems.unshift(resultObj);
      resolve(resultObj);
    };
    img.src = 'data:image/png;base64,' + result.b64;
  });
}

export function addToGallery(resultObj, skipSave) {
  $('#galleryCount').textContent = galleryItems.length;

  const card = document.createElement('div');
  card.className = 'gallery-card';
  card.id = 'gallery-card-' + resultObj.sequenceNumber;

  const timeStr = new Date(resultObj.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const genTimeSec = (resultObj.generationTimeMs / 1000).toFixed(1) + 's';
  const seqStr = String(resultObj.sequenceNumber).padStart(3, '0');

  let html = `
    <img class="gallery-card-image" src="data:image/png;base64,${resultObj.b64}" onclick="window._gallery.openLightbox(${resultObj.sequenceNumber})" />
    <div class="gallery-card-meta">
      <div class="meta-grid">
        <div><div class="meta-label">Model</div><div class="meta-value" title="${resultObj.model}">${resultObj.model}</div></div>
        <div><div class="meta-label">Gen Time</div><div class="meta-value">${genTimeSec}</div></div>
        <div><div class="meta-label">Aspect / Qlty</div><div class="meta-value">${resultObj.aspectRatio} · ${resultObj.quality}</div></div>
        <div><div class="meta-label">Dimensions</div><div class="meta-value">${resultObj.dimensions}</div></div>
        <div><div class="meta-label">Thinking</div><div class="meta-value">${resultObj.thinkingLevel}</div></div>
        <div><div class="meta-label">Size</div><div class="meta-value">~${resultObj.fileSizeKB} KB</div></div>
        <div><div class="meta-label">Time</div><div class="meta-value">${timeStr}</div></div>
        <div><div class="meta-label">Sequence</div><div class="meta-value">#${seqStr}</div></div>
      </div>
    </div>
    <div class="gallery-card-prompt" onclick="this.classList.toggle('expanded')">
      ${escHtml(resultObj.prompt)}
  `;
  if (resultObj.enhancedPrompt) {
    html += `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed var(--border); color: #666;"><strong>Enhanced:</strong><br>${escHtml(resultObj.enhancedPrompt)}</div>`;
  }
  html += `</div>`;

  card.innerHTML = html;
  card.addEventListener('dblclick', (e) => {
    if (e.target.classList.contains('gallery-card-image')) return;
    toggleCompareSelect(resultObj.sequenceNumber);
  });
  $('#resultsGallery').prepend(card);

  if (!skipSave) {
    saveToHistory(resultObj).catch(err => console.warn('History save failed:', err));
  }
  updateHistoryStats();
}

// --- Filters ---

export function populateFilterOptions() {
  const models = new Set(), sessions = new Set(), modes = new Set();
  galleryItems.forEach(item => {
    if (item.model) models.add(item.model);
    if (item.sessionId) sessions.add(item.sessionId);
    if (item.mode) modes.add(item.mode);
  });
  fillSelect('#filterModel', models, 'All Models');
  fillSelect('#filterSession', sessions, 'All Sessions');
  fillSelect('#filterMode', modes, 'All Modes');
}

function fillSelect(sel, values, defaultLabel) {
  const el = $(sel);
  const current = el.value;
  el.innerHTML = '<option value="">' + defaultLabel + '</option>' +
    Array.from(values).sort().map(v =>
      '<option value="' + escHtml(v) + '"' + (v === current ? ' selected' : '') + '>' + escHtml(v) + '</option>'
    ).join('');
}

export function applyGalleryFilters() {
  const model = $('#filterModel').value;
  const session = $('#filterSession').value;
  const mode = $('#filterMode').value;
  let visibleCount = 0;
  galleryItems.forEach(item => {
    const card = document.getElementById('gallery-card-' + item.sequenceNumber);
    if (!card) return;
    const show = (!model || item.model === model) && (!session || item.sessionId === session) && (!mode || item.mode === mode);
    card.classList.toggle('hidden', !show);
    if (show) visibleCount++;
  });
  $('#galleryCount').textContent = visibleCount;
}

function clearFilters() {
  $('#filterModel').value = '';
  $('#filterSession').value = '';
  $('#filterMode').value = '';
  applyGalleryFilters();
}

// --- Bulk Export ---

function bulkExport() {
  const visible = galleryItems.filter(item => {
    const card = document.getElementById('gallery-card-' + item.sequenceNumber);
    return card && !card.classList.contains('hidden');
  });
  if (visible.length === 0) { showToast('No visible images to export', 'error'); return; }
  visible.forEach(item => downloadImage(item.b64, item.sequenceNumber));
  showToast('Exported ' + visible.length + ' images', 'success');
}

// --- Compare ---

function toggleCompareSelect(seqNum) {
  if (selectedForCompare.has(seqNum)) {
    selectedForCompare.delete(seqNum);
  } else {
    if (selectedForCompare.size >= 4) { showToast('Max 4 images for comparison', 'error'); return; }
    selectedForCompare.add(seqNum);
  }
  const card = document.getElementById('gallery-card-' + seqNum);
  if (card) card.classList.toggle('selected-compare', selectedForCompare.has(seqNum));
  $('#compareCount').textContent = selectedForCompare.size;
}

function openCompare() {
  if (selectedForCompare.size < 2) { showToast('Select at least 2 images to compare', 'error'); return; }
  const grid = $('#compareGrid');
  grid.innerHTML = '';
  selectedForCompare.forEach(seqNum => {
    const item = galleryItems.find(x => x.sequenceNumber === seqNum);
    if (!item) return;
    const div = document.createElement('div');
    div.className = 'compare-item';
    div.innerHTML = '<img src="data:image/png;base64,' + item.b64 + '" />' +
      '<div class="compare-item-meta">' +
        '<strong>#' + String(item.sequenceNumber).padStart(3, '0') + '</strong> · ' + escHtml(item.model) + '<br>' +
        item.dimensions + ' · ' + item.aspectRatio + ' · ' + item.quality + '<br>' +
        '<em>' + escHtml(item.prompt.slice(0, 80)) + (item.prompt.length > 80 ? '...' : '') + '</em>' +
      '</div>';
    grid.appendChild(div);
  });
  $('#compareOverlay').classList.add('visible');
}

function closeCompare() {
  $('#compareOverlay').classList.remove('visible');
}

// --- Lightbox ---

function renderLightbox() {
  if (state.currentLightboxIndex < 0 || state.currentLightboxIndex >= galleryItems.length) return;
  const item = galleryItems[state.currentLightboxIndex];
  $('#lightboxImg').src = 'data:image/png;base64,' + item.b64;
  $('#lightbox').classList.add('visible');

  const timeStr = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const genTimeSec = (item.generationTimeMs / 1000).toFixed(1) + 's';
  const seqStr = String(item.sequenceNumber).padStart(3, '0');

  let sidebarHtml = `
    <h4>Output</h4>
    <div class="meta-row"><span class="label">Sequence</span><span class="value">#${seqStr}</span></div>
    <div class="meta-row"><span class="label">Dimensions</span><span class="value">${item.dimensions}</span></div>
    <div class="meta-row"><span class="label">Size</span><span class="value">~${item.fileSizeKB} KB</span></div>
    <div class="meta-row"><span class="label">Time</span><span class="value">${timeStr}</span></div>
    <div class="meta-row"><span class="label">Session</span><span class="value" title="${item.sessionId}">${item.sessionId}</span></div>

    <h4>Generation</h4>
    <div class="meta-row"><span class="label">Model</span><span class="value" title="${item.model}">${item.model}</span></div>
    <div class="meta-row"><span class="label">Latency</span><span class="value">${genTimeSec}</span></div>
    <div class="meta-row"><span class="label">Aspect</span><span class="value">${item.aspectRatio}</span></div>
    <div class="meta-row"><span class="label">Quality</span><span class="value">${item.quality}</span></div>
    <div class="meta-row"><span class="label">Thinking</span><span class="value">${item.thinkingLevel}</span></div>
    <div class="meta-row"><span class="label">Mode</span><span class="value">${item.mode.toUpperCase()}</span></div>

    <h4>Prompt</h4>
    <div class="prompt-text">${escHtml(item.prompt)}</div>
  `;

  if (item.enhancedPrompt) {
    sidebarHtml += `
      <h4>Enhanced Prompt <span style="font-size: 8px; color: var(--accent);">(AI)</span></h4>
      <div class="prompt-text" style="color: #666;">${escHtml(item.enhancedPrompt)}</div>
    `;
  }

  sidebarHtml += `
    <button onclick="window._gallery.downloadCurrent()"
            style="width: 100%; padding: 12px; margin-top: 24px; background: var(--success); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; transition: 0.2s;">
      Download Full Image
    </button>
  `;

  $('#lightboxSidebar').innerHTML = sidebarHtml;
}

function closeLightbox() {
  $('#lightbox').classList.remove('visible');
}

// Expose to onclick handlers
window._gallery = {
  openLightbox(seqNum) {
    const index = galleryItems.findIndex(item => item.sequenceNumber === seqNum);
    if (index === -1) return;
    state.currentLightboxIndex = index;
    renderLightbox();
  },
  closeLightbox() { closeLightbox(); },
  nav(delta) { lightboxNav(delta); },
  downloadCurrent() {
    const item = galleryItems[state.currentLightboxIndex];
    if (item) downloadImage(item.b64, item.sequenceNumber);
  }
};

function lightboxNav(delta) {
  if (galleryItems.length === 0) return;
  state.currentLightboxIndex += delta;
  if (state.currentLightboxIndex < 0) state.currentLightboxIndex = galleryItems.length - 1;
  if (state.currentLightboxIndex >= galleryItems.length) state.currentLightboxIndex = 0;
  renderLightbox();
}

// --- History Loading ---

export async function loadHistoryGallery() {
  try {
    const items = await loadHistory();
    if (items.length === 0) return;
    let maxSeq = 0;
    for (const item of items) {
      galleryItems.push(item);
      if (item.sequenceNumber > maxSeq) maxSeq = item.sequenceNumber;
    }
    state.imageCounter = maxSeq;
    for (const item of items) {
      addToGallery(item, true);
    }
    updateHistoryStats();
  } catch (err) {
    console.warn('Failed to load history:', err);
  }
}

// --- Init ---

export function initGallery() {
  $('#filterModel').addEventListener('change', applyGalleryFilters);
  $('#filterSession').addEventListener('change', applyGalleryFilters);
  $('#filterMode').addEventListener('change', applyGalleryFilters);
  $('#clearFiltersBtn').addEventListener('click', clearFilters);
  $('#bulkExportBtn').addEventListener('click', bulkExport);
  $('#compareBtn').addEventListener('click', openCompare);
  $('#compareCloseBtn').addEventListener('click', closeCompare);

  $('#clearHistoryBtn').addEventListener('click', async () => {
    if (!confirm('Clear all image history? This cannot be undone.')) return;
    try {
      await clearHistoryDB();
      galleryItems.length = 0;
      $('#resultsGallery').innerHTML = '';
      state.imageCounter = 0;
      updateHistoryStats();
      showToast('History cleared', 'info');
    } catch (err) {
      console.warn('Failed to clear history:', err);
      showToast('Failed to clear history', 'error');
    }
  });

  // Lightbox
  $('#lightbox').addEventListener('click', (e) => {
    if (e.target === $('#lightbox')) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeLightbox(); closeCompare(); }
    if (e.key === 'ArrowRight' && $('#lightbox').classList.contains('visible')) lightboxNav(1);
    if (e.key === 'ArrowLeft' && $('#lightbox').classList.contains('visible')) lightboxNav(-1);
  });
}
