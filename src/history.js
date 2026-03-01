import { galleryItems, sessionId } from './state.js';

const DB_NAME = 'GeminiStudioHistory';
const DB_VERSION = 1;
const STORE_NAME = 'images';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveToHistory(resultObj) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const record = {
      b64: resultObj.b64,
      prompt: resultObj.prompt || '',
      enhancedPrompt: resultObj.enhancedPrompt || '',
      model: resultObj.model || '',
      aspectRatio: resultObj.aspectRatio || '',
      quality: resultObj.quality || '',
      thinkingLevel: resultObj.thinkingLevel || '',
      mode: resultObj.mode || '',
      generationTimeMs: resultObj.generationTimeMs || 0,
      dimensions: resultObj.dimensions || '',
      fileSizeKB: resultObj.fileSizeKB || 0,
      createdAt: resultObj.createdAt || Date.now(),
      sequenceNumber: resultObj.sequenceNumber || 0,
      sessionId: resultObj.sessionId || sessionId
    };
    const r = store.add(record);
    r.onsuccess = () => { record.id = r.result; resolve(record); };
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}

export async function loadHistory() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const idx = store.index('createdAt');
    const r = idx.getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}

export async function clearHistoryDB() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}

export function updateHistoryStats() {
  const countEl = document.getElementById('historyCount');
  const sizeEl = document.getElementById('historySize');
  if (countEl) countEl.textContent = galleryItems.length;
  if (sizeEl) {
    let totalBytes = 0;
    for (const item of galleryItems) {
      totalBytes += (item.b64 ? item.b64.length * 0.75 : 0);
    }
    sizeEl.textContent = (totalBytes / 1024 / 1024).toFixed(1) + ' MB';
  }
}
