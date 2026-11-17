// 休日の判定
// - 土日は自動で休日
// - 会社休日リストの「休日」(祝日・会社独自の休み)も休日
// - 会社休日リストの「出勤日」(出勤土曜など)は、土日でも平日あつかい

import { dayOfWeek } from './dateUtils';
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
    if (company && company.dayType === 'holiday' && company.name) {
      info.holidayName = company.name;
    }
    return info;
  };
}
