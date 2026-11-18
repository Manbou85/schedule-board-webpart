import { parseCompanyDayType, parseEntryType, parseLeaveKind } from './labels';

describe('リストの選択肢の読み取り', () => {
  it('登録種別', () => {
    expect(parseEntryType('期間')).toBe('period');
    expect(parseEntryType('単発')).toBe('single');
    expect(parseEntryType('その他')).toBeUndefined();
    expect(parseEntryType(undefined)).toBeUndefined();
  });

  it('会社休日の種別', () => {
    expect(parseCompanyDayType(' 出勤日 ')).toBe('workday');
    // 出勤日以外は、どんな選択肢でも休日あつかい(選択肢を足しても作り直し不要)
    expect(parseCompanyDayType('祝日')).toBe('holiday');
    expect(parseCompanyDayType('休業日')).toBe('holiday');
    expect(parseCompanyDayType('一斉有給')).toBe('holiday');
    expect(parseCompanyDayType('休日')).toBe('holiday');
    expect(parseCompanyDayType('')).toBeUndefined();
    expect(parseCompanyDayType(undefined)).toBeUndefined();
  });

  it('休暇の種類(全角数字の「1日」でも読める)', () => {
    expect(parseLeaveKind('1日')).toBe('fullDay');
    expect(parseLeaveKind('1日')).toBe('fullDay');
    expect(parseLeaveKind('午前')).toBe('morning');
    expect(parseLeaveKind('午後')).toBe('afternoon');
    expect(parseLeaveKind('遅刻')).toBe('late');
    expect(parseLeaveKind('早退')).toBe('early');
    expect(parseLeaveKind('半日')).toBeUndefined();
  });
});
