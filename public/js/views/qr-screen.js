import { api } from '../api.js';
import { esc } from '../util.js';

// Full-screen QR for a tablet/monitor at the workplace (also the print layout for the static QR).
export default function qrScreen(el) {
  let timer = null;
  let alive = true;

  async function load() {
    try {
      const d = await api.get('/admin/qr');
      if (!alive) return;
      el.innerHTML = `
        <div class="qr-screen"><div class="card">
          <h1>${esc(d.company_name)}</h1>
          <p class="muted">สแกนเพื่อ เข้างาน / ออกงาน ด้วย KaoNgan</p>
          <div class="qr-box">${d.svg}</div>
          ${d.mode === 'rotating' ? `<div class="countdown"><i style="width:${(d.expires_in / d.rotate_sec) * 100}%"></i></div><p class="small muted" style="margin-top:6px">QR เปลี่ยนอัตโนมัติ — ห้ามถ่ายรูปส่งต่อนะ 🙅</p>` : ''}
          <div class="row no-print" style="justify-content:center;margin-top:14px">
            <a class="btn" href="#/admin/settings">← กลับ</a>
            <button class="btn primary" id="print">🖨️ พิมพ์</button>
          </div>
        </div></div>`;
      el.querySelector('#print').onclick = () => window.print();
      if (d.mode === 'rotating') {
        const bar = el.querySelector('.countdown i');
        requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transitionDuration = `${d.expires_in}s`; bar.style.width = '0%'; }));
        timer = setTimeout(load, d.expires_in * 1000 + 300);
      }
    } catch (e) {
      el.innerHTML = `<div class="qr-screen"><div class="card">${esc(e.message)}<br><a class="btn" href="#/admin/settings">← กลับ</a></div></div>`;
    }
  }
  load();
  return () => { alive = false; clearTimeout(timer); };
}
