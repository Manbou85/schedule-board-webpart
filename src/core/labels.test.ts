import { listCategoryValue, normalizeCategories, normalizeCategory, parseCompanyDayType, parseEntryType, parseLeaveKind } from './labels';

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

describe('区分の呼び方を「休暇」にそろえる(ver 0.7.0)', () => {
  it('古い呼び方「休み」は「休暇」にする。ほかの区分はそのまま', () => {
    expect(normalizeCategory('休み')).toBe('休暇');
    expect(normalizeCategory(' 休み ')).toBe('休暇');
    expect(normalizeCategory('休暇')).toBe('休暇');
    expect(normalizeCategory('在社')).toBe('在社');
  });

  it('選択肢の一覧も読み替え、同じ名前が2つになったら1つにする(順番はそのまま)', () => {
    expect(normalizeCategories(['現場', '在社', '休み', 'その他'])).toEqual(['現場', '在社', '休暇', 'その他']);
    expect(normalizeCategories(['現場', '休み', '休暇'])).toEqual(['現場', '休暇']);
  });

  it('書き込むとき:リストの選択肢に「休暇」があれば「休暇」で書く', () => {
    expect(listCategoryValue('休暇', ['現場', '休暇'])).toBe('休暇');
  });

  it('書き込むとき:リストの選択肢がまだ「休み」のままなら「休み」で書く(SharePoint が受け付けるように)', () => {
    expect(listCategoryValue('休暇', ['現場', '休み'])).toBe('休み');
    expect(listCategoryValue('在社', ['在社', '休み'])).toBe('在社');
  });

  it('選択肢が読めていないときは、そのまま書く', () => {
    expect(listCategoryValue('休暇', [])).toBe('休暇');
  });
});
