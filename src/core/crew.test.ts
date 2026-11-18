import { crewToEntries, nameKey } from './crew';
import { ICrewAssignment, IWorker } from './types';

const workers: IWorker[] = [
  { id: 1, name: '山田 太郎', no: '0901', department: '作業員' },
  { id: 2, name: '佐藤 次郎', no: '0902', department: '作業員' }
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
});
