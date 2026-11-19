// 表示の大きさ(社員がそれぞれ選ぶ設定。ver 0.8.0)
// コンパクト/ふつう/大きめ の3段階。行の高さと文字の大きさを1つの設定にまとめた
// (別々にすると「コンパクト+文字大きめ」のような読みにくい組み合わせができ、選ぶのも迷うため。開発者了承)

/** 表示の大きさ */
export type Density = 'compact' | 'normal' | 'large';

/** 小さい順 */
export const DENSITIES: Density[] = ['compact', 'normal', 'large'];

/** 画面に出す名前 */
export const DENSITY_LABELS: { [key in Density]: string } = {
  compact: 'コンパクト',
  normal: 'ふつう',
  large: '大きめ'
};

/**
 * ブラウザに覚えておいた値 → 表示の大きさ。読めなければ undefined(「ふつう」で表示する)。
 * @param saved 今の覚え方(compact / normal / large)
 * @param legacyCompact ver 0.7 までの覚え方(行の高さ:'1' = コンパクト、'0' = ふつう)。今の値がないときだけ使う
 */
export function parseDensity(saved: string | null | undefined, legacyCompact?: string | null): Density | undefined {
  if (saved === 'compact' || saved === 'normal' || saved === 'large') {
    return saved;
  }
  if (legacyCompact === '1') {
    return 'compact';
  }
  if (legacyCompact === '0') {
    return 'normal';
  }
  return undefined;
}
