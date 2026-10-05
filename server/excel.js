const ExcelJS = require('exceljs');
const { db } = require('./db');
const { buildReport } = require('./report');

const STATUS_TH = { present: 'ปกติ', late: 'สาย', leave: 'ลา', absent: 'ขาด', pending: 'ยังไม่เข้า' };
const LEAVE_TH = { sick: 'ลาป่วย', personal: 'ลากิจ', vacation: 'ลาพักร้อน', other: 'อื่นๆ' };
const PART_TH = { full: 'เต็มวัน', am: 'ครึ่งวันเช้า', pm: 'ครึ่งวันบ่าย' };
const LEAVE_STATUS_TH = { pending: 'รออนุมัติ', approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ', cancelled: 'ยกเลิก' };

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD6E7' } };
const asDate = (s) => new Date(s + 'T00:00:00Z'); // exceljs writes JS dates as UTC serials

function addSheet(wb, name, columns, rows) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns;
  ws.addRows(rows);
  const head = ws.getRow(1);
  head.height = 24;
  head.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FF5B3A4E' } };
    c.fill = HEADER_FILL;
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    c.border = { bottom: { style: 'thin', color: { argb: 'FFE9A8C4' } } };
  });
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  return ws;
}

async function sendExcel(res, { from, to, userId }) {
  const { rows, summary, settings } = buildReport({ from, to, userId });
  const wb = new ExcelJS.Workbook();
  wb.creator = settings.company_name;
  wb.created = new Date();

  const sumWs = addSheet(wb, 'สรุปรายคน', [
    { header: 'รหัส', key: 'emp_code', width: 10 },
    { header: 'ชื่อ-นามสกุล', key: 'full_name', width: 28 },
    { header: 'ชื่อเล่น', key: 'nickname', width: 12 },
    { header: 'ตำแหน่ง', key: 'position', width: 18 },
    { header: 'วันทำงานตามกำหนด', key: 'expected_days', width: 14 },
    { header: 'มาทำงาน (วัน)', key: 'present', width: 12 },
    { header: 'สาย (ครั้ง)', key: 'late_count', width: 10 },
    { header: 'สายรวม (นาที)', key: 'late_minutes', width: 12 },
    { header: 'ลา (วัน)', key: 'leave_days', width: 10 },
    { header: 'ขาด (วัน)', key: 'absent', width: 10 },
    { header: 'ชั่วโมงทำงานรวม', key: 'hours', width: 14 },
  ], summary);
  sumWs.getColumn('hours').numFmt = '0.00';
  sumWs.getColumn('leave_days').numFmt = '0.0';

  const daily = [...rows].sort((a, b) => (a.emp_code + a.full_name).localeCompare(b.emp_code + b.full_name, 'th') || a.date.localeCompare(b.date));
  const dayWs = addSheet(wb, 'รายวัน', [
    { header: 'วันที่', key: 'date', width: 13 },
    { header: 'รหัส', key: 'emp_code', width: 10 },
    { header: 'ชื่อ-นามสกุล', key: 'full_name', width: 28 },
    { header: 'เข้างาน', key: 'check_in', width: 10 },
    { header: 'ออกงาน', key: 'check_out', width: 10 },
    { header: 'ชั่วโมงทำงาน', key: 'hours', width: 12 },
    { header: 'สาย (นาที)', key: 'late_minutes', width: 11 },
    { header: 'สถานะ', key: 'status', width: 14 },
    { header: 'หมายเหตุ', key: 'note', width: 30 },
  ], daily.map((r) => ({
    ...r,
    date: asDate(r.date),
    late_minutes: r.late_minutes || null,
    status: r.status === 'leave' || r.leave_type
      ? `${STATUS_TH[r.status]}${r.leave_type ? ` (${LEAVE_TH[r.leave_type]}${r.leave_part && r.leave_part !== 'full' ? ' ครึ่งวัน' : ''})` : ''}`
      : STATUS_TH[r.status],
  })));
  dayWs.getColumn('date').numFmt = 'dd/mm/yyyy';
  dayWs.getColumn('hours').numFmt = '0.00';
  for (const col of ['date', 'check_in', 'check_out', 'status']) dayWs.getColumn(col).alignment = { horizontal: 'center' };
  dayWs.eachRow((row, i) => {
    if (i === 1) return;
    const st = row.getCell('status').value || '';
    const color = st.startsWith('สาย') ? 'FFFFF4D6' : st.startsWith('ขาด') ? 'FFFFE0E0' : st.startsWith('ลา') ? 'FFE3F0FF' : null;
    if (color) row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  });

  const leaves = db.prepare(`
    SELECT l.*, u.full_name, u.emp_code FROM leaves l JOIN users u ON u.id = l.user_id
    WHERE l.start_date <= ? AND l.end_date >= ? ${userId ? 'AND l.user_id = ?' : ''}
    ORDER BY l.start_date, u.emp_code`).all(to, from, ...(userId ? [userId] : []));
  const leaveWs = addSheet(wb, 'ใบลา', [
    { header: 'รหัส', key: 'emp_code', width: 10 },
    { header: 'ชื่อ-นามสกุล', key: 'full_name', width: 28 },
    { header: 'ประเภท', key: 'type', width: 13 },
    { header: 'ตั้งแต่', key: 'start_date', width: 13 },
    { header: 'ถึง', key: 'end_date', width: 13 },
    { header: 'ช่วง', key: 'part', width: 13 },
    { header: 'จำนวนวัน', key: 'days', width: 10 },
    { header: 'เหตุผล', key: 'reason', width: 34 },
    { header: 'สถานะ', key: 'status', width: 12 },
    { header: 'หมายเหตุผู้อนุมัติ', key: 'admin_note', width: 28 },
  ], leaves.map((l) => ({
    ...l, type: LEAVE_TH[l.type], part: PART_TH[l.part], status: LEAVE_STATUS_TH[l.status],
    start_date: asDate(l.start_date), end_date: asDate(l.end_date),
  })));
  leaveWs.getColumn('start_date').numFmt = 'dd/mm/yyyy';
  leaveWs.getColumn('end_date').numFmt = 'dd/mm/yyyy';

  res.set({
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="attendance_${from}_${to}.xlsx"`,
    'Cache-Control': 'no-store',
  });
  await wb.xlsx.write(res);
  res.end();
}

module.exports = { sendExcel };
