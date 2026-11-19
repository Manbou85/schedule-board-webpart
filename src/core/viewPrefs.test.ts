import { DENSITIES, DENSITY_LABELS, parseDensity } from './viewPrefs';

describe('表示の大きさ(コンパクト/ふつう/大きめ)', () => {
  it('覚えておいた値をそのまま読む', () => {
    expect(parseDensity('compact')).toBe('compact');
    expect(parseDensity('normal')).toBe('normal');
    expect(parseDensity('large')).toBe('large');
  });

  it('ver 0.7 までの「行の高さ」の覚え方も読む(コンパクトにしていた人はコンパクトのまま)', () => {
    expect(parseDensity(null, '1')).toBe('compact');
    expect(parseDensity(null, '0')).toBe('normal');
    // 今の値があれば、そちらを使う
    expect(parseDensity('large', '1')).toBe('large');
  });

  it('何も覚えていない・読めない値なら undefined(ふつうで表示)', () => {
    expect(parseDensity(null, null)).toBeUndefined();
    expect(parseDensity(undefined)).toBeUndefined();
    expect(parseDensity('huge', 'x')).toBeUndefined();
  });

  it('小さい順に3つ、画面の名前つき', () => {
    expect(DENSITIES.map((d) => DENSITY_LABELS[d])).toEqual(['コンパクト', 'ふつう', '大きめ']);
  });
});
