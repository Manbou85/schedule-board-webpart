import {
  addDays,
  dateRange,
  dayOfWeek,
  formatTimeRange,
  isDateInPeriod,
  isValidDateKey,
  normalizeEndDate,
  overlapsRange,
  startOfWeek,
  todayKey,
  weekDates
} from './dateUtils';

describe('日付の計算', () => {
  it('日付の形式をチェックする(存在しない日は不可)', () => {
    expect(isValidDateKey('2026-11-17')).toBe(true);
    expect(isValidDateKey('2026-02-30')).toBe(false);
    expect(isValidDateKey('2026/11/17')).toBe(false);
    expect(isValidDateKey('')).toBe(false);
  });

  it('日を足し引きできる(月・年・うるう年をまたぐ)', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('曜日がわかる', () => {
    expect(dayOfWeek('2026-11-17')).toBe(2); // 火曜
    expect(dayOfWeek('2026-11-22')).toBe(0); // 日曜
  });

  it('週の始まりは月曜(日曜は前の月曜の週)', () => {
    expect(startOfWeek('2026-11-17')).toBe('2026-11-16');
    expect(startOfWeek('2026-11-16')).toBe('2026-11-16');
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16');
    expect(weekDates('2026-11-22')).toEqual([
      '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'
    ]);
    expect(dateRange('2026-12-30', 3)).toEqual(['2026-12-30', '2026-12-31', '2027-01-01']);
  });

  it('今日の日付をパソコンの時計から作る', () => {
    expect(todayKey(new Date(2026, 10, 7, 23, 59))).toBe('2026-11-07');
  });
});

describe('期間判定', () => {
  it('開始日・終了日を含めて期間内と判定する', () => {
    expect(isDateInPeriod('2026-11-16', '2026-11-16', '2026-11-20')).toBe(true);
    expect(isDateInPeriod('2026-11-20', '2026-11-16', '2026-11-20')).toBe(true);
    expect(isDateInPeriod('2026-11-21', '2026-11-16', '2026-11-20')).toBe(false);
    expect(isDateInPeriod('2026-11-15', '2026-11-16', '2026-11-20')).toBe(false);
  });

  it('終了日が空や開始日より前なら、開始日だけの予定とみなす', () => {
    expect(normalizeEndDate('2026-11-16', undefined)).toBe('2026-11-16');
    expect(normalizeEndDate('2026-11-16', '2026-11-10')).toBe('2026-11-16');
    expect(isDateInPeriod('2026-11-16', '2026-11-16', '2026-11-10')).toBe(true);
    expect(isDateInPeriod('2026-11-17', '2026-11-16', '2026-11-10')).toBe(false);
  });

  it('表示する週に1日でもかかる予定を見つける', () => {
    const s = '2026-11-16';
    const e = '2026-11-22';
    expect(overlapsRange('2026-10-01', '2026-11-16', s, e)).toBe(true); // 最終日が週の初日
    expect(overlapsRange('2026-11-22', '2026-12-31', s, e)).toBe(true); // 開始日が週の最終日
    expect(overlapsRange('2026-10-01', '2026-12-31', s, e)).toBe(true); // 週をまたぐ長期
    expect(overlapsRange('2026-10-01', '2026-11-15', s, e)).toBe(false);
    expect(overlapsRange('2026-11-23', '2026-11-30', s, e)).toBe(false);
  });

  it('時刻の表示を作る', () => {
    expect(formatTimeRange('08:00', '17:30')).toBe('08:00-17:30');
    expect(formatTimeRange('09:00', '')).toBe('09:00-');
    expect(formatTimeRange(undefined, '15:00')).toBe('-15:00');
    expect(formatTimeRange(' ', undefined)).toBe('');
  });
});
