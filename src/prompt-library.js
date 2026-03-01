import { $, escHtml, showToast } from './utils.js';
import { PL_KEY, promptLibrary, setPromptLibrary } from './state.js';

function loadPromptLibrary() {
  try { setPromptLibrary(JSON.parse(localStorage.getItem(PL_KEY) || '[]')); } catch (_) { setPromptLibrary([]); }
  const countEl = $('#libraryCount');
  if (countEl) countEl.textContent = promptLibrary.length;
}

function savePromptLibraryData() {
  localStorage.setItem(PL_KEY, JSON.stringify(promptLibrary));
  const countEl = $('#libraryCount');
  if (countEl) countEl.textContent = promptLibrary.length;
}

function savePromptToLibrary() {
  const text = $('#prompt').value.trim();
  if (!text) { showToast('Write a prompt first', 'error'); return; }
  const saveRow = $('#plSaveRow');
  if (saveRow.classList.contains('hidden')) {
    saveRow.classList.remove('hidden');
    $('#plTagInput').focus();
  } else {
    const tags = $('#plTagInput').value.split(',').map(t => t.trim()).filter(Boolean);
    promptLibrary.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text, tags, createdAt: Date.now(), usageCount: 0
    });
    savePromptLibraryData();
    renderPromptLibrary();
    saveRow.classList.add('hidden');
    $('#plTagInput').value = '';
    showToast('Prompt saved to library', 'success');
  }
}

function renderPromptLibrary(filter) {
  const list = $('#promptLibraryList');
  const q = (filter || '').toLowerCase();
  const filtered = promptLibrary.filter(p => {
    if (!q) return true;
    return p.text.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q));
  });
  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-dim);padding:20px;font-size:13px;">' +
      (promptLibrary.length === 0 ? 'No saved prompts yet' : 'No matches') + '</div>';
    return;
  }
  list.innerHTML = filtered.map(p => {
    const truncated = p.text.length > 120 ? p.text.slice(0, 120) + '...' : p.text;
    const chips = p.tags.map(t => '<span class="prompt-chip">' + escHtml(t) + '</span>').join('');
    return '<div class="prompt-card">' +
      '<div class="prompt-card-text">' + escHtml(truncated) + '</div>' +
      '<div class="prompt-card-footer">' +
        '<div class="prompt-card-tags">' + chips + '</div>' +
        '<span class="prompt-card-usage">Used ' + p.usageCount + 'x</span>' +
        '<div class="prompt-card-actions">' +
          '<button class="use-btn" onclick="window._promptLib.use(\'' + p.id + '\')">Use</button>' +
          '<button class="del-btn" onclick="window._promptLib.del(\'' + p.id + '\')">Del</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');
}

// Expose to onclick handlers
window._promptLib = {
  use(id) {
    const p = promptLibrary.find(x => x.id === id);
    if (!p) return;
    $('#prompt').value = p.text;
    p.usageCount++;
    savePromptLibraryData();
    renderPromptLibrary($('#plSearch').value);
    showToast('Prompt loaded', 'success');
  },
  del(id) {
    if (!confirm('Delete this saved prompt?')) return;
    const idx = promptLibrary.findIndex(x => x.id === id);
    if (idx !== -1) promptLibrary.splice(idx, 1);
    savePromptLibraryData();
    renderPromptLibrary($('#plSearch').value);
  }
};

export function initPromptLibrary() {
  loadPromptLibrary();
  renderPromptLibrary();

  $('#savePromptBtn').addEventListener('click', savePromptToLibrary);
  $('#plConfirmSaveBtn').addEventListener('click', savePromptToLibrary);
  $('#plTagInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') savePromptToLibrary(); });

  $('#toggleLibraryBtn').addEventListener('click', () => {
    const panel = $('#promptLibraryPanel');
    panel.classList.toggle('visible');
    if (panel.classList.contains('visible')) renderPromptLibrary();
  });

  $('#plSearch').addEventListener('input', function () { renderPromptLibrary(this.value); });
}
