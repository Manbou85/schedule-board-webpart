// 区分ごとのアイコンと色の対応表
// 区分の選択肢はリストの列設定から読むので、ここにない区分は「共通のアイコン」で表示する。
// アイコンは Icon.tsx の線画(外部のフォントや画像を読み込まない)。

import { IconName } from './Icon';

export interface ICategoryStyle {
  icon: IconName;
  /** アイコンや印の色(文字の色ではない) */
  color: string;
  /** 帯の背景(うすい色) */
  background: string;
}

const STYLES: { [category: string]: ICategoryStyle } = {
  現場: { icon: 'helmet', color: '#c25e00', background: '#fdebd8' },
  在社: { icon: 'building', color: '#0f6cbd', background: '#e0eefb' },
  外出: { icon: 'car', color: '#00807a', background: '#d9f2f0' },
  出張: { icon: 'suitcase', color: '#7a45b0', background: '#eee5f7' },
  研修: { icon: 'book', color: '#3b7d23', background: '#e3f1dc' },
  その他: { icon: 'pin', color: '#8a6d00', background: '#f7efcf' }
};

/** 対応表にない区分のとき */
export const DEFAULT_CATEGORY_STYLE: ICategoryStyle = { icon: 'tag', color: '#5c5c5c', background: '#eeeeee' };

/** 休暇・休日出勤(総務のリスト)の見た目 */
export const LEAVE_STYLE: ICategoryStyle = { icon: 'sun', color: '#b0256a', background: '#fbe3ef' };

// 本人が入れる区分「休暇」も、総務の休暇と同じ見た目(ver 0.7.0。呼び方を「休暇」にそろえ、見た目も1つにした。開発者回答)
STYLES['休暇'] = LEAVE_STYLE;
export const HOLIDAY_WORK_STYLE: ICategoryStyle = { icon: 'calendarCheck', color: '#a4262c', background: '#fde7e9' };

export function getCategoryStyle(category: string): ICategoryStyle {
  return STYLES[category.trim()] || DEFAULT_CATEGORY_STYLE;
}
