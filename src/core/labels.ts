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

/**
 * 区分の古い呼び方 → 新しい呼び方(ver 0.7.0)。
 * 総務の呼び方に合わせて、本人が入れる「休み」を「休暇」にそろえた(開発者の要望)。
 * リストの選択肢を変えたあとも、前に登録した予定(区分「休み」のまま残る)を「休暇」として扱うために使う。
 */
export const CATEGORY_ALIASES: { [oldName: string]: string } = {
  休み: '休暇'
};

/** 区分の名前を新しい呼び方にする(古い呼び方でなければそのまま) */
export function normalizeCategory(category: string): string {
  const c = category.trim();
  return Object.prototype.hasOwnProperty.call(CATEGORY_ALIASES, c) ? CATEGORY_ALIASES[c] : c;
}

/** 区分の選択肢の一覧を新しい呼び方にする(同じ名前が2つになったら1つにする。順番はそのまま) */
export function normalizeCategories(choices: string[]): string[] {
  const result: string[] = [];
  choices.forEach((c) => {
    const n = normalizeCategory(c);
    if (n && result.indexOf(n) < 0) {
      result.push(n);
    }
  });
  return result;
}

/**
 * リストに書き込む区分の値。リストの選択肢がまだ古い呼び方のまま(例「休み」)なら、古い呼び方で書く
 * (選択肢にない値は SharePoint が受け付けないため。選択肢を変える前に新しい版を入れても保存できるように)
 */
export function listCategoryValue(category: string, listChoices: string[]): string {
  if (listChoices.length === 0 || listChoices.indexOf(category) >= 0) {
    return category;
  }
  let value = category;
  Object.keys(CATEGORY_ALIASES).forEach((oldName) => {
    if (CATEGORY_ALIASES[oldName] === category && listChoices.indexOf(oldName) >= 0) {
      value = oldName;
    }
  });
  return value;
}
