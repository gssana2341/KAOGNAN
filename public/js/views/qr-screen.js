import { api } from '../api.js';
import { icon } from '../icons.js';
import { mascot } from '../mascot.js';
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
          <div style="margin-top:6px">${mascot('happy', 96)}</div>
          <h1 style="margin-top:2px">${esc(d.company_name)}</h1>
          <p class="muted" style="font-weight:600">สแกนเพื่อ เข้างาน / ออกงาน ด้วย KaoNgan</p>
          <div class="qr-box">${d.svg}</div>
          ${d.mode === 'rotating' ? `<div class="countdown"><i style="width:${(d.expires_in / d.rotate_sec) * 100}%"></i></div><p class="small muted" style="margin-top:8px">${icon('refresh-cw', 13)} QR เปลี่ยนอัตโนมัติ — ห้ามถ่ายรูปส่งต่อนะ</p>` : ''}
          <div class="row no-print" style="justify-content:center;margin-top:16px">
            <a class="btn" href="#/admin/settings">${icon('chevron-left', 17)}กลับ</a>
            <button class="btn primary" id="print">${icon('printer', 17)}พิมพ์</button>
          </div>
        </div></div>`;
      el.querySelector('#print').onclick = () => window.print();
      if (d.mode === 'rotating') {
        const bar = el.querySelector('.countdown i');
        requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transitionDuration = `${d.expires_in}s`; bar.style.width = '0%'; }));
        timer = setTimeout(load, d.expires_in * 1000 + 300);
      }
    } catch (e) {
      el.innerHTML = `<div class="qr-screen"><div class="card" style="padding-top:20px">${esc(e.message)}<br><a class="btn" href="#/admin/settings">กลับ</a></div></div>`;
    }
  }
  load();
  return () => { alive = false; clearTimeout(timer); };
}
