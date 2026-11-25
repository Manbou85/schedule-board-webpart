// 「ちょっと外出」→「帰社しました」の計算(画面に依存しない)
//
// - 出かけるとき:1日だけ・外出・開始=今の時刻・戻り=選んだ時間 の予定を作る
// - 戻ったとき :戻りの時刻を「今」に直す
// - 戻りの時刻を過ぎた今日の単発予定は「終わった予定」として薄く表示する(cellRule.ts)

import { DateKey, IScheduleEntry } from './types';

/** 「ちょっと外出」で登録する区分 */
export const QUICK_OUT_CATEGORY = '外出';
/** 行き先が空欄のときの行き先 */
export const QUICK_OUT_DEFAULT_TITLE = '外出';
/** 直帰のとき、行き先のうしろに付ける文字 */
export const DIRECT_RETURN_SUFFIX = '(直帰)';

export type ReturnOptionKey = '30m' | '1h' | '2h' | 'direct' | 'undecided';

export interface IReturnOption {
  key: ReturnOptionKey;
  /** ボタンの文字 */
  label: string;
  /** 何分後に戻るか(直帰・未定は undefined) */
  minutes?: number;
}

/** 戻りの選択肢(開発者回答:30分/1時間/2時間/直帰/未定) */
export const RETURN_OPTIONS: IReturnOption[] = [
  { key: '30m', label: '30分', minutes: 30 },
  { key: '1h', label: '1時間', minutes: 60 },
  { key: '2h', label: '2時間', minutes: 120 },
  { key: 'direct', label: '直帰' },
  { key: 'undecided', label: '未定' }
];

/** 今の日時(日付と 'HH:MM')。終わった予定の判定に使う */
export interface INow {
  date: DateKey;
  time: string;
}

function pad2(n: number): string {
  return (n < 10 ? '0' : '') + n;
}

function toMinutes(time: string): number {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

function fromMinutes(total: number): string {
  // 日をまたぐときは 23:59 で止める(1日だけの予定のため)
  const m = Math.max(0, Math.min(total, 23 * 60 + 59));
  return pad2(Math.floor(m / 60)) + ':' + pad2(m % 60);
}

/** Date → 'HH:MM' */
export function timeOf(d: Date): string {
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

/** 開始時刻:今の時刻を5分単位に切り下げる(例 10:07 → 10:05) */
export function quickStartTime(now: Date): string {
  return fromMinutes(Math.floor(toMinutes(timeOf(now)) / 5) * 5);
}

/** 戻りの時刻:今から◯分後を5分単位に切り上げる(例 10:07 の30分後 → 10:40) */
export function quickReturnTime(now: Date, minutes: number): string {
  return fromMinutes(Math.ceil((toMinutes(timeOf(now)) + minutes) / 5) * 5);
}

/** 「ちょっと外出」で登録する予定を作る */
export function quickOutEntry(
  workerId: number,
  date: DateKey,
  now: Date,
  place: string,
  option: IReturnOption
): Omit<IScheduleEntry, 'id'> {
  let title = place.trim() || QUICK_OUT_DEFAULT_TITLE;
  if (option.key === 'direct' && title.indexOf(DIRECT_RETURN_SUFFIX) < 0) {
    title += DIRECT_RETURN_SUFFIX;
  }
  const entry: Omit<IScheduleEntry, 'id'> = {
    workerId,
    entryType: 'single',
    category: QUICK_OUT_CATEGORY,
    title,
    startDate: date,
    endDate: date,
    startTime: quickStartTime(now)
  };
  if (option.minutes !== undefined) {
    entry.endTime = quickReturnTime(now, option.minutes);
  }
  return entry;
}

/**
 * いま外出中の予定を探す(「帰社しました」ボタンを出すかどうか)。
 * 今日の・本人の・1日だけの「外出」で、開始時刻があって始まっていて、まだ戻りの時刻が来ていないもの。
 * 開始時刻のない外出(前の日に入れておいた「客先」など)は、外出中にしない(会社にいる朝から「帰社しました」が出ないように)。
 * 「ちょっと外出」は、いつも開始時刻を入れて登録する。
 * 複数あれば、いちばんあとに始まったもの。
 */
export function findActiveOuting(entries: IScheduleEntry[], workerId: number, now: INow): IScheduleEntry | undefined {
  let found: IScheduleEntry | undefined;
  entries.forEach((e) => {
    if (
      e.workerId === workerId &&
      e.entryType === 'single' &&
      e.category.trim() === QUICK_OUT_CATEGORY &&
      e.startDate === now.date &&
      !!e.startTime &&
      e.startTime <= now.time &&
      (!e.endTime || e.endTime > now.time)
    ) {
      if (!found || (e.startTime || '') > (found.startTime || '') || ((e.startTime || '') === (found.startTime || '') && e.id > found.id)) {
        found = e;
      }
    }
  });
  return found;
}

/** 「帰社しました」:戻りの時刻を今に直す。直帰の予定だったら「(直帰)」を外す */
export function returnedEntry(entry: IScheduleEntry, now: Date): IScheduleEntry {
  let end = timeOf(now);
  // 開始時刻より前にはしない(同じ分に押したときなど)
  if (entry.startTime && end < entry.startTime) {
    end = entry.startTime;
  }
  const title = entry.title.replace(DIRECT_RETURN_SUFFIX, '').trim() || QUICK_OUT_DEFAULT_TITLE;
  return { ...entry, title, endTime: end };
}

/** 今日の単発予定で、戻り(終了)の時刻を過ぎたもの(薄く表示する) */
export function isFinishedEntry(entry: IScheduleEntry, now: INow | undefined): boolean {
  return (
    !!now &&
    entry.entryType === 'single' &&
    entry.startDate === now.date &&
    !!entry.endTime &&
    entry.endTime <= now.time
  );
}
