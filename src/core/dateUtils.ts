// 日付の計算(期間判定・週の計算など)
// 日付は 'YYYY-MM-DD' の文字列で扱い、計算するときだけ UTC の Date に変換する。
// (UTC=世界標準時。パソコンの時差設定に左右されないようにするため)

import { DateKey } from './types';

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/** 正しい 'YYYY-MM-DD' かどうか(2月30日などの存在しない日は false) */
export function isValidDateKey(value: string): boolean {
  const m = DATE_KEY_PATTERN.exec(value);
  if (!m) {
    return false;
  }
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return toDateKey(d) === value;
}

/** 'YYYY-MM-DD' → Date(UTC の 0時) */
export function parseDateKey(key: DateKey): Date {
  const m = DATE_KEY_PATTERN.exec(key);
  if (!m) {
    throw new Error('日付の形式が正しくありません: ' + key);
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Date(UTC)→ 'YYYY-MM-DD' */
export function toDateKey(date: Date): DateKey {
  return date.getUTCFullYear() + '-' + pad2(date.getUTCMonth() + 1) + '-' + pad2(date.getUTCDate());
}

/** パソコンの時計の「今日」(日本時間で使う想定)を 'YYYY-MM-DD' で返す */
export function todayKey(now: Date = new Date()): DateKey {
  return now.getFullYear() + '-' + pad2(now.getMonth() + 1) + '-' + pad2(now.getDate());
}

/** n 日後(マイナスなら n 日前) */
export function addDays(key: DateKey, n: number): DateKey {
  return toDateKey(new Date(parseDateKey(key).getTime() + n * MS_PER_DAY));
}

/** 曜日(0=日曜 … 6=土曜) */
export function dayOfWeek(key: DateKey): number {
  return parseDateKey(key).getUTCDay();
}

/** 土曜または日曜なら true */
export function isWeekend(key: DateKey): boolean {
  const w = dayOfWeek(key);
  return w === 0 || w === 6;
}

/** その日を含む週の月曜日 */
export function startOfWeek(key: DateKey): DateKey {
  const w = dayOfWeek(key);
  // 月曜=1。日曜(0)は前の週の月曜までさかのぼる(6日前)
  const back = w === 0 ? 6 : w - 1;
  return addDays(key, -back);
}

/** 開始日から n 日分の日付の並び(週間表示なら n=7) */
export function dateRange(start: DateKey, n: number): DateKey[] {
  const result: DateKey[] = [];
  for (let i = 0; i < n; i++) {
    result.push(addDays(start, i));
  }
  return result;
}

/** その日を含む週(月〜日)の7日分 */
export function weekDates(key: DateKey): DateKey[] {
  return dateRange(startOfWeek(key), 7);
}

/**
 * 終了日が空、または開始日より前のときは開始日にそろえる(入力ミスへの備え)。
 * 'YYYY-MM-DD' は文字列のまま大小を比べても日付の前後と一致する。
 */
export function normalizeEndDate(startDate: DateKey, endDate: DateKey | undefined): DateKey {
  if (!endDate || endDate < startDate) {
    return startDate;
  }
  return endDate;
}

/** day が 期間(開始日〜終了日、両端を含む)の中にあるか */
export function isDateInPeriod(day: DateKey, startDate: DateKey, endDate: DateKey | undefined): boolean {
  return startDate <= day && day <= normalizeEndDate(startDate, endDate);
}

/**
 * 期間が表示範囲に1日でもかかっているか。
 * 「開始日 ≦ 範囲の最終日 かつ 終了日 ≧ 範囲の初日」(リストから取り出す条件と同じ)
 */
export function overlapsRange(
  startDate: DateKey,
  endDate: DateKey | undefined,
  rangeStart: DateKey,
  rangeEnd: DateKey
): boolean {
  return startDate <= rangeEnd && normalizeEndDate(startDate, endDate) >= rangeStart;
}

/**
 * 時刻の書き方をそろえる(全角→半角、「9:30」→「09:30」、「9時30分」は対象外でそのまま)。
 * 時刻は文字のまま比べるため、リストに直接入力された「9:30」や「０９：３０」でも正しく比べられるようにする
 */
export function normalizeTime(value: string | undefined): string {
  const t = (value || '').normalize('NFKC').trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  return m ? (m[1].length === 1 ? '0' : '') + m[1] + ':' + m[2] : t;
}

/** 時刻の表示(例 '08:00-17:30'、'09:00-'、'-15:00')。どちらもなければ空文字 */
export function formatTimeRange(startTime?: string, endTime?: string): string {
  const s = (startTime || '').trim();
  const e = (endTime || '').trim();
  if (!s && !e) {
    return '';
  }
  return s + '-' + e;
}
