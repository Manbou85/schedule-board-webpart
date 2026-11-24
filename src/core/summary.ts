// 人数のまとめのボタン(ver 0.9.0 から数は出さず、区分ですぐ絞り込むボタンにした。開発者の要望)
// その日(週表示は今日、日表示はその日)に、どの区分の予定がある人がいるかを集める。画面に依存しない。
//
// ver 0.8 までは「今の時刻にどこにいるか」を1人1つに決めて数えていたが、半日の休暇・早退・作業員の2現場などで
// 1つに決めにくく、数がずれることがあった。そのため「その日にその区分の予定がある人」で絞り込むだけにした
// (午前は現場で午後休の人は、「現場」でも「休暇」でも出る)。

import { cellCategories, HOLIDAY_WORK_CATEGORY, LEAVE_CATEGORY } from './cellRule';
import { startOfWeek } from './dateUtils';
import { DateKey, ICell, IWorker } from './types';

/** 予定が何もない人 */
export const NO_ENTRY_STATUS = '予定なし';

/** ボタン1つ:区分と、その区分の予定がある人 */
export interface IStatusChip {
  status: string;
  workerIds: number[];
}

/**
 * その日の区分ごとのボタンを作る。
 * @param dayIndex 表示中のマスの何番目の日か(週表示の今日の列など)
 * @param order 並べる順(区分の選択肢の順)。休暇は選択肢の位置(なければ休日出勤の前)、休日出勤・予定なしはうしろ
 * 予定がある人がいない区分は出さない。
 */
export function summarizeCategories(workers: IWorker[], rows: Map<number, ICell[]>, dayIndex: number, order: string[]): IStatusChip[] {
  const byStatus = new Map<string, number[]>();
  const add = (status: string, id: number): void => {
    const list = byStatus.get(status) || [];
    list.push(id);
    byStatus.set(status, list);
  };
  workers.forEach((w) => {
    const cell = (rows.get(w.id) || [])[dayIndex];
    const categories = cell ? cellCategories(cell) : [];
    if (categories.length === 0) {
      add(NO_ENTRY_STATUS, w.id);
    } else {
      categories.forEach((c) => add(c, w.id));
    }
  });
  const fullOrder = order
    .concat(order.indexOf(LEAVE_CATEGORY) >= 0 ? [] : [LEAVE_CATEGORY])
    .concat([HOLIDAY_WORK_CATEGORY]);
  byStatus.forEach((_, status) => {
    if (fullOrder.indexOf(status) < 0 && status !== NO_ENTRY_STATUS) {
      fullOrder.push(status); // 選択肢にない区分(作業員の「現場」など)
    }
  });
  fullOrder.push(NO_ENTRY_STATUS);
  const result: IStatusChip[] = [];
  fullOrder.forEach((status) => {
    const ids = byStatus.get(status);
    if (ids && ids.length > 0 && !result.some((r) => r.status === status)) {
      result.push({ status, workerIds: ids });
    }
  });
  return result;
}

/**
 * 区分のボタンが対象にする日。日表示はその日、週間表示は今日がその週にあれば今日、なければ ''(ボタンを出さない)。
 * ボタンでしぼったあと、この日が変わったらしぼり込みを外す(別の週へ行って戻ったときに、見えないしぼり込みが残らないように。ver 0.9.2)
 */
export function summaryDateFor(view: 'week' | 'day', date: DateKey, today: DateKey): DateKey {
  if (view === 'day') {
    return date;
  }
  return startOfWeek(today) === startOfWeek(date) ? today : '';
}
