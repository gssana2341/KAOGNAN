import { icon } from './icons.js';
import { buzz, esc, loadScript } from './util.js';

let jsqrReady = null;
const ensureJsQR = () => (jsqrReady ??= loadScript('/vendor/jsQR.js'));

// Decodes a QR from a still image (used for the "take a photo instead" fallback).
async function decodeFile(file) {
  await ensureJsQR();
  const bmp = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('เปิดรูปไม่ได้'));
    img.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  URL.revokeObjectURL(bmp.src);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  return window.jsQR(data.data, c.width, c.height, { inversionAttempts: 'attemptBoth' })?.data ?? null;
}

/**
 * Full-screen QR scanner. `handler(text)` is called for every QR found and returns
 *   { done: true }                    -> scanner closes and resolves true
 *   { done: false, message: '...' }   -> message is shown and scanning continues
 * Resolves false when the user closes it.
 */
export function openScanner(title, handler) {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'scanner';
    root.innerHTML = `
      <div class="scanner-top"><b>${icon('scan-line', 20)} ${esc(title)}</b>
        <div class="row"><button class="btn small" data-torch hidden>${icon('flashlight', 16)}ไฟฉาย</button><button class="btn small" data-x>${icon('x', 16)}ปิด</button></div></div>
      <div class="scanner-view">
        <video playsinline muted></video>
        <div class="frame"><i></i><i></i><i></i><i></i><span class="line"></span></div>
      </div>
      <div class="scanner-msg" aria-live="polite">กำลังเปิดกล้อง…</div>
      <div class="scanner-bottom">
        <label class="btn photo">${icon('camera', 18)}ถ่ายรูป QR แทน<input type="file" accept="image/*" capture="environment" hidden></label>
      </div>`;
    document.body.append(root);

    const video = root.querySelector('video');
    const msg = root.querySelector('.scanner-msg');
    const torchBtn = root.querySelector('[data-torch]');
    const setMsg = (t, cls = '') => { msg.textContent = t; msg.className = `scanner-msg ${cls}`; };
    let stream = null;
    let stopped = false;
    let busy = false;
    let torchOn = false;

    const finish = (ok) => {
      if (stopped) return;
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
      root.remove();
      resolve(ok);
    };

    async function submit(text) {
      if (busy || stopped) return;
      busy = true;
      buzz(30);
      setMsg('กำลังตรวจสอบ…');
      try {
        const r = await handler(text);
        if (r.done) return finish(true);
        buzz([60, 40, 60]);
        setMsg(r.message, 'bad');
      } catch (e) {
        setMsg(e.message || 'เกิดข้อผิดพลาด', 'bad');
      }
      setTimeout(() => { busy = false; }, 1500); // cool-down so the same wrong QR isn't re-sent every frame
    }

    root.querySelector('[data-x]').addEventListener('click', () => finish(false));
    torchBtn.addEventListener('click', async () => {
      torchOn = !torchOn;
      try { await stream.getVideoTracks()[0].applyConstraints({ advanced: [{ torch: torchOn }] }); } catch { torchOn = !torchOn; }
      torchBtn.innerHTML = `${icon(torchOn ? 'flashlight-off' : 'flashlight', 16)}${torchOn ? 'ปิดไฟ' : 'ไฟฉาย'}`;
    });
    root.querySelector('input[type=file]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      setMsg('กำลังอ่าน QR จากรูป…');
      try {
        const text = await decodeFile(file);
        if (text) await submit(text); else setMsg('ไม่พบ QR ในรูป ลองถ่ายใหม่ให้ใกล้และชัดขึ้น', 'bad');
      } catch (err) { setMsg(err.message, 'bad'); }
    });

    (async () => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        root.classList.add('nocam');
        return setMsg('เปิดกล้องสดไม่ได้ (ต้องเข้าผ่าน HTTPS) — กดปุ่มด้านล่างเพื่อถ่ายรูป QR แทนได้เลย');
      }
      try {
        await ensureJsQR();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false });
      } catch (e) {
        root.classList.add('nocam');
        return setMsg(e.name === 'NotAllowedError' ? 'ยังไม่ได้อนุญาตให้ใช้กล้อง — อนุญาตในเบราว์เซอร์ หรือกดถ่ายรูป QR แทน' : 'เปิดกล้องไม่ได้ — กดถ่ายรูป QR แทนได้เลย', 'bad');
      }
      if (stopped) return stream.getTracks().forEach((t) => t.stop());
      video.srcObject = stream;
      await video.play().catch(() => {});
      setMsg('เล็งกล้องไปที่ QR ของที่ทำงาน');
      try { if (stream.getVideoTracks()[0].getCapabilities?.().torch) torchBtn.hidden = false; } catch { /* no torch */ }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const tick = () => {
        if (stopped) return;
        if (!busy && video.readyState >= 2 && video.videoWidth) {
          const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const hit = window.jsQR(img.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
          if (hit?.data) submit(hit.data);
        }
        setTimeout(tick, 120);
      };
      tick();
    })();
  });
}
