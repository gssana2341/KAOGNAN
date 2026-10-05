// All dates in the DB are stored as UTC ISO strings (timestamps) or local YYYY-MM-DD (work days).
// Thailand has no DST so a fixed offset is enough.
const OFFSET_MIN = Number(process.env.TZ_OFFSET_MIN ?? 420);

function localParts(d = new Date()) {
  const t = new Date(d.getTime() + OFFSET_MIN * 60000).toISOString();
  const [h, m] = [Number(t.slice(11, 13)), Number(t.slice(14, 16))];
  return { date: t.slice(0, 10), time: t.slice(11, 16), minutes: h * 60 + m };
}

function localToIso(dateStr, timeStr) {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const [h, mi] = timeStr.split(':').map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - OFFSET_MIN * 60000).toISOString();
}

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
const isTime = (s) => typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const toMin = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const dow = (dateStr) => new Date(dateStr + 'T00:00:00Z').getUTCDay();

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function* eachDate(from, to) {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

const daysBetween = (from, to) => Math.round((new Date(to + 'T00:00:00Z') - new Date(from + 'T00:00:00Z')) / 86400000);

module.exports = { OFFSET_MIN, localParts, localToIso, isDate, isTime, toMin, dow, addDays, eachDate, daysBetween };
