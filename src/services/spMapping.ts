// SharePoint の値 ⇔ 予定表のデータの形 の変換(通信はしない。テストしやすいように分けている)

import {
  addDays,
  DateKey,
  ENTRY_TYPE_LABELS,
  ICompanyHoliday,
  IHolidayWork,
  ILeave,
  IScheduleEntry,
  IWorker,
  parseCompanyDayType,
  parseEntryType,
  parseLeaveKind
} from '../core';
import { IEntryFields, IHolidayFields, IHolidayWorkFields, ILeaveFields, IWorkerFields } from './spConfig';

/** SharePoint から返ってくる1行(列名 → 値) */
export interface ISpRow {
  [field: string]: unknown;
}

const HOUR = 60 * 60 * 1000;

function pad2(n: number): string {
  return n < 10 ? '0' + n : String(n);
}

/**
 * 「日付のみ」の列の値 → 'YYYY-MM-DD'。
 * SharePoint は「サイトの時刻で 0時」を世界標準時(UTC)にして返す(日本なら前の日の 15:00Z)。
 * 12時間足してから UTC の日付を取ると、時差が ±12時間以内のサイトなら正しい日付になる。
 */
export function spDateToKey(value: unknown): DateKey | undefined {
  if (typeof value !== 'string' || !value) {
    return undefined;
  }
  const t = Date.parse(value);
  if (isNaN(t)) {
    return undefined;
  }
  const d = new Date(t + 12 * HOUR);
  return d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}

/**
 * 'YYYY-MM-DD' → 「日付のみ」の列に書き込む値。
 * UTC の 0時(日本時間の 9時)にする。
 * - 日本のサイトでは、その日の日付として保存される
 * - そのまま返ってきても、0時(日本時間)にそろえて返ってきても、spDateToKey で同じ日付に戻る
 * (日本より西の、時差がマイナスのサイトでは1日ずれるが、このWEBパーツは日本のサイトで使う前提)
 */
export function dateKeyToSp(key: DateKey): string {
  return key + 'T00:00:00Z';
}

/**
 * 表示する範囲(初日〜最終日)をリストから取り出すときの、日付の条件の幅。
 * 時差のずれを見込んで前後に1日広く取り、取り出したあとに正確に絞る。
 */
export function rangeBounds(start: DateKey, end: DateKey): { from: string; to: string } {
  return { from: addDays(start, -1) + 'T12:00:00Z', to: addDays(end, 1) + 'T12:00:00Z' };
}

