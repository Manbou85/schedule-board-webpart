import { resolveRow, groupByWorker, EMPTY_WORKER_DATA } from './cellRule';
import { weekDates } from './dateUtils';
import { createHolidayCalendar } from './holiday';
import { filterWorkers, isEmptyCriteria, matchesText, normalizeForSearch, suggestPlaces } from './search';
import { ICell, IScheduleEntry, IWorker } from './types';

describe('検索用の文字のそろえ方', () => {
  it('空白・全角英数・大文字小文字の違いをなくす', () => {
    expect(normalizeForSearch(' 山田 太郎 ')).toBe('山田太郎');
    expect(normalizeForSearch('ABC棟')).toBe('abc棟');
    expect(normalizeForSearch(undefined)).toBe('');
  });

  it('名字だけ・名前だけ・空白ありなしでもヒットする', () => {
    expect(matchesText('山田 太郎', '山田')).toBe(true);
    expect(matchesText('山田 太郎', '太郎')).toBe(true);
    expect(matchesText('山田 太郎', '山田太郎')).toBe(true);
    expect(matchesText('山田太郎', '山田 太郎')).toBe(true);
    expect(matchesText('山田 太郎', '佐藤')).toBe(false);
    expect(matchesText('山田 太郎', '')).toBe(true);
  });
});

describe('絞り込み', () => {
  const calendar = createHolidayCalendar([]);
  const days = weekDates('2026-11-17').map(calendar);
  const workers: IWorker[] = [
    { id: 1, name: '山田 太郎', no: '0201', department: '総務部' },
    { id: 2, name: '佐藤 花子', no: '0301', department: '建築部' },
    { id: 3, name: '山本 一郎', no: '0302', department: '建築部' }
  ];
  const entries: IScheduleEntry[] = [
    { id: 10, workerId: 2, title: '〇〇ビル新築工事', entryType: 'period', category: '現場', startDate: '2026-11-01', endDate: '2026-12-31' },
    { id: 11, workerId: 3, title: '〇〇ビル新築工事', entryType: 'period', category: '現場', startDate: '2026-11-01', endDate: '2026-11-30' },
    // 山本さんは水曜だけ本社(単発)
    { id: 12, workerId: 3, title: '本社', entryType: 'single', category: '在社', startDate: '2026-11-18', endDate: '2026-11-18' },
    // 来週の予定(この週には出ない)
    { id: 13, workerId: 1, title: '△△橋梁工事', entryType: 'single', category: '外出', startDate: '2026-11-25', endDate: '2026-11-25' }
  ];
  const byWorker = groupByWorker({ entries, leaves: [{ id: 20, workerId: 1, date: '2026-11-19', kind: 'fullDay' }], holidayWorks: [] });
  const rows = new Map<number, ICell[]>();
  workers.forEach((w) => rows.set(w.id, resolveRow(days, w.id, byWorker.get(w.id) || EMPTY_WORKER_DATA)));
  const ids = (list: IWorker[]): number[] => list.map((w) => w.id);

  it('条件がなければ全員(並び順そのまま)', () => {
    expect(isEmptyCriteria({ name: ' ', departments: [] })).toBe(true);
    expect(filterWorkers(workers, rows, {})).toBe(workers);
  });

  it('名前で絞り込む', () => {
    expect(ids(filterWorkers(workers, rows, { name: '山' }))).toEqual([1, 3]);
    expect(ids(filterWorkers(workers, rows, { name: '花子' }))).toEqual([2]);
  });

  it('現場名で「この現場に誰がいる?」を探す(表示中の週に出ているものだけ)', () => {
    expect(ids(filterWorkers(workers, rows, { place: '〇〇ビル' }))).toEqual([2, 3]);
    expect(ids(filterWorkers(workers, rows, { place: '橋梁' }))).toEqual([]);
  });

  it('部署で絞り込む', () => {
    expect(ids(filterWorkers(workers, rows, { departments: ['建築部'] }))).toEqual([2, 3]);
    expect(ids(filterWorkers(workers, rows, { departments: ['総務部', '役員'] }))).toEqual([1]);
  });

  it('区分で絞り込む(休暇も選べる)', () => {
    expect(ids(filterWorkers(workers, rows, { categories: ['在社'] }))).toEqual([3]);
    expect(ids(filterWorkers(workers, rows, { categories: ['休暇'] }))).toEqual([1]);
  });

  it('日表示(1日分のマス)なら、その日の区分だけで判定する', () => {
    const thursday = [calendar('2026-11-19')];
    const dayRows = new Map<number, ICell[]>();
    workers.forEach((w) => dayRows.set(w.id, resolveRow(thursday, w.id, byWorker.get(w.id) || EMPTY_WORKER_DATA)));
    expect(ids(filterWorkers(workers, dayRows, { categories: ['在社'] }))).toEqual([]);
    expect(ids(filterWorkers(workers, dayRows, { categories: ['現場'] }))).toEqual([2, 3]);
  });

  it('条件を組み合わせると「かつ」になる', () => {
    expect(ids(filterWorkers(workers, rows, { name: '山', departments: ['建築部'], place: 'ビル' }))).toEqual([3]);
  });
});

describe('行き先・現場名の候補', () => {
  const entries = [
    { workerId: 1, title: 'A現場', startDate: '2026-10-01' },
    { workerId: 1, title: '本社', startDate: '2026-11-10' },
    { workerId: 1, title: 'A現場 ', startDate: '2026-11-12' },
    { workerId: 2, title: '他人の現場', startDate: '2026-11-15' },
    { workerId: 1, title: 'B現場', startDate: '2026-09-01' }
  ];

  it('自分の入力した名前を、新しい順に重複なしで出す', () => {
    expect(suggestPlaces(entries, 1)).toEqual(['A現場', '本社', 'B現場']);
  });

  it('入力中の文字で絞り込み、件数も制限できる', () => {
    expect(suggestPlaces(entries, 1, '現場')).toEqual(['A現場', 'B現場']);
    expect(suggestPlaces(entries, 1, undefined, 1)).toEqual(['A現場']);
  });
});
