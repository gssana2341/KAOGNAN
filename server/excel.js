const ExcelJS = require('exceljs');
const { db } = require('./db');
const { buildReport } = require('./report');

// Everything the workbook says, in both languages (?lang=en on the export URL; Thai is the default).
const TEXT = {
  th: {
    sheets: { summary: 'สรุปรายคน', daily: 'รายวัน', leaves: 'ใบลา' },
    status: { present: 'ปกติ', late: 'สาย', leave: 'ลา', absent: 'ขาด', pending: 'ยังไม่เข้า' },
    leaveType: { sick: 'ลาป่วย', personal: 'ลากิจ', vacation: 'ลาพักร้อน', other: 'อื่นๆ' },
    part: { full: 'เต็มวัน', am: 'ครึ่งวันเช้า', pm: 'ครึ่งวันบ่าย' },
    leaveStatus: { pending: 'รออนุมัติ', approved: 'อนุมัติ', rejected: 'ไม่อนุมัติ', cancelled: 'ยกเลิก' },
    halfDay: 'ครึ่งวัน',
    summaryCols: ['รหัส', 'ชื่อ-นามสกุล', 'ชื่อเล่น', 'ตำแหน่ง', 'วันทำงานตามกำหนด', 'มาทำงาน (วัน)', 'สาย (ครั้ง)', 'สายรวม (นาที)', 'ลา (วัน)', 'ขาด (วัน)', 'ชั่วโมงทำงานรวม'],
    dailyCols: ['วันที่', 'รหัส', 'ชื่อ-นามสกุล', 'เข้างาน', 'ออกงาน', 'ชั่วโมงทำงาน', 'สาย (นาที)', 'สถานะ', 'หมายเหตุ'],
    leaveCols: ['รหัส', 'ชื่อ-นามสกุล', 'ประเภท', 'ตั้งแต่', 'ถึง', 'ช่วง', 'จำนวนวัน', 'เหตุผล', 'สถานะ', 'หมายเหตุผู้อนุมัติ'],
    collate: 'th',
  },
  en: {
    sheets: { summary: 'Summary', daily: 'Daily', leaves: 'Leaves' },
    status: { present: 'Present', late: 'Late', leave: 'Leave', absent: 'Absent', pending: 'Not in yet' },
    leaveType: { sick: 'Sick leave', personal: 'Personal leave', vacation: 'Vacation', other: 'Other' },
    part: { full: 'Full day', am: 'Morning half-day', pm: 'Afternoon half-day' },
    leaveStatus: { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', cancelled: 'Cancelled' },
    halfDay: 'half day',
    summaryCols: ['Code', 'Full name', 'Nickname', 'Position', 'Scheduled days', 'Days present', 'Late (times)', 'Late total (min)', 'Leave (days)', 'Absent (days)', 'Total hours worked'],
    dailyCols: ['Date', 'Code', 'Full name', 'Check in', 'Check out', 'Hours worked', 'Late (min)', 'Status', 'Note'],
    leaveCols: ['Code', 'Full name', 'Type', 'From', 'To', 'Period', 'Days', 'Reason', 'Status', 'Approver note'],
    collate: 'en',
  },
};

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD6E7' } };
const STATUS_FILL = { late: 'FFFFF4D6', absent: 'FFFFE0E0', leave: 'FFE3F0FF' };
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

const cols = (headers, keys, widths) => keys.map((key, i) => ({ header: headers[i], key, width: widths[i] }));

async function sendExcel(res, { from, to, userId, lang = 'th' }) {
  const L = TEXT[lang] ?? TEXT.th;
  const { rows, summary, settings } = await buildReport({ from, to, userId });
  const wb = new ExcelJS.Workbook();
  wb.creator = settings.company_name;
  wb.created = new Date();

  const sumWs = addSheet(wb, L.sheets.summary, cols(L.summaryCols,
    ['emp_code', 'full_name', 'nickname', 'position', 'expected_days', 'present', 'late_count', 'late_minutes', 'leave_days', 'absent', 'hours'],
    [10, 28, 12, 18, 14, 12, 10, 12, 10, 10, 14]), summary);
  sumWs.getColumn('hours').numFmt = '0.00';
  sumWs.getColumn('leave_days').numFmt = '0.0';

  const daily = [...rows].sort((a, b) => (a.emp_code + a.full_name).localeCompare(b.emp_code + b.full_name, L.collate) || a.date.localeCompare(b.date));
  const dayWs = addSheet(wb, L.sheets.daily, cols(L.dailyCols,
    ['date', 'emp_code', 'full_name', 'check_in', 'check_out', 'hours', 'late_minutes', 'status', 'note'],
    [13, 10, 28, 10, 10, 12, 11, 14, 30]), daily.map((r) => ({
    ...r,
    date: asDate(r.date),
    late_minutes: r.late_minutes || null,
    status: r.status === 'leave' || r.leave_type
      ? `${L.status[r.status]}${r.leave_type ? ` (${L.leaveType[r.leave_type]}${r.leave_part && r.leave_part !== 'full' ? ` ${L.halfDay}` : ''})` : ''}`
      : L.status[r.status],
  })));
  dayWs.getColumn('date').numFmt = 'dd/mm/yyyy';
  dayWs.getColumn('hours').numFmt = '0.00';
  for (const col of ['date', 'check_in', 'check_out', 'status']) dayWs.getColumn(col).alignment = { horizontal: 'center' };
  dayWs.eachRow((row, i) => {
    if (i === 1) return;
    const color = STATUS_FILL[daily[i - 2].status];
    if (color) row.getCell('status').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: color } };
  });

  const leaves = await db.all(`
    SELECT l.*, u.full_name, u.emp_code FROM leaves l JOIN users u ON u.id = l.user_id
    WHERE l.start_date <= ? AND l.end_date >= ? ${userId ? 'AND l.user_id = ?' : ''}
    ORDER BY l.start_date, u.emp_code`, [to, from, ...(userId ? [userId] : [])]);
  const leaveWs = addSheet(wb, L.sheets.leaves, cols(L.leaveCols,
    ['emp_code', 'full_name', 'type', 'start_date', 'end_date', 'part', 'days', 'reason', 'status', 'admin_note'],
    [10, 28, 13, 13, 13, 13, 10, 34, 12, 28]), leaves.map((l) => ({
    ...l, type: L.leaveType[l.type], part: L.part[l.part], status: L.leaveStatus[l.status],
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
