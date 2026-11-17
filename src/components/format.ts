// 画面に出す日付の書き方

import { DateKey, dayOfWeek, parseDateKey } from '../core';

export const WEEKDAY_LABELS: string[] = ['日', '月', '火', '水', '木', '金', '土'];

/** '2026-11-17' → '11/17' */
export function formatMonthDay(key: DateKey): string {
  const d = parseDateKey(key);
  return d.getUTCMonth() + 1 + '/' + d.getUTCDate();
}

/** '2026-11-17' → '火' */
export function formatWeekday(key: DateKey): string {
  return WEEKDAY_LABELS[dayOfWeek(key)];
}

/** '2026-11-17' → '2026年11月17日(火)' */
export function formatLongDate(key: DateKey): string {
  const d = parseDateKey(key);
  return d.getUTCFullYear() + '年' + (d.getUTCMonth() + 1) + '月' + d.getUTCDate() + '日(' + formatWeekday(key) + ')';
}

/** 週の見出し:'2026年11月16日(月)〜11月22日(日)'(年をまたぐときは両方に年を付ける) */
export function formatWeekLabel(start: DateKey, end: DateKey): string {
  const s = parseDateKey(start);
  const e = parseDateKey(end);
  const endText =
    s.getUTCFullYear() === e.getUTCFullYear()
      ? e.getUTCMonth() + 1 + '月' + e.getUTCDate() + '日(' + formatWeekday(end) + ')'
      : formatLongDate(end);
  return formatLongDate(start) + '〜' + endText;
}

/** 期間の説明:'11/1〜11/30'(年をまたぐときは終わりに年を付ける:'12/1〜2027/2/14') */
export function formatPeriod(start: DateKey, end: DateKey): string {
  if (start === end) {
    return formatMonthDay(start);
  }
  const endText = start.substring(0, 4) === end.substring(0, 4) ? formatMonthDay(end) : end.substring(0, 4) + '/' + formatMonthDay(end);
  return formatMonthDay(start) + '〜' + endText;
}

/** ツールバー用の短い書き方:'2026年 11/17(火)' */
export function formatShortDate(key: DateKey): string {
  return key.substring(0, 4) + '年 ' + formatMonthDay(key) + '(' + formatWeekday(key) + ')';
}

/** ツールバー用の短い週の書き方:'2026年 11/16(月)〜11/22(日)'(年をまたぐときは終わりにも年) */
export function formatShortRange(start: DateKey, end: DateKey): string {
  const endText =
    (start.substring(0, 4) === end.substring(0, 4) ? '' : end.substring(0, 4) + '年 ') +
    formatMonthDay(end) +
    '(' +
    formatWeekday(end) +
    ')';
  return formatShortDate(start) + '〜' + endText;
}
