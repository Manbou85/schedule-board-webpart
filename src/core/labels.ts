// SharePoint リストの選択肢(日本語)と、プログラムの中の呼び名の対応

import { CompanyDayType, EntryType, LeaveKind } from './types';

/** 登録種別の選択肢 */
export const ENTRY_TYPE_LABELS: { [key in EntryType]: string } = {
  period: '期間',
  single: '単発'
};

/**
 * 会社休日の種別のうち、出勤日あつかいになる選択肢。
 * これ以外の選択肢(祝日・休業日・一斉有給など)は、すべて休日あつかい。
 * そのため、リストの選択肢を増やしても WEBパーツの作り直しは不要。
 */
export const COMPANY_WORKDAY_LABEL = '出勤日';

/** 休暇リストの AcquisitionTime の選択肢 */
export const LEAVE_KIND_LABELS: { [key in LeaveKind]: string } = {
  fullDay: '1日',
  morning: '午前',
  afternoon: '午後',
  late: '遅刻',
  early: '早退'
};

/** 予定表に出す休暇のバッジの文言 */
export const LEAVE_BADGE_LABELS: { [key in LeaveKind]: string } = {
  fullDay: '休暇',
  morning: '午前休',
  afternoon: '午後休',
  late: '遅刻',
  early: '早退'
};

function findKey<K extends string>(table: { [key in K]: string }, label: string | undefined): K | undefined {
  // 全角の「1日」でも半角の「1日」でも合うように、比べる前に文字の幅をそろえる
  const target = (label || '').normalize('NFKC').trim();
  const keys = Object.keys(table) as K[];
  for (let i = 0; i < keys.length; i++) {
    if (table[keys[i]].normalize('NFKC') === target) {
      return keys[i];
    }
  }
  return undefined;
}

/** '期間' → 'period'、'単発' → 'single'。知らない値は undefined */
export function parseEntryType(label: string | undefined): EntryType | undefined {
  return findKey(ENTRY_TYPE_LABELS, label);
}

/** '出勤日' → 'workday'、それ以外の選択肢(祝日・休業日など)→ 'holiday'。空欄は undefined */
export function parseCompanyDayType(label: string | undefined): CompanyDayType | undefined {
  const target = (label || '').normalize('NFKC').trim();
  if (!target) {
    return undefined;
  }
  return target === COMPANY_WORKDAY_LABEL ? 'workday' : 'holiday';
}

/** '1日' → 'fullDay' など。知らない値は undefined */
export function parseLeaveKind(label: string | undefined): LeaveKind | undefined {
  return findKey(LEAVE_KIND_LABELS, label);
}
