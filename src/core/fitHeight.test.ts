import { fitTableHeight } from './fitHeight';

describe('予定表の高さを画面に合わせる', () => {
  it('画面の残りの高さにぴったり合わせる', () => {
    // ノートPC・125%:見えている高さ 785、予定表の上まで 150、下に 50
    expect(fitTableHeight({ visibleHeight: 785, tableTop: 150, belowTable: 50, viewportWidth: 1500 })).toBe(585);
  });

  it('小数は切り捨てる(はみ出してページがスクロールしないように)', () => {
    expect(fitTableHeight({ visibleHeight: 800.6, tableTop: 100.2, belowTable: 0, viewportWidth: 1500 })).toBe(700);
  });

  it('スマホ幅では合わせない', () => {
    expect(fitTableHeight({ visibleHeight: 700, tableTop: 100, belowTable: 20, viewportWidth: 400 })).toBeUndefined();
  });

  it('WEBパーツがページの下のほうにあり、画面の半分も取れないときは合わせない', () => {
    expect(fitTableHeight({ visibleHeight: 900, tableTop: 500, belowTable: 20, viewportWidth: 1500 })).toBeUndefined();
  });

  it('下にほかの WEBパーツがたくさんあるときも合わせない', () => {
    expect(fitTableHeight({ visibleHeight: 900, tableTop: 150, belowTable: 1200, viewportWidth: 1500 })).toBeUndefined();
  });

  it('低すぎる画面では合わせない', () => {
    expect(fitTableHeight({ visibleHeight: 500, tableTop: 150, belowTable: 60, viewportWidth: 1500 })).toBeUndefined();
  });
});
