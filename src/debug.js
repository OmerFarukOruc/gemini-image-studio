import { $, escHtml, showToast } from './utils.js';
import { sessionId } from './state.js';

let debugGroups = [];
let activeGroupId = null;
let debugGroupCounter = 0;
let debugRenderPending = false;

function scheduleDebugRender() {
  if (!debugRenderPending) {
    debugRenderPending = true;
    requestAnimationFrame(() => { debugRenderPending = false; renderDebugPanel(); });
  }
}

export function debugStartGroup(label) {
  debugGroupCounter++;
  const id = 'dg-' + debugGroupCounter;
  activeGroupId = id;
  debugGroups.unshift({ id, label, status: 'running', entries: [], startTime: Date.now() });
  scheduleDebugRender();
  return id;
}

export function debugEndGroup(status) {
  const group = debugGroups.find(g => g.id === activeGroupId);
  if (group) {
    group.status = status || 'success';
    group.duration = ((Date.now() - group.startTime) / 1000).toFixed(1) + 's';
  }
  activeGroupId = null;
  scheduleDebugRender();
}

export function debugLog(msg, level, detail) {
  level = level || 'info';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const entry = { time, level, msg, detail };

  if (activeGroupId) {
    const group = debugGroups.find(g => g.id === activeGroupId);
    if (group) group.entries.push(entry);
  } else {
    debugGroupCounter++;
    const id = 'dg-' + debugGroupCounter;
    debugGroups.unshift({ id, label: msg, status: level === 'error' ? 'error' : 'success', entries: [entry], startTime: Date.now(), duration: '-' });
  }
  scheduleDebugRender();
  console.log('[DEBUG ' + level.toUpperCase() + ']', msg, detail || '');
}

function getDebugExportBase() {
  return {
    session: sessionId,
    exportedAt: new Date().toISOString(),
    settings: {
      apiBase: $('#apiBase') ? $('#apiBase').value : '',
      model: $('#model') ? $('#model').value : '',
      aspectRatio: $('#aspectRatio') ? $('#aspectRatio').value : '',
      quality: $('#quality') ? $('#quality').value : '',
      thinkingLevel: $('#thinkingLevel') ? $('#thinkingLevel').value : '',
      enhanceModel: $('#enhanceModel') ? $('#enhanceModel').value : '',
      enhanceEnabled: $('#enhanceToggle') ? $('#enhanceToggle').checked : false
    }
  };
}

function formatDebugGroup(g) {
  return {
    id: g.id, label: g.label, status: g.status,
    startTime: new Date(g.startTime).toISOString(),
    duration: g.duration || null,
    entries: g.entries.map(e => ({ time: e.time, level: e.level, message: e.msg, detail: e.detail || null }))
  };
}

function copyToClipboardWithFallback(text, successMsg) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg, 'success');
  }).catch(() => {
    const w = window.open('', '_blank');
    if (w) { w.document.write('<pre>' + escHtml(text) + '</pre>'); w.document.title = 'Debug Log'; }
  });
}

function renderDebugPanel() {
  const log = document.getElementById('debugLog');
  if (!log) return;
  const badge = document.getElementById('debugBadge');
  if (badge) badge.textContent = debugGroups.length;

  if (debugGroups.length === 0) {
    log.innerHTML = '<div class="debug-empty">No generations yet. Click Generate to see logs here.</div>';
    return;
  }

  log.innerHTML = debugGroups.map(g => {
    const isOpen = g._open ? ' open' : '';
    const hasError = g.status === 'error' ? ' has-error' : '';
    const timeStr = new Date(g.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dur = g.duration ? ' · ' + g.duration : '';

    const entriesHtml = g.entries.map(e => {
      let line = '<div class="log-line">' +
        '<span class="log-ts">' + e.time + '</span>' +
        '<span class="log-badge ' + e.level + '">' + e.level + '</span>' +
        '<span class="log-msg">' + escHtml(String(e.msg)) + '</span></div>';
      if (e.detail) {
        const detailStr = typeof e.detail === 'object' ? JSON.stringify(e.detail, null, 2) : String(e.detail);
        line += '<div class="log-detail">' + escHtml(detailStr) + '</div>';
      }
      return line;
    }).join('');

    return '<div class="debug-group' + isOpen + hasError + '" data-gid="' + g.id + '">' +
      '<div class="debug-group-header" onclick="window._debug.toggleGroup(\'' + g.id + '\')">' +
        '<div class="debug-group-left">' +
          '<span class="debug-group-arrow">&#9654;</span>' +
          '<span class="debug-group-status ' + g.status + '"></span>' +
          '<span class="debug-group-label">' + escHtml(String(g.label)) + '</span>' +
        '</div>' +
        '<span class="debug-group-time">' + timeStr + dur + '</span>' +
        '<button class="debug-group-delete" onclick="event.stopPropagation();window._debug.copyGroup(\'' + g.id + '\')" title="Copy JSON">&#128203;</button>' +
        '<button class="debug-group-delete" onclick="event.stopPropagation();window._debug.deleteGroup(\'' + g.id + '\')" title="Delete">&times;</button>' +
      '</div>' +
      '<div class="debug-group-body">' + entriesHtml + '</div>' +
    '</div>';
  }).join('');
}

// Expose to onclick handlers in rendered HTML
window._debug = {
  toggleGroup(id) {
    const g = debugGroups.find(x => x.id === id);
    if (g) g._open = !g._open;
    const el = document.querySelector('[data-gid="' + id + '"]');
    if (el) el.classList.toggle('open', g && g._open);
  },
  deleteGroup(id) {
    debugGroups = debugGroups.filter(x => x.id !== id);
    const el = document.querySelector('[data-gid="' + id + '"]');
    if (el) el.remove();
    const badge = $('#debugBadge');
    if (badge) badge.textContent = debugGroups.length;
  },
  copyGroup(id) {
    const g = debugGroups.find(x => x.id === id);
    if (!g) return;
    const exportData = getDebugExportBase();
    exportData.generation = formatDebugGroup(g);
    copyToClipboardWithFallback(JSON.stringify(exportData, null, 2), 'Generation log copied to clipboard');
  }
};

export function initDebugPanel() {
  $('#debugToggleBtn').addEventListener('click', () => {
    $('#debugPanel').classList.toggle('visible');
    document.body.classList.toggle('debug-open');
  });
  $('#debugCloseBtn').addEventListener('click', () => {
    $('#debugPanel').classList.remove('visible');
    document.body.classList.remove('debug-open');
  });
  $('#debugClearBtn').addEventListener('click', () => { debugGroups = []; renderDebugPanel(); });
  $('#debugCopyBtn').addEventListener('click', () => {
    const exportData = getDebugExportBase();
    exportData.generations = debugGroups.map(formatDebugGroup);
    copyToClipboardWithFallback(JSON.stringify(exportData, null, 2), 'Debug log copied to clipboard (' + debugGroups.length + ' groups)');
  });
  $('#debugCollapseAllBtn').addEventListener('click', () => {
    debugGroups.forEach(g => g._open = false);
    renderDebugPanel();
  });

  debugLog('Session started: ' + sessionId, 'info');
}
