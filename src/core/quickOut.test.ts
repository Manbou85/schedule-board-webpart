import {
  findActiveOuting,
  isFinishedEntry,
  quickOutEntry,
  quickReturnTime,
  quickStartTime,
  RETURN_OPTIONS,
  returnedEntry
} from './quickOut';
import { IScheduleEntry } from './types';

const at = (h: number, m: number): Date => new Date(2026, 10, 18, h, m);
const opt = (key: string): (typeof RETURN_OPTIONS)[number] => RETURN_OPTIONS.filter((o) => o.key === key)[0];

describe('ちょっと外出', () => {
  it('開始は5分単位に切り下げ、戻りは5分単位に切り上げる', () => {
    expect(quickStartTime(at(10, 7))).toBe('10:05');
    expect(quickStartTime(at(9, 0))).toBe('09:00');
    expect(quickReturnTime(at(10, 7), 30)).toBe('10:40');
    expect(quickReturnTime(at(10, 0), 60)).toBe('11:00');
    // 日をまたぐときは 23:59 で止める
    expect(quickReturnTime(at(23, 10), 120)).toBe('23:59');
  });

  it('行き先・戻りを選んで、1日だけの外出の予定を作る', () => {
    expect(quickOutEntry(3, '2026-11-18', at(10, 7), ' 銀行 ', opt('1h'))).toEqual({
      workerId: 3,
      entryType: 'single',
      category: '外出',
      title: '銀行',
      startDate: '2026-11-18',
      endDate: '2026-11-18',
      startTime: '10:05',
      endTime: '11:10'
    });
  });

  it('行き先が空欄なら「外出」。直帰なら「(直帰)」を付け、戻りの時刻は空', () => {
    const direct = quickOutEntry(3, '2026-11-18', at(16, 0), '', opt('direct'));
    expect(direct.title).toBe('外出(直帰)');
    expect(direct.endTime).toBeUndefined();
    const undecided = quickOutEntry(3, '2026-11-18', at(16, 0), '資材メーカー', opt('undecided'));
    expect(undecided.title).toBe('資材メーカー');
    expect(undecided.endTime).toBeUndefined();
  });
});

describe('帰社しました', () => {
  const base: IScheduleEntry = {
    id: 1,
    workerId: 3,
    entryType: 'single',
    category: '外出',
    title: '銀行',
    startDate: '2026-11-18',
    endDate: '2026-11-18',
    startTime: '10:00',
    endTime: '11:00'
  };
  const now = { date: '2026-11-18', time: '10:30' };

  it('外出中の予定を見つける(始まっていて、戻りの時刻が来ていない今日の外出)', () => {
    expect(findActiveOuting([base], 3, now)).toBe(base);
    expect(findActiveOuting([base], 4, now)).toBeUndefined(); // ほかの人
    expect(findActiveOuting([base], 3, { date: '2026-11-18', time: '09:55' })).toBeUndefined(); // まだ始まっていない
    expect(findActiveOuting([base], 3, { date: '2026-11-18', time: '11:00' })).toBeUndefined(); // 戻りの時刻
    expect(findActiveOuting([{ ...base, category: '出張' }], 3, now)).toBeUndefined(); // 外出以外
    expect(findActiveOuting([{ ...base, entryType: 'period' }], 3, now)).toBeUndefined(); // 期間の予定
    const noEnd = { ...base, id: 2, startTime: '10:20', endTime: undefined };
    expect(findActiveOuting([base, noEnd], 3, now)).toBe(noEnd); // あとに出かけたほう
    // 開始時刻のない外出(前の日に入れておいた予定など)は、外出中にしない(朝から「帰社しました」が出ないように)
    expect(findActiveOuting([{ ...base, startTime: undefined, endTime: undefined }], 3, now)).toBeUndefined();
  });

  it('戻りの時刻を今に直す。直帰の印は外す', () => {
    expect(returnedEntry(base, at(10, 42))).toEqual({ ...base, endTime: '10:42' });
    expect(returnedEntry({ ...base, title: '銀行(直帰)', endTime: undefined }, at(15, 3))).toEqual({
      ...base,
      endTime: '15:03'
    });
    // 開始時刻より前にはしない
    expect(returnedEntry({ ...base, startTime: '10:45' }, at(10, 42)).endTime).toBe('10:45');
  });

  it('戻った予定は、終わった予定になる', () => {
    const returned = returnedEntry(base, at(10, 42));
    expect(isFinishedEntry(returned, { date: '2026-11-18', time: '10:42' })).toBe(true);
    expect(isFinishedEntry(base, now)).toBe(false);
    expect(isFinishedEntry(base, undefined)).toBe(false);
  });
});
