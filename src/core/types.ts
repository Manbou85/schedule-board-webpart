// 予定表の中心で使う「データの形」の定義
// ここは画面(React)にも SharePoint にも依存しない。
// 日付は時差のずれを避けるため、すべて 'YYYY-MM-DD' の文字列(DateKey)で扱う。

/** 'YYYY-MM-DD' 形式の日付(例 '2026-11-17') */
export type DateKey = string;

/** 予定表に表示する人(WorkerNameList の1行) */
export interface IWorker {
  /** WorkerNameList のアイテムID(行動予定・休暇・休日出勤の「参照」と突き合わせる) */
  id: number;
  /** 予定表に表示する名前(WorkerName。空ならタイトル) */
  name: string;
  /** 表示順(No. 例 '0101') */
  no: string;
  /** 部署(Department) */
  department: string;
  /** M365User のアカウント(メールアドレスなど)。空欄の人は undefined */
  account?: string;
}

/** 登録種別:期間(長期の現場)/単発(1日の予定) */
export type EntryType = 'period' | 'single';

/** 行動予定(行動予定リストの1行) */
export interface IScheduleEntry {
  id: number;
  /** 担当者(WorkerNameList のアイテムID) */
  workerId: number;
  /** 行き先・現場名 */
  title: string;
  entryType: EntryType;
  /** 区分(現場/在社/外出 など。リストの選択肢をそのまま使う) */
  category: string;
  startDate: DateKey;
  endDate: DateKey;
  /** 開始時刻(例 '09:00')。任意 */
  startTime?: string;
  /** 終了・戻り時刻(例 '15:00')。任意 */
  endTime?: string;
  note?: string;
  /** 作業員の行き先リスト(別サイト)から読んだ予定。この画面からは変更・削除できない */
  readOnly?: boolean;
}

/** 作業員の行き先(別サイトの作業員の行き先リストの1行。読み取りだけ) */
export interface ICrewAssignment {
  id: number;
  /** 作業員の名前(選択肢の文字。WorkerNameList の名前と突き合わせる) */
  workerName: string;
  /** 行き先・現場名(SiteName) */
  title: string;
  startDate: DateKey;
  endDate: DateKey;
}

/** 会社休日リストの種別を、休日あつかいか出勤日あつかいかに分けたもの */
export type CompanyDayType = 'holiday' | 'workday';

/** 会社休日(会社休日リストの1行) */
export interface ICompanyHoliday {
  date: DateKey;
  /** 名称(例 元日)。空欄でもよい */
  name: string;
  dayType: CompanyDayType;
  /** 種別の選択肢の文字そのまま(例 祝日、休業日、一斉有給、出勤日) */
  kindLabel?: string;
}

/** 休暇の種類:1日/午前/午後/遅刻/早退 */
export type LeaveKind = 'fullDay' | 'morning' | 'afternoon' | 'late' | 'early';

/** 休暇(総務の休暇情報共有リストの1行) */
export interface ILeave {
  id: number;
  workerId: number;
  date: DateKey;
  kind: LeaveKind;
  /** 時間などの補足(Remarks) */
  remarks?: string;
}

/** 休日出勤(総務の休日出勤情報共有リストの1行) */
export interface IHolidayWork {
  id: number;
  workerId: number;
  date: DateKey;
  /** 出勤先(WorkPlace) */
  workPlace: string;
  startTime?: string;
  endTime?: string;
}

/** 1日ぶんの「休日かどうか」の判定結果 */
export interface IDayInfo {
  date: DateKey;
  /** 0=日曜 … 6=土曜 */
  dayOfWeek: number;
  /** 休日なら true(土日・会社休日。出勤日として登録された土日は false) */
  isHoliday: boolean;
  /** 会社休日リストの名称(元日 など)。あれば */
  holidayName?: string;
}

/** 休暇の「午前休」などのバッジ */
export interface ILeaveBadge {
  kind: LeaveKind;
  /** 表示する文言(午前休/午後休/遅刻/早退) */
  label: string;
  /** 補足(時刻など)。週間表示ではマウスを乗せたとき/タップしたときに出す */
  remarks?: string;
}

/**
 * 1マス(1人×1日)に何を表示するか。
 * kind で表示の種類を分ける(6-2 の表示ルール)。
 */
export type CellContent =
  | { kind: 'leave'; leave: ILeave }
  | { kind: 'holidayWork'; holidayWork: IHolidayWork; timeText: string }
  /** finishedIds:戻り(終了)の時刻を過ぎた今日の予定。薄く表示する */
  /** underlying:単発の予定に隠れている、その日の長期の予定(人数のまとめで「今どこか」を決めるときに使う) */
  | { kind: 'single'; entries: IScheduleEntry[]; finishedIds: number[]; underlying?: IScheduleEntry }
  /** finished:今日の単発予定がすべて終わったとき、長期の予定の下に薄く出す終わった予定 */
  | { kind: 'period'; entry: IScheduleEntry; dimmed: boolean; finished: IScheduleEntry[] }
  | { kind: 'empty' };

/** 1マスの表示内容(中身+重ねて出すバッジ) */
export interface ICell {
  date: DateKey;
  workerId: number;
  isHoliday: boolean;
  content: CellContent;
  /** 午前休・午後休・遅刻・早退のバッジ(「1日」休暇のときは空) */
  badges: ILeaveBadge[];
}
