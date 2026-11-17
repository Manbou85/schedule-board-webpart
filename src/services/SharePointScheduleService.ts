// WEBパーツ版のデータの読み書き(SharePoint リスト)
// ログイン中のユーザーの権限で読み書きする。本当の制限はリストの権限設定で行う。

import { SPHttpClient, SPHttpClientResponse } from '@microsoft/sp-http';
import { DateKey, IScheduleEntry, IWorker, overlapsRange } from '../core';
import { ICurrentUser, IRangeData, IScheduleDataService } from './IScheduleDataService';
import { ISpFieldConfig, ISpListSettings, SP_FIELDS } from './spConfig';
import {
  entryToSpBody,
  escapeOData,
  ISpRow,
  listApiUrl,
  lookupIdField,
  mapEntry,
  mapHoliday,
  mapHolidayWork,
  mapLeave,
  mapRows,
  mapWorker,
  rangeBounds
} from './spMapping';

/** SharePoint とのやり取りに失敗したとき(状態コード付き) */
export class SpRequestError extends Error {
  public readonly status: number;
  public readonly detail: string;

  public constructor(status: number, detail: string) {
    super('SharePoint とのやり取りに失敗しました(状態コード ' + status + '):' + detail);
    // TypeScript の出力が ES5 のため、instanceof が効くように型をつなぎ直す
    Object.setPrototypeOf(this, SpRequestError.prototype);
    this.status = status;
    this.detail = detail;
  }
}

const JSON_HEADERS = {
  Accept: 'application/json;odata=nometadata',
  'Content-Type': 'application/json;odata=nometadata',
  'odata-version': ''
};

/** 一度に取り出す最大件数(リストのしきい値 5000 件以内) */
const PAGE_SIZE = 2000;

async function readError(response: SPHttpClientResponse): Promise<SpRequestError> {
  let detail = response.statusText;
  try {
    const json = await response.json();
    detail = (json && json['odata.error'] && json['odata.error'].message && json['odata.error'].message.value) ||
      (json && json.error && json.error.message && json.error.message.value) ||
      detail;
  } catch {
    // 中身が JSON でないときは statusText のまま
  }
  return new SpRequestError(response.status, detail);
}

export interface ISharePointServiceOptions {
  spHttpClient: SPHttpClient;
  /** WEBパーツを置いたサイトの URL */
  webUrl: string;
  /** ログイン中のユーザーのメールアドレス(M365User と照合する) */
  userEmail: string;
  lists: ISpListSettings;
  fields?: ISpFieldConfig;
}

export class SharePointScheduleService implements IScheduleDataService {
  private readonly _client: SPHttpClient;
  private readonly _webUrl: string;
  private readonly _userEmail: string;
  private readonly _lists: ISpListSettings;
  private readonly _f: ISpFieldConfig;

  public constructor(options: ISharePointServiceOptions) {
    this._client = options.spHttpClient;
    this._webUrl = options.webUrl.replace(/\/+$/, '');
    this._userEmail = options.userEmail;
    this._lists = options.lists;
    this._f = options.fields || SP_FIELDS;
  }

  public async getWorkers(): Promise<IWorker[]> {
    const f = this._f.workers;
    const select = ['Id', f.title, f.name, f.no, f.department, f.user + '/EMail'].join(',');
    const rows = await this._getAll(
      this._list(this._lists.workersList) + '/items?$select=' + select + '&$expand=' + f.user + '&$top=' + PAGE_SIZE
    );
    return mapRows(rows, (r) => mapWorker(r, f));
  }

  public async getCategories(): Promise<string[]> {
    const json = await this._get(
      this._list(this._lists.entriesList) +
        "/fields/getbyinternalnameortitle('" +
        encodeURIComponent(escapeOData(this._f.entries.category)) +
        "')?$select=Choices"
    );
    const choices = json && json.Choices;
    return Array.isArray(choices) ? choices.filter((c: unknown) => typeof c === 'string') : [];
  }

  public async getCurrentUser(): Promise<ICurrentUser> {
    let isAdmin = false;
    try {
      // 自分が入っている SharePoint グループの一覧から、管理者グループを探す
      const rows = await this._getAll(this._webUrl + '/_api/web/currentuser/groups?$select=Title');
      const target = this._lists.adminGroup.trim();
      isAdmin = !!target && rows.some((r) => r.Title === target);
    } catch {
      // 読めないときは一般のユーザーとして扱う(画面の制御は見た目のため)
    }
    return { account: this._userEmail, isAdmin };
  }

