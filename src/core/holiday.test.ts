import { createHolidayCalendar } from './holiday';

describe('休日の判定', () => {
  const calendar = createHolidayCalendar([
    { date: '2027-01-01', name: '元日', dayType: 'holiday' },
    { date: '2026-11-21', name: '出勤土曜', dayType: 'workday' },
    { date: '2026-11-23', name: '勤労感謝の日', dayType: 'holiday' }
  ]);

  it('平日は休日ではない', () => {
    expect(calendar('2026-11-17')).toEqual({ date: '2026-11-17', dayOfWeek: 2, isHoliday: false });
  });

  it('土日は自動で休日', () => {
    expect(calendar('2026-11-22').isHoliday).toBe(true);
    expect(calendar('2026-11-28').isHoliday).toBe(true);
  });

  it('会社休日リストの「休日」は休日で、名称が付く', () => {
    expect(calendar('2026-11-23')).toEqual({
      date: '2026-11-23',
      dayOfWeek: 1,
      isHoliday: true,
      holidayName: '勤労感謝の日'
    });
  });

  it('「出勤日」として登録された土曜は平日あつかい', () => {
    expect(calendar('2026-11-21').isHoliday).toBe(false);
    expect(calendar('2026-11-21').holidayName).toBeUndefined();
  });

  it('土日を「出勤日」にした日は、見出しに名称(空欄なら種別の文字)を出す', () => {
    expect(calendar('2026-11-21').workdayName).toBe('出勤土曜');
    const c = createHolidayCalendar([
      { date: '2026-11-28', name: '', dayType: 'workday', kindLabel: '出勤日' },
      { date: '2026-11-29', name: '', dayType: 'workday' },
      { date: '2026-11-25', name: '', dayType: 'workday', kindLabel: '出勤日' }
    ]);
    expect(c('2026-11-28').workdayName).toBe('出勤日');
    // 種別の文字も読めないときは「出勤日」
    expect(c('2026-11-29').workdayName).toBe('出勤日');
    // 平日の「出勤日」は見た目が変わらないので出さない
    expect(c('2026-11-25').workdayName).toBeUndefined();
    // 休日・ふつうの日には付かない
    expect(c('2026-11-30').workdayName).toBeUndefined();
  });

  it('名称が空欄なら、種別の文字(例 休業日)を見出しに出す', () => {
    const c = createHolidayCalendar([
      { date: '2026-08-13', name: '', dayType: 'holiday', kindLabel: '休業日' },
      { date: '2026-08-14', name: '夏季休業', dayType: 'holiday', kindLabel: '休業日' }
    ]);
    expect(c('2026-08-13')).toEqual({ date: '2026-08-13', dayOfWeek: 4, isHoliday: true, holidayName: '休業日' });
    // 名称があれば名称を優先する
    expect(c('2026-08-14').holidayName).toBe('夏季休業');
  });

  it('同じ日に「休日」と「出勤日」があれば「出勤日」を優先する', () => {
    const c = createHolidayCalendar([
      { date: '2026-12-05', name: '出勤土曜', dayType: 'workday' },
      { date: '2026-12-05', name: 'まちがい', dayType: 'holiday' }
    ]);
    expect(c('2026-12-05').isHoliday).toBe(false);
    expect(c('2026-12-05').workdayName).toBe('出勤土曜');
  });
});
