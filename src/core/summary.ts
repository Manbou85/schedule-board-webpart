// 人数のまとめ(例:今日 在社 12人・外出 5人・現場 20人・休暇 3人)
// 1人ずつ「その日(今日なら今の時点)どこにいるか」を1つの区分にまとめて数える。画面に依存しない。

import { HOLIDAY_WORK_CATEGORY, LEAVE_CATEGORY } from './cellRule';
import { INow } from './quickOut';
import { ICell, IWorker } from './types';

/** 予定が何もない人 */
export const NO_ENTRY_STATUS = '予定なし';

/**
 * 人数のまとめで「休暇」としてまとめて数えるもの。
 * 総務の「休暇」(申請の登録)と、本人が入れた区分「休暇」(ver 0.6 までの「休み」)は、どちらも「いない人」なので1つにする。
 * ver 0.7.0 で呼び方を「休暇」にそろえた(総務の呼び方に合わせる。開発者の要望)
 */
export const DAY_OFF_STATUS = LEAVE_CATEGORY;

/**
 * 1マスを、その人の「状態」(区分)1つにまとめる。
 * - 休暇・休日出勤はそのまま
 * - 単発の予定:今日なら「今の時刻に始まっていて、まだ終わっていない予定」。なければ長期の予定、それもなければ予定なし
 *   (例:15:00 からの外出は、10:00 の時点では数えない)。今日以外の日は、その日のはじめの予定
 * - 長期の予定(作業員の行き先を含む)はその区分
 */
export function cellStatus(cell: ICell, now?: INow): string {
  const c = cell.content;
  switch (c.kind) {
    case 'leave':
      return LEAVE_CATEGORY;
    case 'holidayWork':
      return HOLIDAY_WORK_CATEGORY;
    case 'period':
      return c.entry.category;
    case 'single': {
      const open = c.entries.filter((e) => c.finishedIds.indexOf(e.id) < 0);
      if (now && now.date === cell.date) {
        const active = open.filter((e) => !e.startTime || e.startTime <= now.time);
        if (active.length > 0) {
          return active[active.length - 1].category; // いちばんあとに始まった予定
        }
        return c.underlying ? c.underlying.category : NO_ENTRY_STATUS;
      }
      return (open[0] || c.entries[0]).category;
    }
    default:
      return NO_ENTRY_STATUS;
  }
}

export interface IStatusCount {
  status: string;
  count: number;
  workerIds: number[];
}

/**
 * 人数のまとめを作る。
 * @param dayIndex 表示中のマスの何番目の日を数えるか(週間表示の今日の列など)
 * @param order 並べる順(区分の選択肢の順)。休日出勤・予定なしはうしろに付ける。総務の休暇と本人の区分「休暇」はあわせて数える
 * 数が0の区分は出さない。
 */
export function summarizeStatus(
  workers: IWorker[],
  rows: Map<number, ICell[]>,
  dayIndex: number,
  order: string[],
  now?: INow
): IStatusCount[] {
  const byStatus = new Map<string, number[]>();
  workers.forEach((w) => {
    const cell = (rows.get(w.id) || [])[dayIndex];
    // 総務の休暇も本人の区分「休暇」も、同じ「休暇」で数える
    const status = cell ? cellStatus(cell, now) : NO_ENTRY_STATUS;
    const list = byStatus.get(status) || [];
    list.push(w.id);
    byStatus.set(status, list);
  });
  // 「休暇」は区分の選択肢の位置に(選択肢になければ、休日出勤の前に)
  const fullOrder = order.concat(order.indexOf(DAY_OFF_STATUS) >= 0 ? [] : [DAY_OFF_STATUS]).concat([HOLIDAY_WORK_CATEGORY]);
  byStatus.forEach((_, status) => {
    if (fullOrder.indexOf(status) < 0 && status !== NO_ENTRY_STATUS) {
      fullOrder.push(status); // 選択肢にない区分(作業員の「現場」など)
    }
  });
  fullOrder.push(NO_ENTRY_STATUS);
  const result: IStatusCount[] = [];
  fullOrder.forEach((status) => {
    const ids = byStatus.get(status);
    if (ids && ids.length > 0 && !result.some((r) => r.status === status)) {
      result.push({ status, count: ids.length, workerIds: ids });
    }
  });
  return result;
}
