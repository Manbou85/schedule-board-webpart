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
  return { entries: d.entries || [], leaves: d.leaves || [], holidayWorks: d.holidayWorks || [], crew: d.crew || [] };
}

describe('終わった今日の予定を薄く表示する(ちょっと外出 → 帰社しました)', () => {
  const longSite = period('2026-11-01', '2026-11-30');
  const now = { date: '2026-11-17', time: '11:30' };

  it('戻りの時刻を過ぎた今日の単発予定は「終わった予定」になる', () => {
    const done = single('2026-11-17', '銀行', { startTime: '10:00', endTime: '11:00' });
    const later = single('2026-11-17', '打合せ', { startTime: '14:00', endTime: '15:00' });
    const cell = resolveCell(TUE, W, data({ entries: [done, later] }), undefined, now);
    expect(cell.content).toEqual({ kind: 'single', entries: [done, later], finishedIds: [done.id] });
  });

  it('戻りの時刻ちょうども終わった扱い。戻り時刻のない予定は終わらない', () => {
    const justNow = single('2026-11-17', '郵便局', { startTime: '11:00', endTime: '11:30' });
    const noEnd = single('2026-11-17', '現場確認', { startTime: '09:00' });
    const cell = resolveCell(TUE, W, data({ entries: [justNow, noEnd] }), undefined, now);
    expect(cell.content).toEqual({ kind: 'single', entries: [noEnd, justNow], finishedIds: [justNow.id] });
  });

  it('単発予定がすべて終わっていて長期の予定があれば、長期の予定を出し、終わった予定を添える', () => {
    const done = single('2026-11-17', '銀行', { startTime: '10:00', endTime: '11:00' });
    const cell = resolveCell(TUE, W, data({ entries: [longSite, done] }), undefined, now);
    expect(cell.content).toEqual({ kind: 'period', entry: longSite, dimmed: false, finished: [done] });
  });

  it('長期の予定がなければ、終わった予定を薄く出したまま', () => {
    const done = single('2026-11-17', '銀行', { startTime: '10:00', endTime: '11:00' });
    const cell = resolveCell(TUE, W, data({ entries: [done] }), undefined, now);
    expect(cell.content).toEqual({ kind: 'single', entries: [done], finishedIds: [done.id] });
  });

  it('今日以外の日は薄くしない(過去の週も見やすいように)', () => {
    const yesterday = single('2026-11-16', '銀行', { startTime: '10:00', endTime: '11:00' });
    const cell = resolveCell(MON, W, data({ entries: [yesterday] }), undefined, now);
    expect(cell.content).toEqual({ kind: 'single', entries: [yesterday], finishedIds: [] });
  });
});

