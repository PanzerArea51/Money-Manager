import { describe, expect, it } from 'vitest';
import { addDays, nowLocalTime, parseLocalDate, parseLocalTime, todayLocal, weekday } from './date';
import { isWithin, periodFor, shiftPeriod, weekEnd, weekStart } from './week';

describe('parseLocalDate', () => {
  it.each(['2025-02-30', '2023-02-29', '2025-04-31', '2025-13-01', '2025-00-10', '2025-01-00', '2025-1-01', '25-01-01', '', '2025-01-01T00:00'])(
    'rejects %j',
    (s) => {
      expect(parseLocalDate(s)).toEqual({ ok: false, error: 'invalid-date' });
    },
  );

  it.each(['2024-02-29', '2000-02-29', '2025-12-31'])('accepts %s', (s) => {
    expect(parseLocalDate(s)).toEqual({ ok: true, value: s });
  });

  it('rejects Feb 29 in century non-leap year 1900', () => {
    expect(parseLocalDate('1900-02-29').ok).toBe(false);
  });
});

describe('parseLocalTime', () => {
  it.each(['00:00', '23:59', '12:30'])('accepts %s', (s) => {
    expect(parseLocalTime(s)).toEqual({ ok: true, value: s });
  });

  it.each(['24:00', '12:60', '1:30', '12:5', '', '12:30:00', 'ab:cd'])('rejects %j', (s) => {
    expect(parseLocalTime(s)).toEqual({ ok: false, error: 'invalid-time' });
  });
});

describe('local clock helpers', () => {
  it('uses local getters, not UTC', () => {
    const d = new Date(2025, 0, 1, 0, 5);
    expect(todayLocal(d)).toBe('2025-01-01');
    expect(nowLocalTime(d)).toBe('00:05');
  });
});

describe('weekday and weeks (Monday start)', () => {
  it('Sunday to Monday transition starts a new week', () => {
    expect(weekday('2025-01-05')).toBe(0);
    expect(weekday('2025-01-06')).toBe(1);
    expect(weekStart('2025-01-05')).toBe('2024-12-30');
    expect(weekEnd('2025-01-05')).toBe('2025-01-05');
    expect(weekStart('2025-01-06')).toBe('2025-01-06');
    expect(weekEnd('2025-01-06')).toBe('2025-01-12');
  });

  it('week period is inclusive of Monday and Sunday', () => {
    const p = periodFor('week', '2025-01-08');
    expect(p).toEqual({ unit: 'week', start: '2025-01-06', end: '2025-01-12' });
    expect(isWithin('2025-01-05', p)).toBe(false);
    expect(isWithin('2025-01-06', p)).toBe(true);
    expect(isWithin('2025-01-12', p)).toBe(true);
    expect(isWithin('2025-01-13', p)).toBe(false);
  });
});

describe('addDays across boundaries', () => {
  it('last day of a 28-day February', () => {
    expect(addDays('2023-02-28', 1)).toBe('2023-03-01');
    expect(addDays('2023-03-01', -1)).toBe('2023-02-28');
  });

  it('last day of a 29-day February (leap year)', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
  });

  it('last day of a 30-day month', () => {
    expect(addDays('2025-04-30', 1)).toBe('2025-05-01');
  });

  it('last day of a 31-day month', () => {
    expect(addDays('2025-01-31', 1)).toBe('2025-02-01');
  });

  it('December 31 to January 1', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
});

describe('month periods', () => {
  it.each([
    ['2023-02-10', '2023-02-01', '2023-02-28'],
    ['2024-02-10', '2024-02-01', '2024-02-29'],
    ['2025-04-15', '2025-04-01', '2025-04-30'],
    ['2025-01-31', '2025-01-01', '2025-01-31'],
    ['2025-12-31', '2025-12-01', '2025-12-31'],
  ])('month of %s spans %s to %s', (anchor, start, end) => {
    expect(periodFor('month', anchor)).toEqual({ unit: 'month', start, end });
  });

  it('includes the last day and excludes the next day', () => {
    const feb = periodFor('month', '2024-02-10');
    expect(isWithin('2024-02-29', feb)).toBe(true);
    expect(isWithin('2024-03-01', feb)).toBe(false);
    expect(isWithin('2024-01-31', feb)).toBe(false);
  });

  it('shifts across December to January and back', () => {
    const dec = periodFor('month', '2025-12-31');
    expect(shiftPeriod(dec, 1)).toEqual({ unit: 'month', start: '2026-01-01', end: '2026-01-31' });
    expect(shiftPeriod(periodFor('month', '2026-01-01'), -1)).toEqual(dec);
  });

  it('shifts from a 31-day month into a short February without overflow', () => {
    expect(shiftPeriod(periodFor('month', '2025-01-31'), 1)).toEqual({ unit: 'month', start: '2025-02-01', end: '2025-02-28' });
    expect(shiftPeriod(periodFor('month', '2024-03-31'), -1)).toEqual({ unit: 'month', start: '2024-02-01', end: '2024-02-29' });
  });
});

describe('day and week shifting', () => {
  it('shifts a day across the year boundary', () => {
    expect(shiftPeriod(periodFor('day', '2025-12-31'), 1)).toEqual({ unit: 'day', start: '2026-01-01', end: '2026-01-01' });
  });

  it('shifts a week by seven days across the year boundary', () => {
    const w = periodFor('week', '2025-12-31');
    expect(w).toEqual({ unit: 'week', start: '2025-12-29', end: '2026-01-04' });
    expect(shiftPeriod(w, 1)).toEqual({ unit: 'week', start: '2026-01-05', end: '2026-01-11' });
  });
});
