import {
  canEditWorker,
  draftFromEntry,
  draftToEntry,
  hasErrors,
  newDraft,
  quickDraft,
  validateDraft,
  IEntryDraft
} from './entryForm';

function draft(patch: Partial<IEntryDraft>): IEntryDraft {
  return { ...newDraft(1, '2026-11-17'), category: '外出', title: '協力会社訪問', ...patch };
}

describe('登録フォームの入力チェック', () => {
  it('必要な項目がそろっていれば誤りなし', () => {
    expect(validateDraft(draft({}))).toEqual({});
    expect(hasErrors(validateDraft(draft({})))).toBe(false);
  });

  it('担当者・区分・行き先が空なら知らせる(空白だけも空とみなす)', () => {
    const errors = validateDraft(draft({ workerId: undefined, category: '', title: '  ' }));
    expect(errors.workerId).toBe('担当者を選んでください。');
    expect(errors.category).toBe('区分を選んでください。');
    expect(errors.title).toBe('行き先・現場名を入力してください。');
  });

  it('行き先が長すぎるときは知らせる', () => {
    let long = '';
    for (let i = 0; i < 256; i++) {
      long += 'あ';
    }
    expect(validateDraft(draft({ title: long })).title).toBe('行き先・現場名は255文字以内で入力してください。');
  });

  it('日付がないときは知らせる(単発は「日付」、期間は「開始日」)', () => {
    expect(validateDraft(draft({ startDate: '' })).startDate).toBe('日付を選んでください。');
    expect(validateDraft(draft({ entryType: 'period', startDate: '' })).startDate).toBe('開始日を選んでください。');
  });

  it('期間は終了日が必要で、開始日より前は不可(同じ日はよい)', () => {
    expect(validateDraft(draft({ entryType: 'period', endDate: '' })).endDate).toBe('終了日を選んでください。');
    expect(validateDraft(draft({ entryType: 'period', endDate: '2026-11-16' })).endDate).toBe(
      '終了日は、開始日と同じ日か、それより後にしてください。'
    );
    expect(validateDraft(draft({ entryType: 'period', endDate: '2026-11-17' }))).toEqual({});
  });

  it('単発のときは終了日を見ない', () => {
    expect(validateDraft(draft({ entryType: 'single', endDate: '2026-11-01' }))).toEqual({});
  });

  it('時刻の形と前後をチェックする(どちらか片方だけでもよい)', () => {
    expect(validateDraft(draft({ startTime: '09:00', endTime: '' }))).toEqual({});
    expect(validateDraft(draft({ startTime: '', endTime: '15:00' }))).toEqual({});
    expect(validateDraft(draft({ startTime: '9時' })).time).toBe('時刻は「09:00」のような形で入力してください。');
    expect(validateDraft(draft({ startTime: '24:00' })).time).toBe('時刻は「09:00」のような形で入力してください。');
    expect(validateDraft(draft({ startTime: '15:00', endTime: '09:00' })).time).toBe(
      '終了・戻り時刻は、開始時刻より後にしてください。'
    );
  });
});

describe('保存する形に整える', () => {
  it('単発は終了日を開始日にそろえ、空白を取り、空の任意項目は入れない', () => {
    expect(draftToEntry(draft({ title: ' 協力会社訪問 ', endDate: '2026-11-30', note: '  ' }))).toEqual({
      workerId: 1,
      entryType: 'single',
      category: '外出',
      title: '協力会社訪問',
      startDate: '2026-11-17',
      endDate: '2026-11-17'
    });
  });

  it('期間・時刻・メモ・ID(編集のとき)を入れる', () => {
    expect(
      draftToEntry(
        draft({ id: 5, entryType: 'period', endDate: '2026-12-25', startTime: '08:00', endTime: '17:00', note: '朝礼あり' })
      )
    ).toEqual({
      id: 5,
      workerId: 1,
      entryType: 'period',
      category: '外出',
      title: '協力会社訪問',
      startDate: '2026-11-17',
      endDate: '2026-12-25',
      startTime: '08:00',
      endTime: '17:00',
      note: '朝礼あり'
    });
  });

  it('保存済みの予定をフォームに戻せる', () => {
    const d = draftFromEntry({
      id: 9,
      workerId: 2,
      title: 'A現場',
      entryType: 'period',
      category: '現場',
      startDate: '2026-11-01',
      endDate: '2026-11-30'
    });
    expect(d).toEqual({
      id: 9,
      workerId: 2,
      entryType: 'period',
      category: '現場',
      title: 'A現場',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      startTime: '',
      endTime: '',
      note: ''
    });
  });
});

describe('編集できる人とワンタップ登録', () => {
  it('自分の予定、または管理者なら編集できる', () => {
    expect(canEditWorker(1, 1, false)).toBe(true);
    expect(canEditWorker(2, 1, false)).toBe(false);
    expect(canEditWorker(2, 1, true)).toBe(true);
    // 自分が WorkerNameList にいない人は、管理者でなければ誰の予定も編集できない
    expect(canEditWorker(2, undefined, false)).toBe(false);
  });

  it('ワンタップ登録は、その日の単発予定になる', () => {
    const d = quickDraft(3, '2026-11-18', { category: '在社', title: '本社' });
    expect(validateDraft(d)).toEqual({});
    expect(draftToEntry(d)).toEqual({
      workerId: 3,
      entryType: 'single',
      category: '在社',
      title: '本社',
      startDate: '2026-11-18',
      endDate: '2026-11-18'
    });
  });
});
