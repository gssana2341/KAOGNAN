import { api } from './api.js';

export const PRESETS = [
  { id: 'sky', name: 'ฟ้าใสเมฆฟู' },
  { id: 'candy', name: 'ชมพูหวาน' },
  { id: 'mint', name: 'มิ้นต์สดชื่น' },
  { id: 'night', name: 'ราตรีดาวพราว' },
  { id: 'paws', name: 'รอยเท้าเหมียว' },
  { id: 'sunny', name: 'ทุ่งดอกเดซี่' },
  { id: 'boba', name: 'ชานมไข่มุก' },
  { id: 'lavender', name: 'ลาเวนเดอร์ฟองสบู่' },
];

const KEY = 'kn_bg';
let customUrl = null;

export const lastBg = () => { try { return localStorage.getItem(KEY) || 'sky'; } catch { return 'sky'; } };

export async function applyBg(id) {
  const el = document.getElementById('bg');
  let url;
  if (id === 'custom') {
    try {
      customUrl ??= URL.createObjectURL(await api.blob('/me/bg-image'));
      url = customUrl;
    } catch { id = 'sky'; }
  }
  if (id !== 'custom') {
    if (!PRESETS.some((p) => p.id === id)) id = 'sky';
    url = `/bg/${id}.svg`;
  }
  el.style.backgroundImage = `url("${url}")`;
  el.dataset.kind = id === 'custom' ? 'photo' : 'preset';
  document.documentElement.dataset.bg = id;
  try { localStorage.setItem(KEY, id === 'custom' ? 'sky' : id); } catch { /* ignore */ }
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
