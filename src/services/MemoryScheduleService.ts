// プレビュー版で使う、メモリ上だけのデータ置き場
// ブラウザの保存機能(localStorage など)は使わない。ページを開き直すと元に戻る。

import { DateKey, IScheduleEntry, IWorker, overlapsRange } from '../core';
import { ICurrentUser, IRangeData, IScheduleDataService } from './IScheduleDataService';

export interface IMemoryData extends IRangeData {
  workers: IWorker[];
  categories: string[];
  currentUser: ICurrentUser;
}

/** プレビューで、保存に失敗したときの画面を確かめるためのエラー */
export class PreviewSaveError extends Error {
  public constructor() {
    super('プレビュー:保存に失敗させる設定になっています');
    // TypeScript の出力が ES5 のため、instanceof が効くように型をつなぎ直す
    Object.setPrototypeOf(this, PreviewSaveError.prototype);
  }
}

export class MemoryScheduleService implements IScheduleDataService {
  /** true のあいだ、登録・変更・削除がすべて失敗する(プレビューの確認用) */
  public failSaves: boolean = false;

  private readonly _data: IMemoryData;
  private _nextId: number;

  public constructor(data: IMemoryData) {
    this._data = data;
    this._nextId = data.entries.reduce((max, e) => Math.max(max, e.id), 0) + 1;
  }

  /** ログイン中のユーザーを差し替える(プレビューで「管理者として見る」ため) */
  public setCurrentUser(user: ICurrentUser): void {
    this._data.currentUser = { ...user };
  }

  public getWorkers(): Promise<IWorker[]> {
    return Promise.resolve(this._data.workers.slice());
  }

  public getCategories(): Promise<string[]> {
    return Promise.resolve(this._data.categories.slice());
  }

  public getCurrentUser(): Promise<ICurrentUser> {
    return Promise.resolve({ ...this._data.currentUser });
  }

  public getRange(start: DateKey, end: DateKey): Promise<IRangeData> {
    const d = this._data;
    const inRange = (date: DateKey): boolean => start <= date && date <= end;
    const crew = (d.crewAssignments || []).filter((c) => overlapsRange(c.startDate, c.endDate, start, end));
    return Promise.resolve({
      // SharePoint から取り出すときと同じ条件(開始日 ≦ 最終日 かつ 終了日 ≧ 初日)
      entries: d.entries.filter((e) => overlapsRange(e.startDate, e.endDate, start, end)).map((e) => ({ ...e })),
      leaves: d.leaves.filter((l) => inRange(l.date)),
      holidayWorks: d.holidayWorks.filter((h) => inRange(h.date)),
      holidays: d.holidays.filter((h) => inRange(h.date)),
      crewAssignments: crew,
      crewInfo: d.crewAssignments ? { rows: crew.length, unreadable: 0 } : undefined
    });
  }

  public getRecentEntries(workerId: number, limit: number): Promise<IScheduleEntry[]> {
    const list = this._data.entries
      .filter((e) => e.workerId === workerId)
      .sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : b.id - a.id))
      .slice(0, limit)
      .map((e) => ({ ...e }));
    return Promise.resolve(list);
  }

  public createEntry(entry: Omit<IScheduleEntry, 'id'>): Promise<IScheduleEntry> {
    if (this.failSaves) {
      return Promise.reject(new PreviewSaveError());
    }
    const saved: IScheduleEntry = { ...entry, id: this._nextId++ };
    this._data.entries.push(saved);
    return Promise.resolve({ ...saved });
  }

  public updateEntry(entry: IScheduleEntry): Promise<IScheduleEntry> {
    if (this.failSaves) {
      return Promise.reject(new PreviewSaveError());
    }
    const i = this._indexOf(entry.id);
    if (i < 0) {
      return Promise.reject(new Error('予定が見つかりません'));
    }
    this._data.entries[i] = { ...entry };
    return Promise.resolve({ ...entry });
  }

  public deleteEntry(id: number): Promise<void> {
    if (this.failSaves) {
      return Promise.reject(new PreviewSaveError());
    }
    const i = this._indexOf(id);
    if (i >= 0) {
      this._data.entries.splice(i, 1);
    }
    return Promise.resolve();
  }

  private _indexOf(id: number): number {
    for (let i = 0; i < this._data.entries.length; i++) {
      if (this._data.entries[i].id === id) {
        return i;
      }
    }
    return -1;
  }
}
