import { cellStatus, NO_ENTRY_STATUS, summarizeStatus } from './summary';
import { ICell, IScheduleEntry, IWorker } from './types';

const DATE = '2026-11-18';
let nextId = 1;
function entry(category: string, extra: Partial<IScheduleEntry> = {}): IScheduleEntry {
  return { id: nextId++, workerId: 1, title: 'x', entryType: 'single', category, startDate: DATE, endDate: DATE, ...extra };
}
function cell(content: ICell['content'], date: string = DATE): ICell {
  return { date, workerId: 1, isHoliday: false, content, badges: [] };
}
const now = { date: DATE, time: '10:30' };

describe('1人の状態(人数のまとめ)', () => {
  it('休暇・休日出勤・長期の予定・何もなし', () => {
    expect(cellStatus(cell({ kind: 'leave', leave: { id: 1, workerId: 1, date: DATE, kind: 'fullDay' } }))).toBe('休暇');
    expect(
      cellStatus(cell({ kind: 'holidayWork', holidayWork: { id: 1, workerId: 1, date: DATE, workPlace: '本社' }, timeText: '' }))
    ).toBe('休日出勤');
    expect(cellStatus(cell({ kind: 'period', entry: entry('現場', { entryType: 'period' }), dimmed: false, finished: [] }))).toBe('現場');
    expect(cellStatus(cell({ kind: 'empty' }))).toBe(NO_ENTRY_STATUS);
  });

  it('今日の単発予定は、今の時刻に始まっていて終わっていないもの', () => {
    const out = entry('外出', { startTime: '10:00', endTime: '11:00' });
    const later = entry('研修', { startTime: '13:00', endTime: '16:00' });
    expect(cellStatus(cell({ kind: 'single', entries: [out, later], finishedIds: [] }), now)).toBe('外出');
  });

  it('まだ始まっていない予定だけなら、長期の予定。それもなければ予定なし', () => {
    const later = entry('外出', { startTime: '15:00' });
    const site = entry('現場', { entryType: 'period' });
    expect(cellStatus(cell({ kind: 'single', entries: [later], finishedIds: [], underlying: site }), now)).toBe('現場');
    expect(cellStatus(cell({ kind: 'single', entries: [later], finishedIds: [] }), now)).toBe(NO_ENTRY_STATUS);
  });

  it('終わった予定は数えない。時刻のない予定は1日中', () => {
    const done = entry('外出', { startTime: '09:00', endTime: '10:00' });
    const allDay = entry('在社');
    expect(cellStatus(cell({ kind: 'single', entries: [done, allDay], finishedIds: [done.id] }), now)).toBe('在社');
    expect(cellStatus(cell({ kind: 'single', entries: [done], finishedIds: [done.id] }), now)).toBe(NO_ENTRY_STATUS);
  });

  it('今日以外の日は、その日のはじめの予定', () => {
    const a = entry('出張', { startDate: '2026-11-20', endDate: '2026-11-20', startTime: '08:00' });
    const b = entry('外出', { startDate: '2026-11-20', endDate: '2026-11-20', startTime: '13:00' });
    expect(cellStatus(cell({ kind: 'single', entries: [a, b], finishedIds: [] }, '2026-11-20'), now)).toBe('出張');
  });
});

describe('人数のまとめ', () => {
  const workers: IWorker[] = [1, 2, 3, 4].map((id) => ({ id, name: 'n' + id, no: '0' + id, department: 'd' }));
  const rows = new Map<number, ICell[]>([
    [1, [cell({ kind: 'period', entry: entry('現場', { entryType: 'period' }), dimmed: false, finished: [] })]],
    [2, [cell({ kind: 'single', entries: [entry('在社')], finishedIds: [] })]],
    [3, [cell({ kind: 'leave', leave: { id: 9, workerId: 3, date: DATE, kind: 'fullDay' } })]],
    [4, [cell({ kind: 'empty' })]]
  ]);

  it('区分の選択肢の順に並べ、休日出勤・予定なしはうしろ。0人の区分は出さない。総務の休暇は「休み」として数える', () => {
    expect(summarizeStatus(workers, rows, 0, ['在社', '外出', '現場'], now)).toEqual([
      { status: '在社', count: 1, workerIds: [2] },
      { status: '現場', count: 1, workerIds: [1] },
      { status: '休み', count: 1, workerIds: [3] },
      { status: '予定なし', count: 1, workerIds: [4] }
    ]);
  });

  it('総務の「休暇」と本人の区分「休み」は、あわせて「休み」(選択肢の「休み」の位置に)', () => {
    const r = new Map<number, ICell[]>(rows);
    r.set(4, [cell({ kind: 'single', entries: [entry('休み')], finishedIds: [] })]);
    expect(summarizeStatus(workers, r, 0, ['在社', '休み', '現場'], now)).toEqual([
      { status: '在社', count: 1, workerIds: [2] },
      { status: '休み', count: 2, workerIds: [3, 4] },
      { status: '現場', count: 1, workerIds: [1] }
    ]);
  });

  it('選択肢にない区分も数える(作業員の行き先の「現場」など)', () => {
    expect(summarizeStatus(workers, rows, 0, ['在社'], now).map((s) => s.status)).toEqual(['在社', '休み', '現場', '予定なし']);
  });
});
