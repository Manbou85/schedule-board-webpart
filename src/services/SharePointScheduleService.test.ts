// SharePoint の読み書きの部品のチェック(本物の SharePoint の代わりに、偽物の通信相手を使う)

// 本物の SPFx 部品はテスト環境では読み込めないので、使う部分だけ偽物にする
jest.mock('@microsoft/sp-http', () => ({ SPHttpClient: { configurations: { v1: {} } } }));
// jest.mock のあとで読み込む必要があるため、ここだけ require を使う
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { SharePointScheduleService, SpRequestError } = require('./SharePointScheduleService') as typeof import('./SharePointScheduleService');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DEFAULT_LIST_SETTINGS } = require('./spConfig') as typeof import('./spConfig');

interface ICall {
  method: string;
  url: string;
  options: { headers?: { [k: string]: string }; body?: string };
}

/** URL の一部 → 返す中身(status が 200 以外なら失敗として返す) */
type Routes = { match: string; status?: number; json: unknown }[];

function fakeClient(routes: Routes): { client: unknown; calls: ICall[] } {
  const calls: ICall[] = [];
  type Send = (url: string, config: unknown, options: ICall['options']) => Promise<unknown>;
  const respond = (method: string): Send => (url, _config, options) => {
    calls.push({ method, url: decodeURIComponent(url), options });
    const route = routes.filter((r) => decodeURIComponent(url).indexOf(r.match) >= 0)[0];
    const status = route ? route.status || 200 : 404;
    return Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      statusText: 'status ' + status,
      json: () => Promise.resolve(route ? route.json : {})
    });
  };
  return { client: { get: respond('GET'), post: respond('POST') }, calls };
}

const WEB = 'https://contoso.sharepoint.com/sites/portal';

function makeService(routes: Routes): { service: InstanceType<typeof SharePointScheduleService>; calls: ICall[] } {
  const { client, calls } = fakeClient(routes);
  const service = new SharePointScheduleService({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    spHttpClient: client as any,
    webUrl: WEB + '/',
    userEmail: 'me@example.com',
    lists: { ...DEFAULT_LIST_SETTINGS, entriesList: 'Lists/ScheduleEntries' }
  });
  return { service, calls };
}

describe('SharePoint から読む', () => {
  it('対象者:続きのページ(nextLink)も読む', async () => {
    const { service, calls } = makeService([
      { match: 'page2', json: { value: [{ Id: 2, Title: 'B', WorkerName: 'B', Department: '総務部' }] } },
      {
        match: "getbytitle('WorkerNameList')/items",
        json: { value: [{ Id: 1, Title: 'A', WorkerName: 'A', Department: '総務部' }], 'odata.nextLink': WEB + '/page2' }
      }
    ]);
    const workers = await service.getWorkers();
    expect(workers.map((w) => w.id)).toEqual([1, 2]);
    expect(calls[0].url).toContain('$expand=M365User');
    expect(calls[0].url).toContain('M365User/EMail');
  });

  it('区分の選択肢をリストの列設定から読む', async () => {
    const { service, calls } = makeService([{ match: "getbyinternalnameortitle('Category')", json: { Choices: ['現場', '在社'] } }]);
    expect(await service.getCategories()).toEqual(['現場', '在社']);
    expect(calls[0].url).toContain("GetList('/sites/portal/Lists/ScheduleEntries')");
  });

  it('管理者グループに入っていれば管理者。グループが読めなくても一般ユーザーとして続ける', async () => {
    const a = makeService([{ match: 'currentuser/groups', json: { value: [{ Title: 'メンバー' }, { Title: '行動予定表管理者' }] } }]);
    expect(await a.service.getCurrentUser()).toEqual({ account: 'me@example.com', isAdmin: true });
    const b = makeService([{ match: 'currentuser/groups', status: 500, json: {} }]);
    expect(await b.service.getCurrentUser()).toEqual({ account: 'me@example.com', isAdmin: false });
  });

  it('期間のデータ:広めに取り出して、表示範囲ぴったりに絞る', async () => {
    const { service, calls } = makeService([
      {
        match: "ScheduleEntries')/items",
        json: {
          value: [
            // 11/16〜11/22 にかかる(日本時間の0時=前の日の15:00Z で返ってくる)
            { Id: 1, WorkerId: 1, Title: 'A', EntryType: '期間', Category: '現場', StartDate: '2026-10-31T15:00:00Z', EndDate: '2026-11-15T15:00:00Z' },
            // 11/15 で終わる(範囲外)
            { Id: 2, WorkerId: 1, Title: 'B', EntryType: '期間', Category: '現場', StartDate: '2026-10-31T15:00:00Z', EndDate: '2026-11-14T15:00:00Z' }
          ]
        }
      },
      { match: "Lists/CompanyHolidays')", json: { value: [{ Title: '勤労感謝の日', HolidayDate: '2026-11-22T15:00:00Z', DayType: '休日' }] } },
      { match: "getbytitle('休暇情報共有リスト')", json: { value: [{ Id: 5, NameId: 1, Date: '2026-11-16T15:00:00Z', AcquisitionTime: '1日' }] } },
      { match: "getbytitle('休日出勤情報共有リスト')", json: { value: [] } }
    ]);
    const r = await service.getRange('2026-11-16', '2026-11-22');
    expect(r.entries.map((e) => e.id)).toEqual([1]);
    expect(r.leaves).toEqual([{ id: 5, workerId: 1, date: '2026-11-17', kind: 'fullDay' }]);
    // 11/23 の祝日は範囲外なので出さない
    expect(r.holidays).toEqual([]);
    expect(r.warnings).toEqual([]);
    const entryCall = calls.filter((c) => c.url.indexOf("ScheduleEntries')/items") >= 0)[0];
    expect(entryCall.url).toContain("StartDate le datetime'2026-11-23T12:00:00Z' and EndDate ge datetime'2026-11-15T12:00:00Z'");
  });

  it('総務のリストが読めなくても、予定は表示してお知らせを出す', async () => {
    const { service } = makeService([
      { match: "ScheduleEntries')/items", json: { value: [] } },
      { match: "Lists/CompanyHolidays')", json: { value: [] } },
      { match: "getbytitle('休暇情報共有リスト')", status: 404, json: {} },
      { match: "getbytitle('休日出勤情報共有リスト')", json: { value: [] } }
    ]);
    const r = await service.getRange('2026-11-16', '2026-11-22');
    expect(r.warnings).toEqual(['休暇の情報を読み込めなかったため、表示していません。']);
  });

  it('行動予定リストが読めないときはエラー(状態コードと理由つき)', async () => {
    const { service } = makeService([
      { match: "ScheduleEntries')/items", status: 400, json: { 'odata.error': { message: { value: '列が見つかりません' } } } }
    ]);
    await expect(service.getRange('2026-11-16', '2026-11-22')).rejects.toMatchObject({ status: 400, detail: '列が見つかりません' });
  });
});

