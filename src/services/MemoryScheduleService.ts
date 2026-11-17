// プレビュー版で使う、メモリ上だけのデータ置き場
// ブラウザの保存機能(localStorage など)は使わない。ページを開き直すと元に戻る。

import { DateKey, IWorker, overlapsRange } from '../core';
import { ICurrentUser, IRangeData, IScheduleDataService } from './IScheduleDataService';

export interface IMemoryData extends IRangeData {
  workers: IWorker[];
  categories: string[];
  currentUser: ICurrentUser;
}

export class MemoryScheduleService implements IScheduleDataService {
  private readonly _data: IMemoryData;

  public constructor(data: IMemoryData) {
    this._data = data;
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
    return Promise.resolve({
      // SharePoint から取り出すときと同じ条件(開始日 ≦ 最終日 かつ 終了日 ≧ 初日)
      entries: d.entries.filter((e) => overlapsRange(e.startDate, e.endDate, start, end)),
      leaves: d.leaves.filter((l) => inRange(l.date)),
      holidayWorks: d.holidayWorks.filter((h) => inRange(h.date)),
      holidays: d.holidays.filter((h) => inRange(h.date))
    });
  }
}
