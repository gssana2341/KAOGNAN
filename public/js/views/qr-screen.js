import { api } from '../api.js';
import { icon } from '../icons.js';
import { assets } from '../assets.js';
import { mascot } from '../mascot.js';
import { esc, fitQr } from '../util.js';

// Poster for the workplace QR: preview on screen (also used full-screen on a tablet) and print on A4/A5, portrait/landscape.
const PAPERS = { A4: { mm: [210, 297], margin: 8 }, A5: { mm: [148, 210], margin: 6 } };
const PREF_KEY = 'kn_poster';

const loadPref = () => {
  try { return { orient: 'portrait', paper: 'A4', ...JSON.parse(localStorage.getItem(PREF_KEY) || '{}') }; } catch { return { orient: 'portrait', paper: 'A4' }; }
};

export default function qrScreen(el) {
  let pref = loadPref();
  if (!PAPERS[pref.paper]) pref.paper = 'A4';
  if (!['portrait', 'landscape'].includes(pref.orient)) pref.orient = 'portrait';
  let data = null;
  let timer = null;
  let alive = true;
  let stopFit = () => {};

  // @page can't be set from a media query, so the chosen paper/orientation is injected as a style element
  const pageStyle = document.createElement('style');
  document.head.append(pageStyle);

  function render() {
    stopFit();
    const { mm, margin } = PAPERS[pref.paper];
    const [w, h] = pref.orient === 'portrait' ? mm : [mm[1], mm[0]];
    const printable = [w - margin * 2, h - margin * 2];
    pageStyle.textContent = `@page { size: ${pref.paper} ${pref.orient}; margin: ${margin}mm; }`;
    const rotating = data.mode === 'rotating';
    const host = location.host;

    el.innerHTML = `
      <div class="qr-page">
        <div class="card qr-controls no-print">
          <div class="group">
            <a class="btn small" href="#/admin/settings">${icon('chevron-left', 16)}กลับ</a>
          </div>
          <div class="group">
            <div class="seg" role="radiogroup" aria-label="แนวกระดาษ">
              <input type="radio" name="orient" id="o-p" value="portrait" ${pref.orient === 'portrait' ? 'checked' : ''}><label for="o-p">แนวตั้ง</label>
              <input type="radio" name="orient" id="o-l" value="landscape" ${pref.orient === 'landscape' ? 'checked' : ''}><label for="o-l">แนวนอน</label>
            </div>
            <div class="seg" role="radiogroup" aria-label="ขนาดกระดาษ">
              <input type="radio" name="paper" id="p-a4" value="A4" ${pref.paper === 'A4' ? 'checked' : ''}><label for="p-a4">A4</label>
              <input type="radio" name="paper" id="p-a5" value="A5" ${pref.paper === 'A5' ? 'checked' : ''}><label for="p-a5">A5</label>
            </div>
            <button class="btn primary" id="print" ${rotating ? 'disabled' : ''}>${icon('printer', 17)}พิมพ์</button>
          </div>
        </div>
        ${rotating ? `<div class="banner warn no-print">${icon('triangle-alert', 22)}<span>ตอนนี้ตั้งเป็นโหมด “QR เปลี่ยนทุกครั้ง” — ใช้แสดงบนจอ/แท็บเล็ตที่ทำงาน <b>พิมพ์ไปติดผนังไม่ได้</b> (QR จะหมดอายุ) ถ้าจะพิมพ์ให้ไปเปลี่ยนเป็น “QR ติดผนัง” ที่ <a href="#/admin/settings">ตั้งค่า & QR</a> ก่อน</span></div>` : ''}

        <div class="poster ${pref.orient}${assets.mascot ? ' has-img' : ''}" style="--pwn:${printable[0]};--phn:${printable[1]}">
          <div class="p-band"><div class="p-mascot">${mascot('happy', 120)}</div></div>
          <div class="p-main">
            <div class="p-head">
              <h1 class="p-company">${esc(data.company_name)}</h1>
              <p class="p-title">สแกนเพื่อ <b>เข้างาน</b> / <b>ออกงาน</b></p>
            </div>
            <div class="p-qr">
              <div class="qr-frame"><i></i><i></i><i></i><i></i><div class="qr-slot">${data.svg}</div></div>
              ${rotating ? '<div class="countdown no-print p-count"><i></i></div>' : ''}
            </div>
            <ol class="p-steps">
              <li><span class="n">1</span><span class="ic">${icon('smartphone', 26)}</span><span><span class="ln">เปิดแอป KaoNgan</span><span class="ln">แล้วล็อกอิน</span></span></li>
              <li><span class="n">2</span><span class="ic">${icon('qr-code', 26)}</span><span><span class="ln">กด “สแกนเข้างาน”</span><span class="ln">หรือ “สแกนออกงาน”</span></span></li>
              <li><span class="n">3</span><span class="ic">${icon('scan-line', 26)}</span><span><span class="ln">เล็งกล้องมาที่ QR นี้</span><span class="ln">รอจนขึ้นว่าสำเร็จ</span></span></li>
            </ol>
          </div>
          <div class="p-foot">เปิดแอปได้ที่ <b>${esc(host)}</b> · KaoNgan ระบบเช็คอินเข้างาน</div>
        </div>
        ${rotating ? `<p class="small muted no-print">${icon('refresh-cw', 13)} QR เปลี่ยนอัตโนมัติทุก ${data.rotate_sec} วินาที — ห้ามถ่ายรูปส่งต่อนะ</p>` : ''}
      </div>`;

    stopFit = fitQr(el.querySelector('.qr-slot'));
    if (rotating) {
      const bar = el.querySelector('.countdown i');
      bar.style.width = `${(data.expires_in / data.rotate_sec) * 100}%`;
      requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transitionDuration = `${data.expires_in}s`; bar.style.width = '0%'; }));
    }
  }

  async function load() {
    try {
      data = await api.get('/admin/qr');
      if (!alive) return;
      render();
      if (data.mode === 'rotating') timer = setTimeout(load, data.expires_in * 1000 + 300);
    } catch (e) {
      el.innerHTML = `<div class="qr-page"><div class="card">${esc(e.message)}<br><a class="btn" href="#/admin/settings">กลับ</a></div></div>`;
    }
  }

  el.addEventListener('change', (e) => {
    if (!['orient', 'paper'].includes(e.target.name)) return;
    pref = { ...pref, [e.target.name]: e.target.value };
    try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)); } catch { /* ignore */ }
    render();
  });
  el.addEventListener('click', (e) => { if (e.target.closest('#print')) window.print(); });

  load();
  return () => { alive = false; clearTimeout(timer); stopFit(); pageStyle.remove(); };
}
