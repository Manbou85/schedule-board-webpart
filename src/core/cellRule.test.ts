import { cellCategories, cellPlaces, groupByWorker, resolveCell, resolveRow, IWorkerDayData } from './cellRule';
import { weekDates } from './dateUtils';
import { createHolidayCalendar } from './holiday';
import { ICell, IHolidayWork, ILeave, IScheduleEntry } from './types';

// 2026-11-16(月)〜 2026-11-22(日)の週で試す。11/21(土)は休日
const calendar = createHolidayCalendar([]);
const MON = calendar('2026-11-16');
const TUE = calendar('2026-11-17');
const SAT = calendar('2026-11-21');

const W = 1; // 担当者ID

let nextId = 100;
function period(start: string, end: string, title: string = '〇〇ビル新築工事', extra: Partial<IScheduleEntry> = {}): IScheduleEntry {
  return { id: nextId++, workerId: W, title, entryType: 'period', category: '現場', startDate: start, endDate: end, ...extra };
}
function single(date: string, title: string, extra: Partial<IScheduleEntry> = {}): IScheduleEntry {
  return { id: nextId++, workerId: W, title, entryType: 'single', category: '外出', startDate: date, endDate: date, ...extra };
}
function leave(date: string, kind: ILeave['kind'], remarks?: string): ILeave {
  return { id: nextId++, workerId: W, date, kind, remarks };
}
function holidayWork(date: string, workPlace: string): IHolidayWork {
  return { id: nextId++, workerId: W, date, workPlace, startTime: '08:00', endTime: '17:30' };
}
function data(d: Partial<IWorkerDayData>): IWorkerDayData {
  return { entries: d.entries || [], leaves: d.leaves || [], holidayWorks: d.holidayWorks || [] };
}

describe('1マスの表示ルール(6-2)', () => {
  const longSite = period('2026-11-01', '2026-11-30');

  it('6. 何もなければ空欄', () => {
    const cell = resolveCell(TUE, W, data({}));
    expect(cell.content).toEqual({ kind: 'empty' });
    expect(cell.badges).toEqual([]);
  });

  it('5. 平日で長期の予定があれば、通常表示', () => {
    const cell = resolveCell(TUE, W, data({ entries: [longSite] }));
    expect(cell.content).toEqual({ kind: 'period', entry: longSite, dimmed: false });
  });

  it('4. 休日は長期の予定を薄く表示', () => {
    const cell = resolveCell(SAT, W, data({ entries: [longSite] }));
    expect(cell.content).toEqual({ kind: 'period', entry: longSite, dimmed: true });
    expect(cell.isHoliday).toBe(true);
  });

  it('4. 休日で予定がなければ空欄', () => {
    expect(resolveCell(SAT, W, data({})).content.kind).toBe('empty');
  });

  it('3. 単発の予定は長期の予定より優先', () => {
    const s = single('2026-11-17', '本社で打合せ');
    const cell = resolveCell(TUE, W, data({ entries: [longSite, s] }));
    expect(cell.content).toEqual({ kind: 'single', entries: [s] });
  });

  it('3. 休日の単発予定もそのまま表示', () => {
    const s = single('2026-11-21', '研修会', { category: '研修' });
    expect(resolveCell(SAT, W, data({ entries: [longSite, s] })).content).toEqual({ kind: 'single', entries: [s] });
  });

  it('3. 単発が同じ日に複数あれば、時刻の早い順(時刻なしは後ろ)', () => {
    const a = single('2026-11-17', '午後の外出', { startTime: '13:00' });
    const b = single('2026-11-17', '時刻なし');
    const c = single('2026-11-17', '朝の外出', { startTime: '09:00' });
    const cell = resolveCell(TUE, W, data({ entries: [a, b, c] }));
    expect(cell.content).toEqual({ kind: 'single', entries: [c, a, b] });
  });

  it('2. 休日出勤は単発・長期の予定より優先し、出勤先と時刻を出す', () => {
    const hw = holidayWork('2026-11-21', '本社');
    const s = single('2026-11-21', '研修会');
    const cell = resolveCell(SAT, W, data({ entries: [longSite, s], holidayWorks: [hw] }));
    expect(cell.content).toEqual({ kind: 'holidayWork', holidayWork: hw, timeText: '08:00-17:30' });
  });

  it('1. 休暇(1日)は何よりも優先', () => {
    const lv = leave('2026-11-17', 'fullDay');
    const cell = resolveCell(
      TUE,
      W,
      data({ entries: [longSite, single('2026-11-17', '外出')], leaves: [lv], holidayWorks: [holidayWork('2026-11-17', '本社')] })
    );
    expect(cell.content).toEqual({ kind: 'leave', leave: lv });
  });

  it('【要確認】の設定を切り替えると、単発の予定が休暇より優先になる(休日出勤よりは下)', () => {
    const lv = leave('2026-11-17', 'fullDay');
    const s = single('2026-11-17', '外出');
    const opt = { leaveBeforeSingle: false };
    expect(resolveCell(TUE, W, data({ entries: [longSite, s], leaves: [lv] }), opt).content).toEqual({
      kind: 'single',
      entries: [s]
    });
    // 単発がなければ、休暇が長期の予定より優先
    expect(resolveCell(TUE, W, data({ entries: [longSite], leaves: [lv] }), opt).content).toEqual({ kind: 'leave', leave: lv });
  });

  it('午前・午後・遅刻・早退は、表示の上にバッジとして重ねる(補足つき)', () => {
    const cell = resolveCell(
      TUE,
      W,
      data({ entries: [longSite], leaves: [leave('2026-11-17', 'early', ' 15:00 早退 '), leave('2026-11-17', 'morning')] })
    );
    expect(cell.content).toEqual({ kind: 'period', entry: longSite, dimmed: false });
    // 並びは1日の流れの順(午前休 → 早退)。補足は前後の空白を取る
    expect(cell.badges).toEqual([
      { kind: 'morning', label: '午前休' },
      { kind: 'early', label: '早退', remarks: '15:00 早退' }
    ]);
  });

  it('「1日」休暇の日はバッジを出さない', () => {
    const cell = resolveCell(TUE, W, data({ leaves: [leave('2026-11-17', 'fullDay'), leave('2026-11-17', 'afternoon')] }));
    expect(cell.content.kind).toBe('leave');
    expect(cell.badges).toEqual([]);
  });

  it('ほかの人・ほかの日のデータは使わない', () => {
    const other: IScheduleEntry = { ...single('2026-11-17', '他人の予定'), workerId: 2 };
    const otherDay = single('2026-11-18', '翌日の予定');
    const cell = resolveCell(TUE, W, data({ entries: [other, otherDay], leaves: [{ ...leave('2026-11-17', 'fullDay'), workerId: 2 }] }));
    expect(cell.content.kind).toBe('empty');
  });

  it('長期の予定が重なったら、あとから始まった予定を出す', () => {
    const older = period('2026-10-01', '2026-12-31', 'A現場');
    const newer = period('2026-11-10', '2026-11-20', 'B現場');
    const content = resolveCell(TUE, W, data({ entries: [older, newer] })).content;
    expect(content.kind === 'period' && content.entry.title).toBe('B現場');
  });
});

