// window.KN_API_BASE lets a wrapped mobile app point at the real server (see config.js).
import { t } from './i18n.js';

const BASE = (window.KN_API_BASE || '') + '/api';
const KEY = 'kn_token';

const store = {
  get: () => { try { return localStorage.getItem(KEY); } catch { return null; } },
  set: (v) => { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* private mode */ } },
};

let token = store.get();
let onUnauthorized = () => {};

export const hasToken = () => !!token;
export const setToken = (t) => { token = t; store.set(t); };
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(message, status, data) { super(message); this.status = status; this.data = data; }
}

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(BASE + url, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(t('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่'), 0);
  }
  if (res.ok) return res;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { setToken(null); onUnauthorized(); }
  throw new ApiError(data.error ? t(data.error) : t('เกิดข้อผิดพลาด ({status})', { status: res.status }), res.status, data);
}

export const api = {
  get: async (url) => (await request('GET', url)).json(),
  post: async (url, body = {}) => (await request('POST', url, body)).json(),
  put: async (url, body = {}) => (await request('PUT', url, body)).json(),
  del: async (url) => (await request('DELETE', url)).json(),
  blob: async (url) => (await request('GET', url)).blob(),
};

export async function download(url, filename) {
  const blob = await api.blob(url);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
