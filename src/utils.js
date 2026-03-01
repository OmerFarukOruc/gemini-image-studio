export const $ = (s) => document.querySelector(s);
export const $$ = (s) => document.querySelectorAll(s);

export function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export async function safeParseJSON(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error(text || ('HTTP ' + res.status));
  }
}

export function showStatus(msg, isError) {
  const el = $('#status');
  el.className = 'status visible' + (isError ? ' error' : '');
  el.innerHTML = isError ? msg : '<span class="spinner"></span>' + msg;
}

export function hideStatus() {
  $('#status').className = 'status';
}

export function getApiBase() {
  const base = $('#apiBase').value.trim();
  if (!base) throw new Error('API Base URL is required. Enter your OpenAI-compatible API endpoint.');
  return base.replace(/\/+$/, '');
}

let toastTimer = null;

export function showToast(msg, type) {
  const t = $('#toast');
  t.innerHTML = msg + '<span class="toast-close">&times;</span>';
  t.className = 'toast ' + (type || 'info');
  clearTimeout(toastTimer);
  requestAnimationFrame(() => t.classList.add('visible'));
  toastTimer = setTimeout(() => t.classList.remove('visible'), 5000);
  t.onclick = () => { clearTimeout(toastTimer); t.classList.remove('visible'); };

  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.value = 0.15;
    const osc = ctx.createOscillator();
    osc.connect(gain);
    if (type === 'success') {
      osc.frequency.value = 587; osc.type = 'sine';
      osc.start(); osc.stop(ctx.currentTime + 0.12);
      setTimeout(() => {
        const o2 = ctx.createOscillator(); o2.connect(gain); o2.frequency.value = 784; o2.type = 'sine';
        o2.start(); o2.stop(ctx.currentTime + 0.15);
      }, 130);
    } else if (type === 'error') {
      osc.frequency.value = 330; osc.type = 'square';
      osc.start(); osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {}

  if (document.hidden && Notification.permission === 'granted') {
    new Notification('Gemini Image Studio', { body: msg });
  }
}

if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}
