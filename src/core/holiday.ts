// 休日の判定
// - 土日は自動で休日
// - 会社休日リストの種別が「出勤日」以外(祝日・休業日・一斉有給など)の日も休日
// - 会社休日リストの「出勤日」(出勤土曜など)は、土日でも平日あつかい
// - 見出しに出す文字は、名称があれば名称、空欄なら種別の文字
//   (土日を「出勤日」にした日も、休日と同じく見出しに文字を出す。背景色だけでは気づきにくいため)

import { dayOfWeek } from './dateUtils';
import { COMPANY_WORKDAY_LABEL } from './labels';
import { DateKey, ICompanyHoliday, IDayInfo } from './types';

/** 休日の判定をする関数を作る(会社休日リストは最初に1回だけ整理する) */
export function createHolidayCalendar(holidays: ICompanyHoliday[]): (date: DateKey) => IDayInfo {
  const byDate = new Map<DateKey, ICompanyHoliday>();
  holidays.forEach((h) => {
    const existing = byDate.get(h.date);
    // 同じ日に「休日」と「出勤日」が両方あるときは「出勤日」を優先する(出勤の予定を見落とさないため)
    if (!existing || h.dayType === 'workday') {
      byDate.set(h.date, h);
    }
  });

  return (date: DateKey): IDayInfo => {
    const w = dayOfWeek(date);
    const company = byDate.get(date);
    let isHoliday = w === 0 || w === 6;
    if (company) {
      isHoliday = company.dayType === 'holiday';
    }
    const info: IDayInfo = { date, dayOfWeek: w, isHoliday };
    if (company && company.dayType === 'holiday') {
      const label = company.name || company.kindLabel || '';
      if (label) {
        info.holidayName = label;
      }
    }
    // 土日を出勤日にした日だけ(平日の「出勤日」は見た目が変わらないので出さない)
    if (company && company.dayType === 'workday' && (w === 0 || w === 6)) {
      info.workdayName = company.name || company.kindLabel || COMPANY_WORKDAY_LABEL;
    }
    return info;
  };
}
