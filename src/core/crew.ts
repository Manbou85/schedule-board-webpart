// 作業員の行き先リスト(別サイト)の扱い(画面に依存しない)
//
// - 作業員の列は「選択肢」(名前の文字)なので、WorkerNameList の名前と文字で突き合わせる
//   (全角・半角や、名字と名前のあいだの空白のちがいは気にしない)
// - 期間(開始日〜終了日)の予定として、行動予定表の「長期の予定」と同じく帯で表示する
// - 表示の優先:総務の休暇 > 総務の休日出勤 > 単発の予定 > 作業員の行き先 > 長期の予定(cellRule.ts)

import { normalizeEndDate } from './dateUtils';
import { ICrewAssignment, IScheduleEntry, IWorker } from './types';

/** 作業員の行き先を表示するときの区分(アイコンと色) */
export const CREW_CATEGORY = '現場';

/** 名前を突き合わせるための形:全角・半角をそろえ、空白をすべて取る */
export function nameKey(name: string): string {
  return (name || '').normalize('NFKC').replace(/\s+/g, '');
}

/**
 * 作業員の行き先 → 予定表の予定(読み取り専用の長期の予定)。
 * 名前が WorkerNameList の誰とも合わない行は使わない(unmatched に名前を返す)。
 * ID は行動予定と重ならないよう、マイナスにする。
 */
export function crewToEntries(
  list: ICrewAssignment[],
  workers: IWorker[]
): { entries: IScheduleEntry[]; unmatched: string[] } {
  const byName = new Map<string, number>();
  workers.forEach((w) => {
    const key = nameKey(w.name);
    if (key && !byName.has(key)) {
      byName.set(key, w.id);
    }
  });
  const entries: IScheduleEntry[] = [];
  const unmatched: string[] = [];
  list.forEach((a) => {
    const workerId = byName.get(nameKey(a.workerName));
    if (workerId === undefined) {
      const name = a.workerName.trim();
      if (name && unmatched.indexOf(name) < 0) {
        unmatched.push(name);
      }
      return;
    }
    entries.push({
      id: -a.id,
      workerId,
      title: a.title.trim(),
      entryType: 'period',
      category: CREW_CATEGORY,
      startDate: a.startDate,
      endDate: normalizeEndDate(a.startDate, a.endDate),
      readOnly: true
    });
  });
  return { entries, unmatched };
}
