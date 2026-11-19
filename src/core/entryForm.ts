// 予定の登録フォームで使う、入力の整え方とチェック(画面に依存しない)

import { isValidDateKey } from './dateUtils';
import { DateKey, EntryType, IScheduleEntry } from './types';

/** フォームに入力中の内容(まだ保存していない予定) */
export interface IEntryDraft {
  /** 編集のときは元の予定のID。新しく登録するときは undefined */
  id?: number;
  workerId?: number;
  entryType: EntryType;
  category: string;
  title: string;
  startDate: DateKey;
  endDate: DateKey;
  startTime: string;
  endTime: string;
  note: string;
}

/** 入力の誤り(項目ごとの、やさしい文言) */
export interface IEntryErrors {
  workerId?: string;
  category?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  time?: string;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 新しく登録するときの、最初の入力内容 */
export function newDraft(workerId: number | undefined, date: DateKey): IEntryDraft {
  return {
    workerId,
    entryType: 'single',
    category: '',
    title: '',
    startDate: date,
    endDate: date,
    startTime: '',
    endTime: '',
    note: ''
  };
}

/** 保存済みの予定 → フォームの入力内容(編集するとき) */
export function draftFromEntry(e: IScheduleEntry): IEntryDraft {
  return {
    id: e.id,
    workerId: e.workerId,
    entryType: e.entryType,
    category: e.category,
    title: e.title,
    startDate: e.startDate,
    endDate: e.endDate,
    startTime: e.startTime || '',
    endTime: e.endTime || '',
    note: e.note || ''
  };
}

/** 入力の誤りを調べる。誤りがなければ空のオブジェクト */
export function validateDraft(d: IEntryDraft): IEntryErrors {
  const errors: IEntryErrors = {};
  if (d.workerId === undefined) {
    errors.workerId = '担当者を選んでください。';
  }
  if (!d.category.trim()) {
    errors.category = '区分を選んでください。';
  }
  if (!d.title.trim()) {
    errors.title = '行き先・現場名を入力してください。';
  } else if (d.title.trim().length > 255) {
    errors.title = '行き先・現場名は255文字以内で入力してください。';
  }
  if (!isValidDateKey(d.startDate)) {
    errors.startDate = d.entryType === 'single' ? '日付を選んでください。' : '開始日を選んでください。';
  }
  if (d.entryType === 'period') {
    if (!isValidDateKey(d.endDate)) {
      errors.endDate = '終了日を選んでください。';
    } else if (isValidDateKey(d.startDate) && d.endDate < d.startDate) {
      errors.endDate = '終了日は、開始日と同じ日か、それより後にしてください。';
    }
  }
  const s = d.startTime.trim();
  const e = d.endTime.trim();
  if ((s && !TIME_PATTERN.test(s)) || (e && !TIME_PATTERN.test(e))) {
    errors.time = '時刻は「09:00」のような形で入力してください。';
  } else if (s && e && e < s) {
    errors.time = '終了・戻り時刻は、開始時刻より後にしてください。';
  }
  return errors;
}

/** 誤りがないか */
export function hasErrors(errors: IEntryErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * 保存する形に整える(前後の空白を取る、単発は終了日=開始日、空の任意項目は undefined)。
 * validateDraft で誤りがないことを確かめてから呼ぶ。
 */
export function draftToEntry(d: IEntryDraft): Omit<IScheduleEntry, 'id'> & { id?: number } {
  const entry: Omit<IScheduleEntry, 'id'> & { id?: number } = {
    workerId: d.workerId as number,
    entryType: d.entryType,
    category: d.category.trim(),
    title: d.title.trim(),
    startDate: d.startDate,
    endDate: d.entryType === 'single' ? d.startDate : d.endDate
  };
  if (d.id !== undefined) {
    entry.id = d.id;
  }
  if (d.startTime.trim()) {
    entry.startTime = d.startTime.trim();
  }
  if (d.endTime.trim()) {
    entry.endTime = d.endTime.trim();
  }
  if (d.note.trim()) {
    entry.note = d.note.trim();
  }
  return entry;
}

/**
 * その人の予定を編集できるか(画面にボタンを出すかどうか)。
 * 本当の制限は SharePoint リストの権限で行う。ここは見た目のため。
 */
export function canEditWorker(workerId: number, selfId: number | undefined, isAdmin: boolean): boolean {
  return isAdmin || (selfId !== undefined && workerId === selfId);
}

/** ワンタップ登録のボタン(区分と、登録する行き先) */
export interface IQuickAction {
  category: string;
  title: string;
}

/**
 * ワンタップ登録の初期値。区分の選択肢にないものはボタンを出さない。
 * 【要確認】在社のときの行き先は「本社」としている。
 */
export const DEFAULT_QUICK_ACTIONS: IQuickAction[] = [
  { category: '在社', title: '本社' },
  { category: '休暇', title: '休暇' }
];

/** ワンタップ登録で保存する予定 */
export function quickDraft(workerId: number, date: DateKey, action: IQuickAction): IEntryDraft {
  return { ...newDraft(workerId, date), category: action.category, title: action.title };
}