/** OData の文字列の中で使えるように、' を '' にする */
export function escapeOData(text: string): string {
  return text.replace(/'/g, "''");
}

/**
 * リストの指定 → REST の URL の頭の部分。
 * - 'Lists/ScheduleEntries' のように / を含む → リストの URL で探す(表示名を変えても動く)
 * - それ以外 → リストの名前(タイトル)で探す
 */
export function listApiUrl(webUrl: string, listRef: string): string {
  const web = webUrl.replace(/\/+$/, '');
  const ref = listRef.trim();
  if (ref.indexOf('/') >= 0) {
    // サイトの URL からのパス(例 /sites/portal/Lists/ScheduleEntries)
    const path = web.replace(/^https?:\/\/[^/]+/, '') + '/' + ref.replace(/^\/+/, '');
    return web + "/_api/web/GetList('" + encodeURIComponent(escapeOData(path)) + "')";
  }
  return web + "/_api/web/lists/getbytitle('" + encodeURIComponent(escapeOData(ref)) + "')";
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

/** 参照列の ID は「列名+Id」で返ってくる */
export function lookupIdField(field: string): string {
  return field + 'Id';
}

/** WorkerNameList の1行 → 予定表の人。ID がない行は undefined */
export function mapWorker(row: ISpRow, f: IWorkerFields): IWorker | undefined {
  const id = num(row.Id);
  if (id === undefined) {
    return undefined;
  }
  const user = row[f.user] as { EMail?: string } | undefined;
  const email = user && typeof user.EMail === 'string' ? user.EMail.trim() : '';
  const worker: IWorker = {
    id,
    name: text(row[f.name]).trim() || text(row[f.title]).trim(),
    no: text(row[f.no]).trim(),
    department: text(row[f.department]).trim()
  };
  if (email) {
    worker.account = email;
  }
  return worker;
}

/** 行動予定リストの1行 → 予定。必要な値がそろっていない行は undefined(表示しない) */
export function mapEntry(row: ISpRow, f: IEntryFields): IScheduleEntry | undefined {
  const id = num(row.Id);
  const workerId = num(row[lookupIdField(f.worker)]);
  const entryType = parseEntryType(text(row[f.entryType]));
  const startDate = spDateToKey(row[f.startDate]);
  if (id === undefined || workerId === undefined || !entryType || !startDate) {
    return undefined;
  }
  const entry: IScheduleEntry = {
    id,
    workerId,
    title: text(row[f.title]).trim(),
    entryType,
    category: text(row[f.category]).trim(),
    startDate,
    endDate: spDateToKey(row[f.endDate]) || startDate
  };
  const startTime = text(row[f.startTime]).trim();
  const endTime = text(row[f.endTime]).trim();
  const note = text(row[f.note]).trim();
  if (startTime) {
    entry.startTime = startTime;
  }
  if (endTime) {
    entry.endTime = endTime;
  }
  if (note) {
    entry.note = note;
  }
  return entry;
}

/** 予定 → 行動予定リストに書き込む値。空の任意項目は '' にして消す */
export function entryToSpBody(entry: Omit<IScheduleEntry, 'id'>, f: IEntryFields): ISpRow {
  const body: ISpRow = {};
  body[f.title] = entry.title;
  body[lookupIdField(f.worker)] = entry.workerId;
  body[f.entryType] = ENTRY_TYPE_LABELS[entry.entryType];
  body[f.category] = entry.category;
  body[f.startDate] = dateKeyToSp(entry.startDate);
  body[f.endDate] = dateKeyToSp(entry.entryType === 'single' ? entry.startDate : entry.endDate);
  body[f.startTime] = entry.startTime || '';
  body[f.endTime] = entry.endTime || '';
  body[f.note] = entry.note || '';
  return body;
}

/** 会社休日リストの1行 → 会社休日。種別が読めない行は undefined */
export function mapHoliday(row: ISpRow, f: IHolidayFields): ICompanyHoliday | undefined {
  const date = spDateToKey(row[f.date]);
  const dayType = parseCompanyDayType(text(row[f.dayType]));
  if (!date || !dayType) {
    return undefined;
  }
  return { date, name: text(row[f.name]).trim(), dayType };
}

/** 休暇情報共有リストの1行 → 休暇。本人・日付・種類が読めない行は undefined */
export function mapLeave(row: ISpRow, f: ILeaveFields): ILeave | undefined {
  const id = num(row.Id);
  const workerId = num(row[lookupIdField(f.worker)]);
  const date = spDateToKey(row[f.date]);
  const kind = parseLeaveKind(text(row[f.kind]));
  if (id === undefined || workerId === undefined || !date || !kind) {
    return undefined;
  }
  const leave: ILeave = { id, workerId, date, kind };
  const remarks = text(row[f.remarks]).trim();
  if (remarks) {
    leave.remarks = remarks;
  }
  return leave;
}

/** 休日出勤情報共有リストの1行 → 休日出勤。本人・日付が読めない行は undefined */
export function mapHolidayWork(row: ISpRow, f: IHolidayWorkFields): IHolidayWork | undefined {
  const id = num(row.Id);
  const workerId = num(row[lookupIdField(f.worker)]);
  const date = spDateToKey(row[f.date]);
  if (id === undefined || workerId === undefined || !date) {
    return undefined;
  }
  const hw: IHolidayWork = { id, workerId, date, workPlace: text(row[f.workPlace]).trim() };
  const startTime = text(row[f.startTime]).trim();
  const endTime = text(row[f.endTime]).trim();
  if (startTime) {
    hw.startTime = startTime;
  }
  if (endTime) {
    hw.endTime = endTime;
  }
  return hw;
}

/** 行を変換して、変換できなかった行(undefined)を除く */
export function mapRows<T>(rows: ISpRow[], map: (row: ISpRow) => T | undefined): T[] {
  const result: T[] = [];
  rows.forEach((r) => {
    const v = map(r);
    if (v !== undefined) {
      result.push(v);
    }
  });
  return result;
}