  public async getRange(start: DateKey, end: DateKey): Promise<IRangeData> {
    const b = rangeBounds(start, end);
    const e = this._f.entries;
    const entryRows = this._getAll(
      this._list(this._lists.entriesList) +
        '/items?$select=' +
        ['Id', e.title, lookupIdField(e.worker), e.entryType, e.category, e.startDate, e.endDate, e.startTime, e.endTime, e.note].join(',') +
        '&$filter=' +
        encodeURIComponent(e.startDate + " le datetime'" + b.to + "' and " + e.endDate + " ge datetime'" + b.from + "'") +
        '&$top=' +
        PAGE_SIZE
    );

    // 総務のリスト・会社休日は、読めなくても予定表は出す(お知らせだけ出す)
    const warnings: string[] = [];
    const optional = <T>(promise: Promise<T[]>, label: string): Promise<T[]> =>
      promise.catch(() => {
        warnings.push(label + 'を読み込めなかったため、表示していません。');
        return [] as T[];
      });

    const h = this._f.holidays;
    const holidaysWeb = (this._lists.holidaysSiteUrl || this._webUrl).replace(/\/+$/, '');
    const holidays = optional(
      this._getAll(
        listApiUrl(holidaysWeb, this._lists.holidaysList) +
          '/items?$select=' +
          [h.name, h.date, h.dayType].join(',') +
          '&$filter=' +
          encodeURIComponent(h.date + " ge datetime'" + b.from + "' and " + h.date + " le datetime'" + b.to + "'") +
          '&$top=' +
          PAGE_SIZE
      ).then((rows) => mapRows(rows, (r) => mapHoliday(r, h))),
      '会社休日'
    );

    const l = this._f.leaves;
    const leaves = optional(
      this._getAll(
        this._list(this._lists.leavesList) +
          '/items?$select=' +
          ['Id', l.date, l.kind, lookupIdField(l.worker), l.remarks].join(',') +
          '&$filter=' +
          encodeURIComponent(l.date + " ge datetime'" + b.from + "' and " + l.date + " le datetime'" + b.to + "'") +
          '&$top=' +
          PAGE_SIZE
      ).then((rows) => mapRows(rows, (r) => mapLeave(r, l))),
      '休暇の情報'
    );

    const w = this._f.holidayWorks;
    const holidayWorks = optional(
      this._getAll(
        this._list(this._lists.holidayWorksList) +
          '/items?$select=' +
          ['Id', w.date, w.startTime, w.endTime, w.workPlace, lookupIdField(w.worker)].join(',') +
          '&$filter=' +
          encodeURIComponent(w.date + " ge datetime'" + b.from + "' and " + w.date + " le datetime'" + b.to + "'") +
          '&$top=' +
          PAGE_SIZE
      ).then((rows) => mapRows(rows, (r) => mapHolidayWork(r, w))),
      '休日出勤の情報'
    );

    const [entryList, holidayList, leaveList, holidayWorkList] = await Promise.all([
      entryRows.then((rows) => mapRows(rows, (r) => mapEntry(r, e))),
      holidays,
      leaves,
      holidayWorks
    ]);

    // 時差を見込んで広めに取り出したので、ここで表示範囲ぴったりに絞る
    const inRange = (d: DateKey): boolean => start <= d && d <= end;
    return {
      entries: entryList.filter((x) => overlapsRange(x.startDate, x.endDate, start, end)),
      leaves: leaveList.filter((x) => inRange(x.date)),
      holidayWorks: holidayWorkList.filter((x) => inRange(x.date)),
      holidays: holidayList.filter((x) => inRange(x.date)),
      warnings
    };
  }

  public async getRecentEntries(workerId: number, limit: number): Promise<IScheduleEntry[]> {
    const e = this._f.entries;
    const json = await this._get(
      this._list(this._lists.entriesList) +
        '/items?$select=' +
        ['Id', e.title, lookupIdField(e.worker), e.entryType, e.category, e.startDate, e.endDate].join(',') +
        '&$filter=' +
        encodeURIComponent(lookupIdField(e.worker) + ' eq ' + workerId) +
        '&$orderby=' +
        e.startDate +
        ' desc&$top=' +
        limit
    );
    return mapRows((json && json.value) || [], (r: ISpRow) => mapEntry(r, e));
  }

  public async createEntry(entry: Omit<IScheduleEntry, 'id'>): Promise<IScheduleEntry> {
    const response = await this._client.post(this._list(this._lists.entriesList) + '/items', SPHttpClient.configurations.v1, {
      headers: JSON_HEADERS,
      body: JSON.stringify(entryToSpBody(entry, this._f.entries))
    });
    if (!response.ok) {
      throw await readError(response);
    }
    const json = await response.json();
    return { ...entry, id: json.Id };
  }

  public async updateEntry(entry: IScheduleEntry): Promise<IScheduleEntry> {
    const response = await this._client.post(
      this._list(this._lists.entriesList) + '/items(' + entry.id + ')',
      SPHttpClient.configurations.v1,
      {
        headers: { ...JSON_HEADERS, 'IF-MATCH': '*', 'X-HTTP-Method': 'MERGE' },
        body: JSON.stringify(entryToSpBody(entry, this._f.entries))
      }
    );
    if (!response.ok) {
      throw await readError(response);
    }
    return entry;
  }

  public async deleteEntry(id: number): Promise<void> {
    const response = await this._client.post(
      this._list(this._lists.entriesList) + '/items(' + id + ')',
      SPHttpClient.configurations.v1,
      { headers: { ...JSON_HEADERS, 'IF-MATCH': '*', 'X-HTTP-Method': 'DELETE' } }
    );
    if (!response.ok) {
      throw await readError(response);
    }
  }

  private _list(listRef: string): string {
    return listApiUrl(this._webUrl, listRef);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async _get(url: string): Promise<any> {
    const response = await this._client.get(url, SPHttpClient.configurations.v1, { headers: JSON_HEADERS });
    if (!response.ok) {
      throw await readError(response);
    }
    return response.json();
  }

  /** 件数が多いときは、次のページ(odata.nextLink)も続けて読む */
  private async _getAll(url: string): Promise<ISpRow[]> {
    const rows: ISpRow[] = [];
    let next: string | undefined = url;
    while (next) {
      const json = await this._get(next);
      (json.value || []).forEach((r: ISpRow) => rows.push(r));
      next = json['odata.nextLink'];
    }
    return rows;
  }
}
