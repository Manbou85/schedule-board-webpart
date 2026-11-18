import { crewToEntries, nameKey } from './crew';
import { ICrewAssignment, IWorker } from './types';

const workers: IWorker[] = [
  { id: 1, name: '山田 太郎', no: '0901', department: '作業員' },
  { id: 2, name: '佐藤 次郎', no: '0902', department: '作業員' },
  { id: 3, name: '高橋 花子', no: '0401', department: '建築部' }
];

function crew(id: number, workerName: string, extra: Partial<ICrewAssignment> = {}): ICrewAssignment {
  return { id, workerName, title: ' 〇〇新築工事 ', startDate: '2026-11-16', endDate: '2026-11-20', ...extra };
}

describe('作業員の行き先リスト', () => {
  it('名前の突き合わせは、全角・半角と空白のちがいを気にしない', () => {
    expect(nameKey('山田 太郎')).toBe('山田太郎');
    expect(nameKey('山田\u3000太郎')).toBe('山田太郎');
    expect(nameKey(' 山田太郎 ')).toBe('山田太郎');
  });

  it('WorkerNameList の人に結びつけて、読み取り専用の長期の予定にする', () => {
    const { entries, unmatched } = crewToEntries([crew(7, '佐藤\u3000次郎')], workers);
    expect(entries).toEqual([
      {
        id: -7,
        workerId: 2,
        title: '〇〇新築工事',
        entryType: 'period',
        category: '現場',
        startDate: '2026-11-16',
        endDate: '2026-11-20',
        readOnly: true
      }
    ]);
    expect(unmatched).toEqual([]);
  });

  it('名前が見つからない行は使わず、名前を知らせる。終了日がなければ開始日と同じ', () => {
    const { entries, unmatched } = crewToEntries(
      [crew(1, '鈴木 三郎'), crew(2, '鈴木 三郎'), crew(3, '山田太郎', { endDate: '' })],
      workers
    );
    expect(unmatched).toEqual(['鈴木 三郎']);
    expect(entries.map((e) => [e.workerId, e.endDate])).toEqual([[1, '2026-11-16']]);
  });

  it('指定した部署(初期値は作業員)の人の行だけを使う。ほかの部署の人は知らせずに使わない', () => {
    const list = [crew(1, '山田 太郎'), crew(2, '高橋 花子')];
    const onlyCrew = crewToEntries(list, workers, ['作業員']);
    expect(onlyCrew.entries.map((e) => e.workerId)).toEqual([1]);
    expect(onlyCrew.unmatched).toEqual([]);
    // 部署の指定が空なら全員
    expect(crewToEntries(list, workers, []).entries.map((e) => e.workerId)).toEqual([1, 3]);
    expect(crewToEntries(list, workers).entries.map((e) => e.workerId)).toEqual([1, 3]);
  });
});
