import type { LocalDate, LocalTime, Result } from './types';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

type Ymd = { year: number; month: number; day: number };

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** Days since 1970-01-01 (civil-calendar algorithm). */
function toDayNumber({ year, month, day }: Ymd): number {
  const y = month <= 2 ? year - 1 : year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

function fromDayNumber(days: number): Ymd {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

function formatYmd({ year, month, day }: Ymd): LocalDate {
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** Splits a date already known to be valid. */
export function splitDate(d: LocalDate): Ymd {
  const match = DATE_PATTERN.exec(d);
  if (match === null) throw new RangeError(`Invalid local date: ${d}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

export function makeDate(year: number, month: number, day: number): LocalDate {
  return formatYmd({ year, month, day });
}

export function parseLocalDate(s: string): Result<LocalDate, 'invalid-date'> {
  const match = DATE_PATTERN.exec(s);
  if (match === null) return { ok: false, error: 'invalid-date' };
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    return { ok: false, error: 'invalid-date' };
  }
  return { ok: true, value: s };
}

export function parseLocalTime(s: string): Result<LocalTime, 'invalid-time'> {
  const match = TIME_PATTERN.exec(s);
  if (match === null) return { ok: false, error: 'invalid-time' };
  if (Number(match[1]) > 23 || Number(match[2]) > 59) return { ok: false, error: 'invalid-time' };
  return { ok: true, value: s };
}

export function addDays(d: LocalDate, n: number): LocalDate {
  return formatYmd(fromDayNumber(toDayNumber(splitDate(d)) + n));
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekday(d: LocalDate): number {
  // 1970-01-01 was a Thursday (4).
  return (((toDayNumber(splitDate(d)) + 4) % 7) + 7) % 7;
}

/** Local calendar date from the system clock. Uses local getters, never toISOString. */
export function todayLocal(now: Date = new Date()): LocalDate {
  return makeDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function nowLocalTime(now: Date = new Date()): LocalTime {
  return `${pad(now.getHours(), 2)}:${pad(now.getMinutes(), 2)}`;
}
