// 作業員の行き先リスト(別サイト)の扱い(画面に依存しない)
//
// - 作業員の列は「選択肢」(名前の文字)なので、WorkerNameList の名前と文字で突き合わせる
//   (全角・半角や、名字と名前のあいだの空白のちがいは気にしない)
// - 期間(開始日〜終了日)の予定として、行動予定表の「長期の予定」と同じく帯で表示する
// - 表示の優先:総務の休暇 > 総務の休日出勤 > 単発の予定 > 作業員の行き先 > 長期の予定(cellRule.ts)
// - 行き先に「休暇」の文字が入っていれば、区分を「休暇」にする(ver 0.8.4。総務に申請する前に先に書かれることがあるため)
// - 「早退」「遅刻」「午前休」「午後休」、「休暇」+午前/午後/AM/PM の行は、帯にせず総務と同じ札にする(ver 0.9.0)
//   (その日の現場の帯が隠れないように。総務が同じ種類を入力したら、総務の札だけを出す)

import { LEAVE_CATEGORY } from './cellRule';
import { addDays, normalizeEndDate } from './dateUtils';
import { DateKey, ICrewAssignment, ILeave, IScheduleEntry, IWorker, LeaveKind } from './types';

/** 作業員の行き先を表示するときの区分(アイコンと色) */
export const CREW_CATEGORY = '現場';

/**
 * 行き先にこの文字が入っていれば「休暇」として扱う(例「休暇」「休暇 0.5日」「休暇(〜11/22)」)。
 * 行き先は手入力でまちまちなため、ぴったり同じでなく「含まれていれば」にした(開発者回答。別のアプリの文字色の設定と同じ考え方)
 */
export const CREW_LEAVE_WORD = '休暇';


/**
 * 午前・午後のあとに仕事の言葉が続いていれば、仕事をする半日を返す(例「午後から現場」→ pm、「AM現場」→ am)。
 * あいだに区切り(、。()/ など)や「休」があれば続いていないとみなす(「午前休み、現場」は仕事の半日にしない)。
 * 両方の半日に仕事の言葉があるときや、見つからないときは undefined。
 * t は normalize('NFKC') と toUpperCase() 済みの文字
 */
function workingHalf(t: string): 'am' | 'pm' | undefined {
  // 仕事の言葉:現場・出勤・出社・在社・勤務(足すときは次の行の最後のかっこの中に「|言葉」を足す)
  const pattern = /(午前|午後|AM|PM)[^、,。.()[\]/・休]*?(現場|出勤|出社|在社|勤務)/g;
  let am = false;
  let pm = false;
  for (let m = pattern.exec(t); m; m = pattern.exec(t)) {
    if (m[1] === '午前' || m[1] === 'AM') {
      am = true;
    } else {
      pm = true;
    }
  }
  if (am === pm) {
    return undefined;
  }
  return am ? 'am' : 'pm';
}

/** 作業員の行き先の1行が何を表すか:現場(帯)/1日の休暇(帯)/札(早退・遅刻・午前休・午後休) */
export type CrewRowKind = { type: 'site' } | { type: 'leave' } | { type: 'badge'; kind: LeaveKind };

/**
 * 行き先の文字から、何の行かを決める(全角・半角、AM/PM の大文字・小文字は気にしない)。
 *  1. 「早退」→ 早退の札 / 「遅刻」→ 遅刻の札
 *  2. 「午前休」→ 午前休の札 / 「午後休」→ 午後休の札
 *  3. 「休暇」+「午後から現場」のように、午前・午後のあとに仕事の言葉(現場・出勤など)が続く →
 *     仕事をするのはその半日なので、休暇は残りの半日(「休暇(午後から現場)」→ 午前休の札。ver 0.9.3)
 *  4. 「休暇」+「午前」か「AM」→ 午前休の札 / 「休暇」+「午後」か「PM」→ 午後休の札(両方あるときは1日の休暇)
 *  5. 「休暇」→ 1日の休暇(「休暇 0.5日」のように午前・午後がわからないものも)
 *  6. それ以外 → 現場
 */
export function classifyCrewTitle(title: string): CrewRowKind {
  const t = (title || '').normalize('NFKC').toUpperCase();
  const has = (w: string): boolean => t.indexOf(w) >= 0;
  if (has('早退')) {
    return { type: 'badge', kind: 'early' };
  }
  if (has('遅刻')) {
    return { type: 'badge', kind: 'late' };
  }
  if (has('午前休')) {
    return { type: 'badge', kind: 'morning' };
  }
  if (has('午後休')) {
    return { type: 'badge', kind: 'afternoon' };
  }
  if (has(CREW_LEAVE_WORD)) {
    const work = workingHalf(t);
    if (work === 'pm') {
      return { type: 'badge', kind: 'morning' };
    }
    if (work === 'am') {
      return { type: 'badge', kind: 'afternoon' };
    }
    const am = has('午前') || has('AM');
    const pm = has('午後') || has('PM');
    if (am && !pm) {
      return { type: 'badge', kind: 'morning' };
    }
    if (pm && !am) {
      return { type: 'badge', kind: 'afternoon' };
    }
    return { type: 'leave' };
  }
  return { type: 'site' };
}

/** 札の行を、日ごとの札にするときの上限(まちがって長い期間を書かれても重くならないように) */
const MAX_BADGE_DAYS = 62;

/** 表示中の期間(札を作る日をこの中だけにする) */
export interface ICrewPeriod {
  start: DateKey;
  end: DateKey;
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
  departments: string[] = [],
  shown?: ICrewPeriod
): { entries: IScheduleEntry[]; leaves: ILeave[]; unmatched: string[] } {
  const targets = departments.map((d) => d.normalize('NFKC').trim()).filter((d) => !!d);
  const byName = new Map<string, IWorker>();
  workers.forEach((w) => {
    const key = nameKey(w.name);
    if (key && !byName.has(key)) {
      byName.set(key, w);
    }
  });
  const entries: IScheduleEntry[] = [];
  const leaves: ILeave[] = [];
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
    const title = a.title.trim();
    const endDate = normalizeEndDate(a.startDate, a.endDate);
    const kind = classifyCrewTitle(title);
    if (kind.type === 'badge') {
      // 札:その期間の毎日に、総務の休暇と同じ形の札を作る(書いた文字は補足に)。
      // 表示中の期間がわかれば、その中の日だけ作る(長い期間の行でも、今見ている週に札が出るように)
      const from = shown && shown.start > a.startDate ? shown.start : a.startDate;
      const to = shown && shown.end < endDate ? shown.end : endDate;
      for (let d = from, i = 0; d <= to && i < MAX_BADGE_DAYS; d = addDays(d, 1), i++) {
        leaves.push({ id: -(a.id * 100 + i), workerId: worker.id, date: d, kind: kind.kind, remarks: title, fromCrew: true });
      }
      return;
    }
    entries.push({
      id: -a.id,
      workerId: worker.id,
      title,
      entryType: 'period',
      category: kind.type === 'leave' ? LEAVE_CATEGORY : CREW_CATEGORY,
      startDate: a.startDate,
      endDate,
      readOnly: true
    });
  });
  return { entries, leaves, unmatched };
}