describe('1人ぶんの行(1週間)', () => {
  it('長期の予定が週をまたいで帯のように並び、休日は薄く、単発・休暇で上書きされる', () => {
    const site = period('2026-11-01', '2026-11-30', 'A現場');
    const days = weekDates('2026-11-17').map(calendar);
    const row = resolveRow(
      days,
      W,
      data({
        entries: [site, single('2026-11-18', '本社', { category: '在社' })],
        leaves: [leave('2026-11-20', 'fullDay')]
      })
    );
    const summary = row.map((c: ICell) => {
      const x = c.content;
      return x.kind === 'period' ? (x.dimmed ? '薄:' : '') + x.entry.title : x.kind;
    });
    expect(summary).toEqual(['A現場', 'A現場', 'single', 'A現場', 'leave', '薄:A現場', '薄:A現場']);
    expect(MON.isHoliday).toBe(false);
  });
});

describe('担当者ごとの振り分けと、検索用の文字', () => {
  it('担当者ごとにデータを分ける', () => {
    const a = single('2026-11-17', 'a');
    const b: IScheduleEntry = { ...single('2026-11-17', 'b'), workerId: 2 };
    const lv: ILeave = { ...leave('2026-11-17', 'fullDay'), workerId: 2 };
    const map = groupByWorker(data({ entries: [a, b], leaves: [lv] }));
    expect(map.get(1)).toEqual({ entries: [a], leaves: [], holidayWorks: [] });
    expect(map.get(2)).toEqual({ entries: [b], leaves: [lv], holidayWorks: [] });
    expect(map.get(3)).toBeUndefined();
  });

  it('マスに出ている行き先と区分を取り出す', () => {
    const hwCell = resolveCell(SAT, W, data({ holidayWorks: [holidayWork('2026-11-21', '△△橋梁工事')] }));
    expect(cellPlaces(hwCell)).toEqual(['△△橋梁工事']);
    expect(cellCategories(hwCell)).toEqual(['休日出勤']);

    const leaveCell = resolveCell(TUE, W, data({ leaves: [leave('2026-11-17', 'fullDay')] }));
    expect(cellPlaces(leaveCell)).toEqual([]);
    expect(cellCategories(leaveCell)).toEqual(['休暇']);

    const periodCell = resolveCell(TUE, W, data({ entries: [period('2026-11-01', '2026-11-30', 'A現場')] }));
    expect(cellPlaces(periodCell)).toEqual(['A現場']);
    expect(cellCategories(periodCell)).toEqual(['現場']);
  });
});
