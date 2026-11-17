import { SP_FIELDS } from './spConfig';
import {
  dateKeyToSp,
  entryToSpBody,
  escapeOData,
  listApiUrl,
  mapEntry,
  mapHoliday,
  mapHolidayWork,
  mapLeave,
  mapRows,
  mapWorker,
  rangeBounds,
  spDateToKey
} from './spMapping';

describe('「日付のみ」の列の読み書き', () => {
  it('日本のサイト(前の日の 15:00Z で返る)でも正しい日付になる', () => {
    expect(spDateToKey('2026-11-16T15:00:00Z')).toBe('2026-11-17');
    expect(spDateToKey('2026-12-31T15:00:00Z')).toBe('2027-01-01');
  });

  it('UTC のサイトや、アメリカのサイトでも正しい日付になる', () => {
    expect(spDateToKey('2026-11-17T00:00:00Z')).toBe('2026-11-17');
    expect(spDateToKey('2026-11-17T05:00:00Z')).toBe('2026-11-17');
  });

  it('値がないときは undefined', () => {
    expect(spDateToKey(undefined)).toBeUndefined();
    expect(spDateToKey('')).toBeUndefined();
    expect(spDateToKey('abc')).toBeUndefined();
  });

  it('書き込むときは UTC の0時にする(そのまま読んでも、日本時間の0時にそろえて読んでも同じ日付)', () => {
    expect(dateKeyToSp('2026-11-17')).toBe('2026-11-17T00:00:00Z');
    expect(spDateToKey(dateKeyToSp('2026-11-17'))).toBe('2026-11-17');
    expect(spDateToKey('2026-11-16T15:00:00Z')).toBe('2026-11-17');
  });

  it('取り出す範囲は前後に1日広く取る', () => {
    expect(rangeBounds('2026-11-16', '2026-11-22')).toEqual({
      from: '2026-11-15T12:00:00Z',
      to: '2026-11-23T12:00:00Z'
    });
  });
});

describe('リストの URL', () => {
  it('名前で指定したときはタイトルで探す(\' は \'\' にする)', () => {
    expect(listApiUrl('https://contoso.sharepoint.com/sites/portal/', 'WorkerNameList')).toBe(
      "https://contoso.sharepoint.com/sites/portal/_api/web/lists/getbytitle('WorkerNameList')"
    );
    expect(escapeOData("O'Neil")).toBe("O''Neil");
  });

  it('Lists/〜 で指定したときは URL で探す(表示名を変えても動く)', () => {
    expect(listApiUrl('https://contoso.sharepoint.com/sites/portal', 'Lists/ScheduleEntries')).toBe(
      "https://contoso.sharepoint.com/sites/portal/_api/web/GetList('" +
        encodeURIComponent('/sites/portal/Lists/ScheduleEntries') +
        "')"
    );
  });
});

describe('リストの行 → 予定表のデータ', () => {
  it('対象者:表示名が空ならタイトル。M365User が空ならアカウントなし', () => {
    const f = SP_FIELDS.workers;
    expect(
      mapWorker({ Id: 1, Title: '山田 太郎', WorkerName: '', No_x002e_: '0201', Department: '総務部', M365User: { EMail: 'yamada@example.com ' } }, f)
    ).toEqual({ id: 1, name: '山田 太郎', no: '0201', department: '総務部', account: 'yamada@example.com' });
    expect(mapWorker({ Id: 2, Title: 'x', WorkerName: '鈴木', Department: '建築部' }, f)).toEqual({
      id: 2,
      name: '鈴木',
      no: '',
      department: '建築部'
    });
    expect(mapWorker({ Title: 'IDなし' }, f)).toBeUndefined();
  });

  it('行動予定:期間・単発、時刻・メモ。終了日がなければ開始日', () => {
    const f = SP_FIELDS.entries;
    expect(
      mapEntry(
        {
          Id: 10,
          WorkerId: 1,
          Title: ' A現場 ',
          EntryType: '期間',
          Category: '現場',
          StartDate: '2026-10-31T15:00:00Z',
          EndDate: '2026-11-29T15:00:00Z',
          StartTime: '08:00',
          EndTime: '',
          Note: '朝礼あり'
        },
        f
      )
    ).toEqual({
      id: 10,
      workerId: 1,
      title: 'A現場',
      entryType: 'period',
      category: '現場',
      startDate: '2026-11-01',
      endDate: '2026-11-30',
      startTime: '08:00',
      note: '朝礼あり'
    });
    expect(mapEntry({ Id: 11, WorkerId: 1, Title: '本社', EntryType: '単発', Category: '在社', StartDate: '2026-11-16T15:00:00Z' }, f)).toEqual({
      id: 11,
      workerId: 1,
      title: '本社',
      entryType: 'single',
      category: '在社',
      startDate: '2026-11-17',
      endDate: '2026-11-17'
    });
  });

  it('行動予定:担当者・種別・開始日が読めない行は出さない', () => {
    const f = SP_FIELDS.entries;
    const rows = [
      { Id: 1, WorkerId: 1, EntryType: '単発', StartDate: '2026-11-16T15:00:00Z' },
      { Id: 2, EntryType: '単発', StartDate: '2026-11-16T15:00:00Z' },
      { Id: 3, WorkerId: 1, EntryType: '???', StartDate: '2026-11-16T15:00:00Z' },
      { Id: 4, WorkerId: 1, EntryType: '単発' }
    ];
    expect(mapRows(rows, (r) => mapEntry(r, f)).map((e) => e.id)).toEqual([1]);
  });

  it('会社休日・休暇・休日出勤', () => {
    expect(mapHoliday({ Title: '元日', HolidayDate: '2026-12-31T15:00:00Z', DayType: '休日' }, SP_FIELDS.holidays)).toEqual({
      date: '2027-01-01',
      name: '元日',
      dayType: 'holiday'
    });
    expect(mapHoliday({ Title: 'x', HolidayDate: '2026-12-31T15:00:00Z', DayType: '?' }, SP_FIELDS.holidays)).toBeUndefined();

    expect(
      mapLeave({ Id: 5, NameId: 3, Date: '2026-11-16T15:00:00Z', AcquisitionTime: '午後', Remarks: '13:00から' }, SP_FIELDS.leaves)
    ).toEqual({ id: 5, workerId: 3, date: '2026-11-17', kind: 'afternoon', remarks: '13:00から' });
    expect(mapLeave({ Id: 6, NameId: 3, Date: '2026-11-16T15:00:00Z', AcquisitionTime: '' }, SP_FIELDS.leaves)).toBeUndefined();

    expect(
      mapHolidayWork(
        { Id: 7, NameId: 3, Date: '2026-11-20T15:00:00Z', StartTime: '08:00', EndTime: '17:30', WorkPlace: '本社' },
        SP_FIELDS.holidayWorks
      )
    ).toEqual({ id: 7, workerId: 3, date: '2026-11-21', workPlace: '本社', startTime: '08:00', endTime: '17:30' });
  });
});

describe('予定 → リストに書き込む値', () => {
  it('種別は日本語の選択肢、日付は正午、空の任意項目は空文字(消す)', () => {
    expect(
      entryToSpBody(
        { workerId: 3, title: '本社', entryType: 'single', category: '在社', startDate: '2026-11-17', endDate: '2026-11-30' },
        SP_FIELDS.entries
      )
    ).toEqual({
      Title: '本社',
      WorkerId: 3,
      EntryType: '単発',
      Category: '在社',
      StartDate: '2026-11-17T00:00:00Z',
      EndDate: '2026-11-17T00:00:00Z',
      StartTime: '',
      EndTime: '',
      Note: ''
    });
  });
});
