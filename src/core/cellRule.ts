// 1マス(1人×1日)に何を表示するかを決める(CLAUDE.md 6-2 の表示ルール)
//
// 上から順に優先:
//   1. 休暇リストで「1日」          → 「休暇」
//   2. 休日出勤リストに登録あり     → 「休出」+出勤先+時刻
//   3. 単発の予定あり               → 単発の予定
//   4. 休日(出勤なし)             → 空欄(長期の予定・作業員の行き先は出さない。開発者回答 2026-11-19)
//   5. 平日で長期の予定あり         → 長期の予定を通常表示
//      ※ 作業員の行き先リスト(別サイト)に登録があれば、行動予定表の長期の予定より優先する
//      ※ 作業員の行き先が同じ日に2行以上あれば、すべて出す(早く始まった行を帯に、ほかは帯の下に小さな箱。ver 0.9.0)。
//         ただし「休暇」の行があれば、その日は休暇だけを出す(総務の「1日」休暇と同じ考え方)
//   6. 何もなし                     → 空欄
// 休暇の「午前」「午後」「遅刻」「早退」は、上の表示にバッジとして重ねる。
//
// 今日の単発予定で、戻り(終了)の時刻を過ぎたものは「終わった予定」として薄く表示する。
// 終わっていない単発予定がなく、長期の予定があれば、長期の予定を出して、その下に終わった予定を薄く出す。

import { formatTimeRange, isDateInPeriod } from './dateUtils';
import { LEAVE_BADGE_LABELS } from './labels';
import { INow, isFinishedEntry } from './quickOut';
import { DateKey, ICell, IDayInfo, IHolidayWork, ILeave, ILeaveBadge, IScheduleEntry, LeaveKind } from './types';

/** 区分で絞り込むときに使う呼び名。休暇は「休暇」、休日出勤は「休日出勤」とする */
export const LEAVE_CATEGORY = '休暇';
export const HOLIDAY_WORK_CATEGORY = '休日出勤';

export interface ICellRuleOptions {
  /**
   * 総務の「1日」休暇と本人の単発予定が重なったとき、休暇を優先するか。
   * 休暇を優先(true)で決定(開発者回答)。WEBパーツの設定で切り替えられる。
   * false にすると、単発の予定がある日だけ単発の予定を出す。単発の予定がなければ休暇(休日出勤より下には下げない)。
   */
  leaveBeforeSingle: boolean;
}

export const DEFAULT_CELL_RULE_OPTIONS: ICellRuleOptions = {
  leaveBeforeSingle: true
};

/** 1人ぶんの、ある期間のデータ(呼び出す側で担当者ごとに分けておく) */
export interface IWorkerDayData {
  entries: IScheduleEntry[];
  leaves: ILeave[];
  holidayWorks: IHolidayWork[];
  /** 作業員の行き先(crewToEntries で予定の形にしたもの)。なければ省略してよい */
  crew?: IScheduleEntry[];
}

/** バッジの並び順(1日の時間の流れに合わせる) */
const BADGE_ORDER: LeaveKind[] = ['late', 'morning', 'afternoon', 'early'];

function compareTime(a?: string, b?: string): number {
  // 時刻のない予定は後ろへ
  const x = a || '99:99';
  const y = b || '99:99';
  return x < y ? -1 : x > y ? 1 : 0;
}

/** 単発の予定の並び順:開始時刻の早い順 → ID の小さい順(登録順) */
function compareSingle(a: IScheduleEntry, b: IScheduleEntry): number {
  return compareTime(a.startTime, b.startTime) || a.id - b.id;
}

/**
 * 同じ日に長期の予定が2つ以上重なったとき、どれを出すか。
 * 開始日が新しいもの(あとから始まった現場)を優先し、同じなら ID の大きい(あとで登録した)もの。
 */
function pickPeriod(periods: IScheduleEntry[]): IScheduleEntry | undefined {
  let best: IScheduleEntry | undefined;
  periods.forEach((p) => {
    if (!best || p.startDate > best.startDate || (p.startDate === best.startDate && p.id > best.id)) {
      best = p;
    }
  });
  return best;
}

/**
 * 作業員の行き先の、その日の行を並べる:開始日の早い順 → 登録の早い順。
 * (ID はリストの ID をマイナスにしたものなので、ID が大きいほど登録が早い)
 */
