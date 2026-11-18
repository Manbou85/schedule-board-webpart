import { formatClock, formatPeriod, formatShortRange, formatVersion } from './format';

describe('画面に出す文字の書き方', () => {
  it('更新時刻は「9:05」の形', () => {
    expect(formatClock(new Date(2026, 10, 18, 9, 5))).toBe('9:05');
    expect(formatClock(new Date(2026, 10, 18, 14, 30))).toBe('14:30');
  });

  it('版の表示は「ver 0.2.0」(4つ目の数字は省く。わからなければ空)', () => {
    expect(formatVersion('0.2.0')).toBe('ver 0.2.0');
    expect(formatVersion('1.3.0.0')).toBe('ver 1.3.0');
    expect(formatVersion('')).toBe('');
    expect(formatVersion(undefined)).toBe('');
    expect(formatVersion('*')).toBe('');
  });

  it('期間は年をまたぐときだけ終わりに年を付ける', () => {
    expect(formatPeriod('2026-11-01', '2026-11-30')).toBe('11/1〜11/30');
    expect(formatPeriod('2026-12-01', '2027-02-14')).toBe('12/1〜2027/2/14');
    expect(formatPeriod('2026-11-17', '2026-11-17')).toBe('11/17');
  });

  it('週の見出し', () => {
    expect(formatShortRange('2026-11-16', '2026-11-22')).toBe('2026年 11/16(月)〜11/22(日)');
    expect(formatShortRange('2026-12-28', '2027-01-03')).toBe('2026年 12/28(月)〜2027年 1/3(日)');
  });
});
