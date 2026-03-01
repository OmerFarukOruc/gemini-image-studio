export const STORAGE_KEY = 'gemini-studio-settings';
export const PL_KEY = 'gemini-studio-prompts';
export const sessionId = Math.random().toString(36).slice(2, 8).toUpperCase();

export const state = {
  imageCounter: 0,
  currentMode: 't2i',
  images: [null, null],
  imageFiles: [null, null],
  queueRunning: false,
  currentLightboxIndex: -1,
};

export const galleryItems = [];
export const queue = [];
export const selectedForCompare = new Set();
export let promptLibrary = [];

export function setPromptLibrary(arr) {
  promptLibrary = arr;
}