function sortCrewRows(rows: IScheduleEntry[]): IScheduleEntry[] {
  return rows.slice().sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : b.id - a.id));
}

/** 作業員の行き先から作った札は、総務の休暇リストに同じ種類があれば出さない(総務の登録を正とする) */
function dropCrewDuplicates(leaves: ILeave[]): ILeave[] {
  return leaves.filter((l) => !l.fromCrew || !leaves.some((o) => !o.fromCrew && o.kind === l.kind));
}

function makeBadges(leaves: ILeave[]): ILeaveBadge[] {
  const badges: ILeaveBadge[] = [];
  BADGE_ORDER.forEach((kind) => {
    leaves.forEach((l) => {
      if (l.kind === kind) {
        const badge: ILeaveBadge = { kind, label: LEAVE_BADGE_LABELS[kind] };
        if (l.remarks && l.remarks.trim()) {
          badge.remarks = l.remarks.trim();
        }
        badges.push(badge);
      }
    });
  });
  return badges;
}

/**
 * 1マスの表示内容を決める。
 * @param day  その日の休日判定(holiday.ts の createHolidayCalendar で作る)
 * @param workerId 担当者
 * @param data その人の予定・休暇・休日出勤(ほかの日のものが混ざっていてもよい)
 * @param now  今の日時(終わった予定を薄くするため)。省略すると薄くしない
 */
export function resolveCell(
  day: IDayInfo,
  workerId: number,
  data: IWorkerDayData,
  options: ICellRuleOptions = DEFAULT_CELL_RULE_OPTIONS,
  now?: INow
): ICell {
  const date: DateKey = day.date;
  // 作業員の行き先から作った札は、休日には出さない(休日は作業員の行き先そのものを出さないのと同じ)
  const leaves = dropCrewDuplicates(
    data.leaves.filter((l) => l.workerId === workerId && l.date === date && !(l.fromCrew && day.isHoliday))
  );
  const holidayWorks = data.holidayWorks.filter((h) => h.workerId === workerId && h.date === date);
  const todays = data.entries.filter(
    (e) => e.workerId === workerId && isDateInPeriod(date, e.startDate, e.endDate)
  );
  const singles = todays.filter((e) => e.entryType === 'single').sort(compareSingle);
  // 作業員の行き先:その日の行をすべて使う。「休暇」の行があればそれだけ、なければ早く始まった行を帯に、ほかは箱で
  const crewRows = sortCrewRows(
    (data.crew || []).filter((e) => e.workerId === workerId && isDateInPeriod(date, e.startDate, e.endDate))
  );
  const crewLeave = crewRows.filter((e) => e.category === LEAVE_CATEGORY)[0];
  const crew = crewLeave || crewRows[0];
  const crewExtras = crewLeave ? [] : crewRows.slice(1);
  // 長期の予定:作業員の行き先があればそちらを優先
  const period = crew || pickPeriod(todays.filter((e) => e.entryType === 'period'));

  let fullDayLeave: ILeave | undefined;
  for (let i = 0; i < leaves.length; i++) {
    if (leaves[i].kind === 'fullDay') {
      fullDayLeave = leaves[i];
      break;
    }
  }

  const cell: ICell = {
    date,
    workerId,
    isHoliday: day.isHoliday,
    content: { kind: 'empty' },
    // 「1日」休暇の日は、午前休などのバッジは出さない(休暇の表示で十分なため)
    badges: fullDayLeave ? [] : makeBadges(leaves)
  };

  const finished = singles.filter((e) => isFinishedEntry(e, now));
  const allFinished = singles.length > 0 && finished.length === singles.length;
  // 休日(出勤なし)は長期の予定を使わない(その日は現場にいないため。表示も人数のまとめも)
  const workingPeriod = day.isHoliday ? undefined : period;
  // 単発予定がすべて終わっていて長期の予定があれば、長期の予定を出す(下の 5 で終わった予定を添える)
  const singleContent =
    singles.length > 0 && !(allFinished && workingPeriod)
      ? workingPeriod
        ? { kind: 'single' as const, entries: singles, finishedIds: finished.map((e) => e.id), underlying: workingPeriod }
        : { kind: 'single' as const, entries: singles, finishedIds: finished.map((e) => e.id) }
      : undefined;
  const leaveContent = fullDayLeave ? { kind: 'leave' as const, leave: fullDayLeave } : undefined;

  // 1. 休暇(1日)。設定で「単発の予定を優先」にしているときは、単発の予定がある日だけ単発の予定を出す
  if (leaveContent) {
    cell.content = !options.leaveBeforeSingle && singleContent ? singleContent : leaveContent;
    return cell;
  }

  // 2. 休日出勤
  if (holidayWorks.length > 0) {
    const hw = holidayWorks[0];
    cell.content = { kind: 'holidayWork', holidayWork: hw, timeText: formatTimeRange(hw.startTime, hw.endTime) };
    return cell;
  }

  // 3. 単発の予定
  if (singleContent) {
    cell.content = singleContent;
    return cell;
  }

  // 4. 休日(出勤なし)は、長期の予定があっても空欄
  // 5. 平日の長期の予定
  if (workingPeriod) {
    cell.content =
      crewExtras.length > 0
        ? { kind: 'period', entry: workingPeriod, dimmed: false, finished, extras: crewExtras }
        : { kind: 'period', entry: workingPeriod, dimmed: false, finished };
    return cell;
  }

  // 6. 何もなし
  return cell;
}