describe('SharePoint に書き込む', () => {
  const entry = { workerId: 3, title: '本社', entryType: 'single' as const, category: '在社', startDate: '2026-11-17', endDate: '2026-11-17' };

  it('登録:items に POST し、返ってきた ID を付ける', async () => {
    const { service, calls } = makeService([{ match: "ScheduleEntries')/items", json: { Id: 99 } }]);
    expect(await service.createEntry(entry)).toEqual({ ...entry, id: 99 });
    expect(calls[0].method).toBe('POST');
    expect(JSON.parse(calls[0].options.body || '{}')).toMatchObject({ WorkerId: 3, EntryType: '単発', StartDate: '2026-11-17T00:00:00Z' });
  });

  it('区分「休暇」:リストの選択肢がまだ「休み」なら「休み」で書き、「休暇」に変えたあとは「休暇」で書く', async () => {
    const leave = { ...entry, category: '休暇', title: '休暇' };
    const old = makeService([
      { match: "getbyinternalnameortitle('Category')", json: { Choices: ['在社', '休み'] } },
      { match: "ScheduleEntries')/items", json: { Id: 5 } }
    ]);
    // 画面には「休暇」として出す
    expect(await old.service.getCategories()).toEqual(['在社', '休暇']);
    await old.service.createEntry(leave);
    expect(JSON.parse(old.calls[1].options.body || '{}')).toMatchObject({ Category: '休み' });

    const renamed = makeService([
      { match: "getbyinternalnameortitle('Category')", json: { Choices: ['在社', '休暇'] } },
      { match: "ScheduleEntries')/items", json: { Id: 6 } }
    ]);
    await renamed.service.getCategories();
    await renamed.service.createEntry(leave);
    expect(JSON.parse(renamed.calls[1].options.body || '{}')).toMatchObject({ Category: '休暇' });
  });

  it('変更は MERGE、削除は DELETE(どちらも IF-MATCH: *)', async () => {
    const { service, calls } = makeService([{ match: 'items(7)', json: {} }]);
    await service.updateEntry({ ...entry, id: 7 });
    await service.deleteEntry(7);
    expect(calls[0].options.headers).toMatchObject({ 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' });
    expect(calls[1].options.headers).toMatchObject({ 'X-HTTP-Method': 'DELETE', 'IF-MATCH': '*' });
  });

  it('権限がないときは 403 のエラーになる(画面で「権限がありません」と出す)', async () => {
    const { service } = makeService([{ match: 'items(7)', status: 403, json: {} }]);
    const error = await service.deleteEntry(7).catch((e: unknown) => e);
    expect(error instanceof SpRequestError).toBe(true);
    expect((error as InstanceType<typeof SpRequestError>).status).toBe(403);
  });
});
