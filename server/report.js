// Builds the per-day attendance rows (present / late / leave / absent) used by the UI and the Excel export.
const { db } = require('./db');
const { getSettings } = require('./settings');
const { localParts, dow, eachDate, toMin } = require('./time');

const MAX_RANGE_DAYS = 366;

function hhmm(iso) {
  return iso ? localParts(new Date(iso)).time : null;
}

function buildReport({ from, to, userId = null }) {
  const s = getSettings();
  const workdays = new Set(s.workdays);
  const today = localParts().date;

  const users = db.prepare(`SELECT * FROM users WHERE track = 1 ${userId ? 'AND id = ?' : ''} ORDER BY emp_code, full_name`)
    .all(...(userId ? [userId] : []));
  const ids = new Set(users.map((u) => u.id));

  const records = db.prepare(`SELECT * FROM attendance WHERE work_date BETWEEN ? AND ?`).all(from, to).filter((r) => ids.has(r.user_id));
  const recKey = new Map(records.map((r) => [`${r.user_id}|${r.work_date}`, r]));

  const leaves = db.prepare(`SELECT * FROM leaves WHERE status = 'approved' AND start_date <= ? AND end_date >= ?`).all(to, from);
  const leavesBy = new Map();
  for (const l of leaves) {
    if (!leavesBy.has(l.user_id)) leavesBy.set(l.user_id, []);
    leavesBy.get(l.user_id).push(l);
  }

  const hasData = new Set([...records.map((r) => r.user_id), ...leaves.map((l) => l.user_id)]);
  const rows = [];
  const summary = new Map();

  for (const u of users) {
    // inactive staff only show up if they actually have data in the range
    if (!u.active && !hasData.has(u.id)) continue;
    const sum = {
      user_id: u.id, emp_code: u.emp_code, full_name: u.full_name, nickname: u.nickname, position: u.position, active: !!u.active,
      expected_days: 0, present: 0, late_count: 0, late_minutes: 0, leave_days: 0, absent: 0, hours: 0,
    };
    summary.set(u.id, sum);
    const createdDate = localParts(new Date(u.created_at)).date;
    const userLeaves = leavesBy.get(u.id) || [];

    for (const date of eachDate(from, to)) {
      const isWorkday = workdays.has(dow(date));
      const rec = recKey.get(`${u.id}|${date}`);
      const leave = userLeaves.find((l) => l.start_date <= date && l.end_date >= date);
      if (!rec && !leave && (!isWorkday || date > today || date < createdDate || !u.active)) continue;

      const row = {
        date, user_id: u.id, emp_code: u.emp_code, full_name: u.full_name, nickname: u.nickname,
        record_id: rec?.id ?? null, check_in: null, check_out: null, hours: null, late_minutes: 0,
        status: null, leave_type: leave?.type ?? null, leave_part: leave?.part ?? null, note: rec?.note ?? '',
      };

      if (isWorkday && date <= today && date >= createdDate && u.active) sum.expected_days++;
      if (leave && isWorkday) sum.leave_days += leave.part === 'full' ? 1 : 0.5;

      if (rec) {
        row.check_in = hhmm(rec.check_in);
        row.check_out = hhmm(rec.check_out);
        row.late_minutes = rec.late_minutes;
        if (rec.check_in && rec.check_out) {
          row.hours = Math.round(((new Date(rec.check_out) - new Date(rec.check_in)) / 3600000) * 100) / 100;
          sum.hours += row.hours;
        }
        row.status = rec.late_minutes > 0 ? 'late' : 'present';
        sum.present++;
        if (rec.late_minutes > 0) { sum.late_count++; sum.late_minutes += rec.late_minutes; }
      } else if (leave) {
        row.status = 'leave';
      } else if (date < today) {
        row.status = 'absent';
        sum.absent++;
      } else {
        row.status = 'pending';
      }
      rows.push(row);
    }
    sum.hours = Math.round(sum.hours * 100) / 100;
  }
  return { rows, summary: [...summary.values()], settings: s };
}

function lateMinutes(checkInIso, s = getSettings()) {
  const mins = localParts(new Date(checkInIso)).minutes;
  const limit = toMin(s.work_start) + s.late_grace_min;
  return mins > limit ? mins - toMin(s.work_start) : 0;
}

module.exports = { buildReport, lateMinutes, hhmm, MAX_RANGE_DAYS };