/** 1人ぶんの行(複数の日)をまとめて作る */
export function resolveRow(
  days: IDayInfo[],
  workerId: number,
  data: IWorkerDayData,
  options: ICellRuleOptions = DEFAULT_CELL_RULE_OPTIONS,
  now?: INow
): ICell[] {
  return days.map((d) => resolveCell(d, workerId, data, options, now));
}

/** 予定・休暇・休日出勤を担当者ごとに分ける(53人分を毎回全部見ないようにするため) */
export function groupByWorker(data: IWorkerDayData): Map<number, IWorkerDayData> {
  const map = new Map<number, IWorkerDayData>();
  const get = (workerId: number): IWorkerDayData => {
    let d = map.get(workerId);
    if (!d) {
      d = { entries: [], leaves: [], holidayWorks: [], crew: [] };
      map.set(workerId, d);
    }
    return d;
  };
  data.entries.forEach((e) => get(e.workerId).entries.push(e));
  (data.crew || []).forEach((e) => (get(e.workerId).crew as IScheduleEntry[]).push(e));
  data.leaves.forEach((l) => get(l.workerId).leaves.push(l));
  data.holidayWorks.forEach((h) => get(h.workerId).holidayWorks.push(h));
  return map;
}

/** その人のデータがないときに使う空のデータ */
export const EMPTY_WORKER_DATA: IWorkerDayData = { entries: [], leaves: [], holidayWorks: [], crew: [] };

/** 検索・絞り込みで使う、マスに表示されている文字(行き先・現場名、出勤先) */
export function cellPlaces(cell: ICell): string[] {
  const c = cell.content;
  switch (c.kind) {
    case 'holidayWork':
      return [c.holidayWork.workPlace];
    case 'single':
      return c.entries.map((e) => e.title);
    case 'period':
      return [c.entry.title].concat((c.extras || []).map((e) => e.title));
    default:
      return [];
  }
}


/**
 * マスに出ている区分(区分の絞り込み・人数のまとめのボタンで使う。「その日にその区分の予定がある人」)。
 * 作業員の行き先の2行目以降と、半日の休暇(午前休・午後休の札)も含める(ver 0.9.0)。同じ区分は1つにまとめる
 */
export function cellCategories(cell: ICell): string[] {
  const c = cell.content;
  let list: string[];
  switch (c.kind) {
    case 'leave':
      list = [LEAVE_CATEGORY];
      break;
    case 'holidayWork':
      list = [HOLIDAY_WORK_CATEGORY];
      break;
    case 'single':
      list = c.entries.map((e) => e.category);
      break;
    case 'period':
      list = [c.entry.category].concat((c.extras || []).concat(c.finished).map((e) => e.category));
      break;
    default:
      list = [];
  }
  if (cell.badges.some((b) => b.kind === 'morning' || b.kind === 'afternoon')) {
    list.push(LEAVE_CATEGORY);
  }
  return list.filter((x, i) => list.indexOf(x) === i);
}
