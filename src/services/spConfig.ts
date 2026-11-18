// SharePoint リストの「列の内部名」の設定(ここ1か所で変更できる)
//
// 内部名=プログラムで使う本当の列の名前。表示名(画面の列名)とちがうことがある。
// 確かめ方:ブラウザで次の URL を開く(リスト名を差し替える)
//   https://<テナント>.sharepoint.com/sites/<サイト>/_api/web/lists/getbytitle('リスト名')/fields?$filter=Hidden eq false&$select=Title,InternalName,TypeAsString
//
// リスト名・サイトURL・管理者グループ名は、WEBパーツの設定画面で変更する(ScheduleBoardWebPart.ts)。

/** 対象者リスト(WorkerNameList) */
export interface IWorkerFields {
  /** 氏名(タイトル) */
  title: string;
  /** 予定表に表示する名前 */
  name: string;
  /** 表示順(No.) */
  no: string;
  /** ログイン中ユーザーとの照合に使うユーザー列 */
  user: string;
  /** 部署 */
  department: string;
}

/** 行動予定リスト(ScheduleEntries) */
export interface IEntryFields {
  title: string;
  /** 担当者(WorkerNameList への参照列) */
  worker: string;
  entryType: string;
  category: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  note: string;
}

/** 会社休日リスト */
export interface IHolidayFields {
  name: string;
  date: string;
  dayType: string;
}

/** 休暇情報共有リスト(総務) */
export interface ILeaveFields {
  date: string;
  /** 休暇の種類(1日/午前/午後/遅刻/早退) */
  kind: string;
  /** 本人(WorkerNameList への参照列) */
  worker: string;
  remarks: string;
}

/** 休日出勤情報共有リスト(総務) */
export interface IHolidayWorkFields {
  date: string;
  startTime: string;
  endTime: string;
  workPlace: string;
  /** 本人(WorkerNameList への参照列) */
  worker: string;
}

export interface ISpFieldConfig {
  workers: IWorkerFields;
  entries: IEntryFields;
  holidays: IHolidayFields;
  leaves: ILeaveFields;
  holidayWorks: IHolidayWorkFields;
}

/**
 * 列の内部名。
 * 【要確認】は、開発者に上の URL で確かめてもらうまでの仮の値。
 */
export const SP_FIELDS: ISpFieldConfig = {
  workers: {
    title: 'Title',
    name: 'WorkerName',
    no: 'No_x002e_', // 「No.」の「.」は内部名で _x002e_ になる(2026-11 開発者が確認済み)
    user: 'M365User',
    department: 'Department'
  },
  entries: {
    title: 'Title',
    worker: 'Worker',
    entryType: 'EntryType',
    category: 'Category',
    startDate: 'StartDate',
    endDate: 'EndDate',
    startTime: 'StartTime',
    endTime: 'EndTime',
    note: 'Note'
  },
  holidays: {
    // 【要確認】既存の休日リストを参照する場合は、そのリストの内部名に合わせる
    name: 'Title',
    date: 'HolidayDate',
    dayType: 'DayType'
  },
  leaves: {
    // 【要確認】
    date: 'Date',
    kind: 'AcquisitionTime',
    worker: 'Name',
    remarks: 'Remarks'
  },
  holidayWorks: {
    // 【要確認】
    date: 'Date',
    startTime: 'StartTime',
    endTime: 'EndTime',
    workPlace: 'WorkPlace',
    worker: 'Name'
  }
};

/** WEBパーツの設定画面で変える項目 */
export interface ISpListSettings {
  /** 行動予定リストの名前 */
  entriesList: string;
  /** 対象者リストの名前 */
  workersList: string;
  /** 会社休日リストのあるサイトの URL(空欄なら WEBパーツと同じサイト) */
  holidaysSiteUrl: string;
  /** 会社休日リストの名前 */
  holidaysList: string;
  /** 休暇情報共有リストの名前 */
  leavesList: string;
  /** 休日出勤情報共有リストの名前 */
  holidayWorksList: string;
  /** 管理者の SharePoint グループ名 */
  adminGroup: string;
}

/** 設定の初期値。【要確認】総務のリストの名前は仮 */
export const DEFAULT_LIST_SETTINGS: ISpListSettings = {
  // 自分たちで作るリストは URL で指定する(表示名を「行動予定」に変えても動くように)
  entriesList: 'Lists/ScheduleEntries',
  workersList: 'WorkerNameList',
  holidaysSiteUrl: '',
  holidaysList: 'Lists/CompanyHolidays',
  leavesList: '休暇情報共有リスト',
  holidayWorksList: '休日出勤情報共有リスト',
  adminGroup: '行動予定表管理者'
};
