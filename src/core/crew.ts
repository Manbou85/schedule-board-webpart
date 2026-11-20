// 作業員の行き先リスト(別サイト)の扱い(画面に依存しない)
//
// - 作業員の列は「選択肢」(名前の文字)なので、WorkerNameList の名前と文字で突き合わせる
//   (全角・半角や、名字と名前のあいだの空白のちがいは気にしない)
// - 期間(開始日〜終了日)の予定として、行動予定表の「長期の予定」と同じく帯で表示する
// - 表示の優先:総務の休暇 > 総務の休日出勤 > 単発の予定 > 作業員の行き先 > 長期の予定(cellRule.ts)
// - 行き先に「休暇」の文字が入っていれば、区分を「休暇」にする(ver 0.8.4。総務に申請する前に先に書かれることがあるため)

import { LEAVE_CATEGORY } from './cellRule';
import { normalizeEndDate } from './dateUtils';
import { ICrewAssignment, IScheduleEntry, IWorker } from './types';

/** 作業員の行き先を表示するときの区分(アイコンと色) */
export const CREW_CATEGORY = '現場';

/**
 * 行き先にこの文字が入っていれば「休暇」として扱う(例「休暇」「休暇 0.5日」「休暇(〜11/22)」)。
 * 行き先は手入力でまちまちなため、ぴったり同じでなく「含まれていれば」にした(開発者回答。別のアプリの文字色の設定と同じ考え方)
 */
export const CREW_LEAVE_WORD = '休暇';

/** 作業員の行き先の区分:「休暇」の文字が入っていれば休暇、それ以外は現場(全角・半角のちがいは気にしない) */
export function crewCategory(title: string): string {
  return (title || '').normalize('NFKC').indexOf(CREW_LEAVE_WORD) >= 0 ? LEAVE_CATEGORY : CREW_CATEGORY;
}

/** 作業員の行き先リストを反映する部署の初期値(開発者回答:作業員のみ。WEBパーツの設定で変えられる) */
export const DEFAULT_CREW_DEPARTMENTS = ['作業員'];

/** 名前を突き合わせるための形:全角・半角をそろえ、空白をすべて取る */
export function nameKey(name: string): string {
  return (name || '').normalize('NFKC').replace(/\s+/g, '');
}

/**
 * 作業員の行き先 → 予定表の予定(読み取り専用の長期の予定)。
 * 名前が WorkerNameList の誰とも合わない行は使わない(unmatched に名前を返す)。
 * departments を指定すると、その部署の人の行だけを使う(ほかの部署の人の行は、知らせずに使わない)。空なら全員。
 * ID は行動予定と重ならないよう、マイナスにする。
 */
export function crewToEntries(
  list: ICrewAssignment[],
  workers: IWorker[],
  departments: string[] = []
): { entries: IScheduleEntry[]; unmatched: string[] } {
  const targets = departments.map((d) => d.normalize('NFKC').trim()).filter((d) => !!d);
  const byName = new Map<string, IWorker>();
  workers.forEach((w) => {
    const key = nameKey(w.name);
    if (key && !byName.has(key)) {
      byName.set(key, w);
    }
  });
  const entries: IScheduleEntry[] = [];
  const unmatched: string[] = [];
  list.forEach((a) => {
    const worker = byName.get(nameKey(a.workerName));
    if (!worker) {
      const name = a.workerName.trim();
      if (name && unmatched.indexOf(name) < 0) {
        unmatched.push(name);
      }
      return;
    }
    if (targets.length > 0 && targets.indexOf(worker.department.normalize('NFKC').trim()) < 0) {
      return; // 反映しない部署の人(行動予定表の予定を使う)
    }
    entries.push({
      id: -a.id,
      workerId: worker.id,
      title: a.title.trim(),
      entryType: 'period',
      category: crewCategory(a.title),
      startDate: a.startDate,
      endDate: normalizeEndDate(a.startDate, a.endDate),
      readOnly: true
    });
  });
  return { entries, unmatched };
}
