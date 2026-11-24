import { NO_ENTRY_STATUS, summarizeCategories, summaryDateFor } from './summary';
import { ICell, ILeaveBadge, IScheduleEntry, IWorker } from './types';

const DATE = '2026-11-18';
let nextId = 1;
function entry(category: string, extra: Partial<IScheduleEntry> = {}): IScheduleEntry {
  return { id: nextId++, workerId: 1, title: 'x', entryType: 'single', category, startDate: DATE, endDate: DATE, ...extra };
}
function cell(content: ICell['content'], badges: ILeaveBadge[] = []): ICell {
  return { date: DATE, workerId: 1, isHoliday: false, content, badges };
}

describe('人数のまとめのボタン(その日にその区分の予定がある人)', () => {
  const workers: IWorker[] = [1, 2, 3, 4, 5].map((id) => ({ id, name: 'n' + id, no: '0' + id, department: 'd' }));
  const rows = new Map<number, ICell[]>([
    [1, [cell({ kind: 'period', entry: entry('現場', { entryType: 'period' }), dimmed: false, finished: [] })]],
    [2, [cell({ kind: 'single', entries: [entry('在社')], finishedIds: [] })]],
    [3, [cell({ kind: 'leave', leave: { id: 9, workerId: 3, date: DATE, kind: 'fullDay' } })]],
    [4, [cell({ kind: 'empty' })]],
    // 午前は現場、午後休(総務の午後・作業員の「休暇 PM」)→ 現場にも休暇にも出る
    [
      5,
      [cell({ kind: 'period', entry: entry('現場', { entryType: 'period' }), dimmed: false, finished: [] }, [{ kind: 'afternoon', label: '午後休' }])]
    ]
  ]);

  it('区分の選択肢の順に並べ、休日出勤・予定なしはうしろ。予定がある人がいない区分は出さない', () => {
    expect(summarizeCategories(workers, rows, 0, ['在社', '外出', '現場'])).toEqual([
      { status: '在社', workerIds: [2] },
      { status: '現場', workerIds: [1, 5] },
      { status: '休暇', workerIds: [3, 5] },
      { status: NO_ENTRY_STATUS, workerIds: [4] }
    ]);
  });

  it('「休暇」は区分の選択肢にあればその位置に', () => {
    expect(summarizeCategories(workers, rows, 0, ['在社', '休暇', '現場']).map((s) => s.status)).toEqual(['在社', '休暇', '現場', '予定なし']);
  });

  it('作業員の2現場目(帯の下の箱)の区分も入る', () => {
    const r = new Map<number, ICell[]>([
      [1, [cell({ kind: 'period', entry: entry('現場', { entryType: 'period' }), dimmed: false, finished: [], extras: [entry('出張')] })]]
    ]);
    expect(summarizeCategories([workers[0]], r, 0, []).map((s) => s.status)).toEqual(['現場', '出張']);
  });

  it('早退・遅刻の札だけでは休暇に入らない', () => {
    const r = new Map<number, ICell[]>([
      [1, [cell({ kind: 'period', entry: entry('現場', { entryType: 'period' }), dimmed: false, finished: [] }, [{ kind: 'early', label: '早退' }])]]
    ]);
    expect(summarizeCategories([workers[0]], r, 0, []).map((s) => s.status)).toEqual(['現場']);
  });
});

describe('区分のボタンが対象にする日', () => {
  const today = '2026-11-18'; // 水曜

  it('週間表示:今日がその週にあれば今日、なければ出さない', () => {
    expect(summaryDateFor('week', '2026-11-16', today)).toBe(today);
    expect(summaryDateFor('week', '2026-11-22', today)).toBe(today);
    expect(summaryDateFor('week', '2026-11-23', today)).toBe('');
    expect(summaryDateFor('week', '2026-11-15', today)).toBe('');
  });

  it('日表示:その日', () => {
    expect(summaryDateFor('day', '2026-11-25', today)).toBe('2026-11-25');
    expect(summaryDateFor('day', today, today)).toBe(today);
  });
});
