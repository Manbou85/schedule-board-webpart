// データの読み書きの「約束ごと」(インターフェース)
// - プレビュー版:MemoryScheduleService(ダミーデータ、メモリ上だけ)
// - WEBパーツ版:SharePoint リストから読む部品(フェーズ2で作る)
// 画面の部品はこの約束だけを使うので、中身を差し替えても画面は変えなくてよい。

import { DateKey, ICompanyHoliday, ICrewAssignment, IHolidayWork, ILeave, IScheduleEntry, IWorker } from '../core';

/** ある期間のデータ(週間表示なら1週間分) */
export interface IRangeData {
  entries: IScheduleEntry[];
  leaves: ILeave[];
  holidayWorks: IHolidayWork[];
  holidays: ICompanyHoliday[];
  /** 作業員の行き先(別サイトのリスト。設定していなければ空) */
  crewAssignments?: ICrewAssignment[];
  /** 一部のリストが読めなかったときのお知らせ(予定表は表示する) */
  warnings?: string[];
}

/** ログイン中のユーザー */
export interface ICurrentUser {
  /** M365User と突き合わせるアカウント(メールアドレスなど) */
  account: string;
  /** 「行動予定表管理者」グループに入っているか */
  isAdmin: boolean;
}

export interface IScheduleDataService {
  /** 予定表に出す人(WorkerNameList)。ページを開いたときに1回だけ呼ぶ */
  getWorkers(): Promise<IWorker[]>;
  /** 区分の選択肢(行動予定リストの列設定から読む) */
  getCategories(): Promise<string[]>;
  /** ログイン中のユーザー */
  getCurrentUser(): Promise<ICurrentUser>;
  /** 期間(開始日〜終了日)にかかる予定・休暇・休日出勤・会社休日・作業員の行き先 */
  getRange(start: DateKey, end: DateKey): Promise<IRangeData>;
  /** その人の最近の予定(行き先の候補に使う。開始日の新しい順に limit 件まで) */
  getRecentEntries(workerId: number, limit: number): Promise<IScheduleEntry[]>;
  /** 予定を登録する。保存した予定(ID付き)を返す */
  createEntry(entry: Omit<IScheduleEntry, 'id'>): Promise<IScheduleEntry>;
  /** 予定を書き換える */
  updateEntry(entry: IScheduleEntry): Promise<IScheduleEntry>;
  /** 予定を削除する */
  deleteEntry(id: number): Promise<void>;
}