describe('1マスの表示ルール(6-2)', () => {
  const longSite = period('2026-11-01', '2026-11-30');

  it('6. 何もなければ空欄', () => {
    const cell = resolveCell(TUE, W, data({}));
    expect(cell.content).toEqual({ kind: 'empty' });
    expect(cell.badges).toEqual([]);
  });

  it('5. 平日で長期の予定があれば、通常表示', () => {
    const cell = resolveCell(TUE, W, data({ entries: [longSite] }));
    expect(cell.content).toEqual({ kind: 'period', entry: longSite, dimmed: false, finished: [] });
  });

  it('4. 休日(休日出勤なし)は、長期の予定があっても空欄', () => {
    const cell = resolveCell(SAT, W, data({ entries: [longSite] }));
    expect(cell.content).toEqual({ kind: 'empty' });
    expect(cell.isHoliday).toBe(true);
  });

  it('4. 休日で予定がなければ空欄', () => {
    expect(resolveCell(SAT, W, data({})).content.kind).toBe('empty');
  });

  it('3. 単発の予定は長期の予定より優先', () => {
    const s = single('2026-11-17', '本社で打合せ');
    const cell = resolveCell(TUE, W, data({ entries: [longSite, s] }));
    // 隠れた長期の予定も持っておく(人数のまとめで使う)
    expect(cell.content).toEqual({ kind: 'single', entries: [s], finishedIds: [], underlying: longSite });
  });

  it('3. 休日の単発予定もそのまま表示', () => {
    const s = single('2026-11-21', '研修会', { category: '研修' });
    // 休日は長期の予定を使わないので、隠れた長期の予定も持たない
    expect(resolveCell(SAT, W, data({ entries: [longSite, s] })).content).toEqual({
      kind: 'single',
      entries: [s],
      finishedIds: []
    });
  });

  it('3. 単発が同じ日に複数あれば、時刻の早い順(時刻なしは後ろ)', () => {
    const a = single('2026-11-17', '午後の外出', { startTime: '13:00' });
    const b = single('2026-11-17', '時刻なし');
    const c = single('2026-11-17', '朝の外出', { startTime: '09:00' });
    const cell = resolveCell(TUE, W, data({ entries: [a, b, c] }));
    expect(cell.content).toEqual({ kind: 'single', entries: [c, a, b], finishedIds: [] });
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

  it('設定を「単発の予定を優先」に切り替えると、単発の予定が休暇より優先になる(休日出勤よりは下)', () => {
    const lv = leave('2026-11-17', 'fullDay');
    const s = single('2026-11-17', '外出');
    const opt = { leaveBeforeSingle: false };
    expect(resolveCell(TUE, W, data({ entries: [longSite, s], leaves: [lv] }), opt).content).toEqual({
      kind: 'single',
      entries: [s],
      finishedIds: [],
      underlying: longSite
    });
    // 単発がなければ、休暇が長期の予定より優先
    expect(resolveCell(TUE, W, data({ entries: [longSite], leaves: [lv] }), opt).content).toEqual({ kind: 'leave', leave: lv });
    // 休日出勤と重なっても、休暇は休日出勤より下にならない(以前は休日出勤が出ていた)
    const hw = holidayWork('2026-11-17', '本社');
    expect(resolveCell(TUE, W, data({ entries: [longSite], leaves: [lv], holidayWorks: [hw] }), opt).content).toEqual({
      kind: 'leave',
      leave: lv
    });
  });

  it('午前・午後・遅刻・早退は、表示の上にバッジとして重ねる(補足つき)', () => {
    const cell = resolveCell(
      TUE,
      W,
      data({ entries: [longSite], leaves: [leave('2026-11-17', 'early', ' 15:00 早退 '), leave('2026-11-17', 'morning')] })
    );
    expect(cell.content).toEqual({ kind: 'period', entry: longSite, dimmed: false, finished: [] });
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
  it('長期の予定が週をまたいで帯のように並び、休日は空欄、単発・休暇で上書きされる', () => {
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
    expect(summary).toEqual(['A現場', 'A現場', 'single', 'A現場', 'leave', 'empty', 'empty']);
    expect(MON.isHoliday).toBe(false);
  });
});

describe('作業員の行き先リスト(別サイト)', () => {
  const longSite = period('2026-11-01', '2026-11-30', '行動予定の現場');
  const crewSite: IScheduleEntry = { ...period('2026-11-16', '2026-11-20', '作業員の現場'), id: -5, readOnly: true };

  it('行動予定表の長期の予定より、作業員の行き先を優先する', () => {
    const cell = resolveCell(TUE, W, data({ entries: [longSite], crew: [crewSite] }));
    expect(cell.content).toEqual({ kind: 'period', entry: crewSite, dimmed: false, finished: [] });
  });

  it('単発の予定・総務の休暇・休日出勤は、作業員の行き先より優先する', () => {
    const s = single('2026-11-17', '研修センター');
    expect(resolveCell(TUE, W, data({ entries: [s], crew: [crewSite] })).content.kind).toBe('single');
    expect(resolveCell(TUE, W, data({ leaves: [leave('2026-11-17', 'fullDay')], crew: [crewSite] })).content.kind).toBe('leave');
    const satCrew: IScheduleEntry = { ...crewSite, endDate: '2026-11-22' };
    expect(
      resolveCell(SAT, W, data({ holidayWorks: [holidayWork('2026-11-21', '本社')], crew: [satCrew] })).content.kind
    ).toBe('holidayWork');
  });

  it('休日は作業員の行き先も出さない。期間の外も出さない', () => {
    const satCrew: IScheduleEntry = { ...crewSite, endDate: '2026-11-22' };
    expect(resolveCell(SAT, W, data({ crew: [satCrew] })).content).toEqual({ kind: 'empty' });
    expect(resolveCell(MON, W, data({ crew: [{ ...crewSite, startDate: '2026-11-17' }] })).content).toEqual({ kind: 'empty' });
  });
});

describe('作業員の行き先が同じ日に2行以上(ver 0.9.0)', () => {
  // ID はリストの ID をマイナスにしたもの(-5 が先に登録、-9 があと)
  const longA: IScheduleEntry = { ...period('2026-11-10', '2026-11-30', 'A現場(長期)'), id: -5, readOnly: true };
  const dayB: IScheduleEntry = { ...period('2026-11-17', '2026-11-17', 'B現場'), id: -9, readOnly: true };

  it('すべて出す:早く始まった行を帯に、ほかは帯の下の箱に', () => {
    const cell = resolveCell(TUE, W, data({ crew: [dayB, longA] }));
    expect(cell.content).toEqual({ kind: 'period', entry: longA, dimmed: false, finished: [], extras: [dayB] });
    expect(cellPlaces(cell)).toEqual(['A現場(長期)', 'B現場']);
  });

  it('同じ日に始まる行は、登録の早い順(先に登録した行が帯)', () => {
    const a: IScheduleEntry = { ...dayB, id: -20, title: '先に登録' };
    const b: IScheduleEntry = { ...dayB, id: -21, title: 'あとで登録' };
    const cell = resolveCell(TUE, W, data({ crew: [b, a] }));
    expect(cell.content).toEqual({ kind: 'period', entry: a, dimmed: false, finished: [], extras: [b] });
  });

  it('「休暇」の行があれば、その日は休暇だけを出す', () => {
    const off: IScheduleEntry = { ...dayB, id: -30, title: '休暇', category: '休暇' };
    const cell = resolveCell(TUE, W, data({ crew: [longA, off] }));
    expect(cell.content).toEqual({ kind: 'period', entry: off, dimmed: false, finished: [] });
  });

  it('休日は、作業員の行き先をどれも出さない', () => {
    const sat: IScheduleEntry = { ...dayB, startDate: '2026-11-21', endDate: '2026-11-21' };
    expect(resolveCell(SAT, W, data({ crew: [longA, sat] })).content).toEqual({ kind: 'empty' });
  });
});

describe('作業員の行き先から作った札(早退・遅刻・午前休・午後休)', () => {
  const crewEarly: ILeave = { id: -900, workerId: W, date: '2026-11-17', kind: 'early', remarks: '早退 15時', fromCrew: true };
  const site = period('2026-11-01', '2026-11-30');

  it('現場の帯はそのまま、札を重ねる(書いた文字は補足)', () => {
    const cell = resolveCell(TUE, W, data({ entries: [site], leaves: [crewEarly] }));
    expect(cell.content.kind).toBe('period');
    expect(cell.badges).toEqual([{ kind: 'early', label: '早退', remarks: '早退 15時' }]);
  });

  it('総務が同じ種類を入力したら、総務の札だけを出す', () => {
    const cell = resolveCell(TUE, W, data({ entries: [site], leaves: [crewEarly, leave('2026-11-17', 'early', '15:00退社')] }));
    expect(cell.badges).toEqual([{ kind: 'early', label: '早退', remarks: '15:00退社' }]);
  });

  it('総務が「1日」を入力したら、休暇だけ(札は出さない)', () => {
    const cell = resolveCell(TUE, W, data({ entries: [site], leaves: [crewEarly, leave('2026-11-17', 'fullDay')] }));
    expect(cell.content.kind).toBe('leave');
    expect(cell.badges).toEqual([]);
  });

  it('休日には、作業員の行き先から作った札を出さない(総務の札は出す)', () => {
    const satCrew: ILeave = { ...crewEarly, date: '2026-11-21' };
    expect(resolveCell(SAT, W, data({ leaves: [satCrew] })).badges).toEqual([]);
    expect(resolveCell(SAT, W, data({ leaves: [leave('2026-11-21', 'late')] })).badges.map((b) => b.kind)).toEqual(['late']);
  });

  it('午前休・午後休の札がある人は、区分「休暇」にも入る', () => {
    const pm: ILeave = { ...crewEarly, kind: 'afternoon', remarks: '休暇 PM' };
    expect(cellCategories(resolveCell(TUE, W, data({ entries: [site], leaves: [pm] })))).toEqual(['現場', '休暇']);
  });
});

describe('担当者ごとの振り分けと、検索用の文字', () => {
  it('担当者ごとにデータを分ける', () => {
    const a = single('2026-11-17', 'a');
    const b: IScheduleEntry = { ...single('2026-11-17', 'b'), workerId: 2 };
    const lv: ILeave = { ...leave('2026-11-17', 'fullDay'), workerId: 2 };
    const map = groupByWorker(data({ entries: [a, b], leaves: [lv] }));
    expect(map.get(1)).toEqual({ entries: [a], leaves: [], holidayWorks: [], crew: [] });
    expect(map.get(2)).toEqual({ entries: [b], leaves: [lv], holidayWorks: [], crew: [] });
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
