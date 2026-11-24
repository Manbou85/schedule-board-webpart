import { classifyCrewTitle, crewToEntries, nameKey } from './crew';
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

describe('作業員の行き先に「休暇」と書かれたとき(総務に申請する前)', () => {
  it('予定にするときも、行き先の文字はそのまま・区分だけ休暇にする', () => {
    const { entries } = crewToEntries([crew(8, '山田 太郎', { title: '休暇 0.5日' })], workers);
    expect(entries[0].category).toBe('休暇');
    expect(entries[0].title).toBe('休暇 0.5日');
    expect(entries[0].readOnly).toBe(true);
  });
});

describe('作業員の行き先の文字の読み分け(ver 0.9.0)', () => {
  const kind = (t: string): string => {
    const k = classifyCrewTitle(t);
    return k.type === 'badge' ? k.kind : k.type;
  };

  it('早退・遅刻は札', () => {
    expect(kind('早退 15時')).toBe('early');
    expect(kind('遅刻 10時')).toBe('late');
  });

  it('午前休・午後休、「休暇」+午前/午後/AM/PM は半日の札(大文字・小文字、全角も気にしない)', () => {
    expect(kind('午前休')).toBe('morning');
    expect(kind('午後休 通院')).toBe('afternoon');
    expect(kind('休暇 PM')).toBe('afternoon');
    expect(kind('休暇 am')).toBe('morning');
    expect(kind('休暇 ＰＭ')).toBe('afternoon');
    expect(kind('午後 休暇')).toBe('afternoon');
  });

  it('午前・午後がわからない休暇は1日の休暇。両方書いてあっても1日', () => {
    expect(kind('休暇')).toBe('leave');
    expect(kind('休暇 0.5日')).toBe('leave');
    expect(kind('休暇 AM〜PM')).toBe('leave');
  });

  it('「休暇」+午前・午後のあとに仕事の言葉 → 仕事をしない残りの半日が休暇(ver 0.9.3)', () => {
    expect(kind('休暇(午後から現場)')).toBe('morning');
    expect(kind('休暇(午後から出勤)')).toBe('morning');
    expect(kind('休暇 PM現場')).toBe('morning');
    expect(kind('休暇(午前は現場)')).toBe('afternoon');
    expect(kind('AM 〇〇現場、PM 休暇')).toBe('afternoon');
    expect(kind('午前休暇、午後から現場')).toBe('morning');
  });

  it('仕事の言葉がない・区切りや「休」をはさむときは、今までどおりの読み分け', () => {
    expect(kind('午後から休暇')).toBe('afternoon');
    expect(kind('休暇 午後 通院')).toBe('afternoon');
    expect(kind('午後休暇、現場')).toBe('afternoon');
    expect(kind('休暇(AM現場、PM出勤)')).toBe('leave');
  });

  it('それ以外は現場(午前・午後だけでは札にしない)', () => {
    expect(kind('〇〇新築工事')).toBe('site');
    expect(kind('午後 〇〇現場')).toBe('site');
    expect(kind('PMビル改修')).toBe('site');
  });

  it('札の行は予定にせず、期間の毎日に札を作る(書いた文字は補足)', () => {
    const { entries, leaves } = crewToEntries(
      [crew(30, '山田 太郎', { title: '早退 15時', startDate: '2026-11-17', endDate: '2026-11-18' })],
      workers
    );
    expect(entries).toEqual([]);
    expect(leaves.map((l) => [l.date, l.kind, l.remarks, l.fromCrew])).toEqual([
      ['2026-11-17', 'early', '早退 15時', true],
      ['2026-11-18', 'early', '早退 15時', true]
    ]);
  });

  it('長い期間の札の行でも、表示中の週の日には札を作る(始まりから62日で切れない)', () => {
    const { leaves } = crewToEntries(
      [crew(31, '山田 太郎', { title: '遅刻(通院)', startDate: '2026-08-01', endDate: '2026-12-31' })],
      workers,
      [],
      { start: '2026-11-16', end: '2026-11-22' }
    );
    expect(leaves.map((l) => l.date)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
      '2026-11-22'
    ]);
  });
});
