import { api } from './api.js';

// Filled from GET /api/assets: backgrounds found in public/bg and optional replacement mascot images.
export const assets = { backgrounds: [], mascot: null };

export async function loadAssets() {
  try { Object.assign(assets, await api.get('/assets')); } catch { /* built-in defaults are used */ }
}
