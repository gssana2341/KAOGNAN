import { api } from './api.js';
import { assets } from './assets.js';

const FALLBACK = [{ id: 'sky', name: 'ฟ้าใสเมฆฟู', file: '/bg/sky.svg', mode: 'cover', tile: 240, thumb: '280px 280px' }];
export const getBackgrounds = () => (assets.backgrounds.length ? assets.backgrounds : FALLBACK);

const KEY = 'kn_bg';
let customUrl = null;

export const lastBg = () => { try { return localStorage.getItem(KEY) || 'sky'; } catch { return 'sky'; } };

export async function applyBg(id) {
  const el = document.getElementById('bg');
  let url;
  let size = 'cover';
  let repeat = 'no-repeat';
  if (id === 'custom') {
    try {
      customUrl ??= URL.createObjectURL(await api.blob('/me/bg-image'));
      url = customUrl;
    } catch { id = lastBg(); }
  }
  if (id !== 'custom') {
    const bg = getBackgrounds().find((b) => b.id === id) ?? getBackgrounds()[0];
    id = bg.id;
    url = bg.file;
    if (bg.mode === 'tile') { size = `${bg.tile}px`; repeat = 'repeat'; }
  }
  Object.assign(el.style, { backgroundImage: `url("${url}")`, backgroundSize: size, backgroundRepeat: repeat });
  el.dataset.kind = id === 'custom' ? 'photo' : 'preset';
  document.documentElement.dataset.bg = id;
  try { if (id !== 'custom') localStorage.setItem(KEY, id); } catch { /* ignore */ }
}

export function resetCustomCache() {
  if (customUrl) URL.revokeObjectURL(customUrl);
  customUrl = null;
}

// Re-encodes whatever the user picked to a JPEG that is small enough to upload.
export function fileToJpegDataUrl(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(src); reject(new Error('เปิดไฟล์รูปนี้ไม่ได้')); };
    img.src = src;
  });
}
