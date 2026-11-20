// プレビュー版のダミーデータ(すべて架空)
// 日付は「開いた日の週」を基準に作るので、いつ開いても今週・前後の週に予定が入っている。
//
// - WorkerNameList と同じ列構成の53名(M365User 空欄の人、Department「退職者」の人を含む)
// - 長期現場・単発予定・会社休日・休暇・休日出勤が重なるパターンを含める

const { addDays, startOfWeek } = require('SB_LIB/core');

/** 決まった順に乱数を出す(毎回同じダミーデータになる) */
function makeRandom(seed) {
  let s = seed % 2147483647;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// 部署(No. の先頭2桁)と人数。合計53名
const DEPARTMENTS = [
  ['01', '役員', 3],
  ['02', '総務部', 6],
  ['03', '営業部', 7],
  ['04', '建築部', 10],
  ['05', '土木部', 9],
  ['06', '企画室', 3],
  ['07', '設計部', 5],
  ['08', '管理部', 3],
  ['09', '作業員', 4],
  ['99', '退職者', 3]
];

const FAMILY = ['青木', '石川', '上野', '大西', '岡本', '小野', '川口', '北村', '久保', '小松', '坂本', '島田', '杉山', '関口', '高田', '竹内', '千葉', '土屋', '内藤', '中川', '西田', '野口', '橋本', '浜田', '原田', '平野', '福田', '藤井', '本田', '前田', '松尾', '丸山', '三浦', '水野', '村上', '森本', '矢野', '山口', '横山', '吉川', '若林', '和田', '今井', '大塚', '片山', '菊地', '工藤', '近藤', '桜井', '柴田', '須藤', '田村', '富田'];
const GIVEN = ['健太', '美咲', '大輔', '直樹', '彩', '翔太', '由美', '誠', '恵', '拓也', '真由美', '浩二', '亮', '智子', '達也', '陽子', '修', '香織', '純一', '裕子'];

const CATEGORIES = ['現場', '在社', '外出', '出張', '研修', '休暇', 'その他'];

const SITES_BUILD = ['駅前ビル新築工事', '市民体育館改修工事', 'マンション新築工事(A棟)', '小学校耐震補強工事', '工場倉庫増築工事', '介護施設新築工事'];
const SITES_CIVIL = ['県道12号線改良工事', '河川護岸工事', '橋梁補修工事', '上水道管布設工事', '造成工事(第2工区)'];

/** WorkerNameList の行(SharePoint から読んだときと同じ列名) */
function makeWorkerRows() {
  const rows = [];
  let id = 1;
  let nameIndex = 0;
  DEPARTMENTS.forEach(([code, dept, count]) => {
    for (let i = 1; i <= count; i++) {
      const family = FAMILY[nameIndex % FAMILY.length];
      const given = GIVEN[(nameIndex * 7) % GIVEN.length];
      nameIndex++;
      const no = code + String(i < 10 ? '0' + i : i);
      // 建築部・土木部の後ろのほうの人は、M365 のアカウントなし(現場の職人さんなど)
      // 作業員は全員アカウントなし(PCを使わない。行き先は別サイトの「作業員の行き先」リストから出す)
      const noAccount = ((dept === '建築部' || dept === '土木部') && i > count - 3) || dept === '作業員';
      rows.push({
        Id: id,
        Title: family + ' ' + given,
        WorkerName: family + ' ' + given,
        No_x002e_: no,
        M365User: noAccount ? null : { EMail: 'user' + no + '@example.com', Title: family + ' ' + given },
        Department: dept
      });
      id++;
    }
  });
  return rows;
}

/** WorkerNameList の行 → 画面で使う形(フェーズ2で services に同じ処理を作る) */
function toWorker(row) {
  return {
    id: row.Id,
    name: row.WorkerName || row.Title,
    no: row.No_x002e_ || '',
    department: row.Department || '',
    account: row.M365User ? row.M365User.EMail : undefined
  };
}

function createDummyData(today) {
  const random = makeRandom(20261117);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const mon = startOfWeek(today); // 今週の月曜
  const d = (offset) => addDays(mon, offset); // 今週の月曜から数えた日

  const rows = makeWorkerRows();
  const workers = rows.map(toWorker);
  const byDept = (dept) => workers.filter((w) => w.department === dept);

  const entries = [];
  const leaves = [];
  const holidayWorks = [];
  let nextId = 1000;
  const period = (w, title, start, end, category = '現場', extra = {}) =>
    entries.push({ id: nextId++, workerId: w.id, title, entryType: 'period', category, startDate: start, endDate: end, ...extra });
  const single = (w, title, date, category, extra = {}) =>
    entries.push({ id: nextId++, workerId: w.id, title, entryType: 'single', category, startDate: date, endDate: date, ...extra });
  const leave = (w, date, kind, remarks) => leaves.push({ id: nextId++, workerId: w.id, date, kind, remarks });
  const holidayWork = (w, date, workPlace, startTime = '08:00', endTime = '17:30') =>
    holidayWorks.push({ id: nextId++, workerId: w.id, date, workPlace, startTime, endTime });

  // ---- 建築部・土木部:長期の現場が中心 ----
  const build = byDept('建築部');
  const civil = byDept('土木部');
  build.forEach((w, i) => {
    const site = SITES_BUILD[i % SITES_BUILD.length];
    if (i % 4 === 3) {
      // 週の途中で現場が切り替わる人
      period(w, site, d(-30), d(2));
      period(w, SITES_BUILD[(i + 1) % SITES_BUILD.length], d(3), d(60));
    } else {
      period(w, site, d(-40 + i), d(30 + i * 3));
    }
  });
  civil.forEach((w, i) => {
    const site = SITES_CIVIL[i % SITES_CIVIL.length];
    if (i === 2) {
      // 今週の水曜から始まる現場(帯の始まりの確認)
      period(w, site, d(2), d(45));
      single(w, '本社', d(0), '在社');
    } else if (i === 5) {
      // 今週の金曜で終わる現場(帯の終わりの確認)
      period(w, site, d(-20), d(4));
    } else {
      period(w, site, d(-25 - i), d(20 + i * 4));
    }
  });

  // 自分(プレビューでは建築部の1人目):長期現場+単発+午後休+休日出勤
  const self = build[0];
  single(self, '本社(安全大会)', d(2), '研修', { startTime: '13:00', endTime: '16:00' });
  single(self, '資材メーカー打合せ', d(2), '外出', { startTime: '09:00', endTime: '11:00' });
  leave(self, d(3), 'afternoon', '13:00から休み');
  holidayWork(self, d(5), SITES_BUILD[0]);

  // 休暇(1日)と単発予定が重なる人 → 休暇が優先されることの確認
  leave(build[1], d(1), 'fullDay');
  single(build[1], '現場説明会', d(1), '外出');
  // 本人が区分「休暇」で入れた休み(総務の申請がまだの急な休み)→ 総務の休暇と同じ見た目で出る
  single(build[3], '休暇', d(1), '休暇');
  // 長期現場の途中に休暇・遅刻・早退
  leave(build[2], d(4), 'fullDay');
  leave(civil[0], d(0), 'late', '10:00出社(通院)');
  leave(civil[1], d(2), 'early', '15:00退社');
  leave(civil[3], d(1), 'morning');
  // 休日出勤(土日)
  holidayWork(civil[0], d(5), SITES_CIVIL[0], '08:00', '12:00');
  holidayWork(civil[4], d(6), SITES_CIVIL[4]);
  holidayWork(build[5], d(12), SITES_BUILD[5]);

  // ---- 役員・総務部・企画室・管理部:在社が中心 ----
  ['役員', '総務部', '企画室', '管理部'].forEach((dept) => {
    byDept(dept).forEach((w, i) => {
      period(w, '本社', d(-60), d(90), '在社');
      if (random() < 0.5) {
        single(w, pick(['市役所', '銀行', '税務署', '取引先訪問']), d(Math.floor(random() * 5)), '外出', {
          startTime: '14:00',
          endTime: '16:00'
        });
      }
      if (i === 1) {
        leave(w, d(Math.floor(random() * 5)), 'fullDay');
      }
    });
  });
  const somu = byDept('総務部');
  single(somu[2], '安全衛生研修', d(3), '研修', { startTime: '10:00', endTime: '17:00' });
  leave(somu[3], d(0), 'afternoon');

  // ---- 営業部:外出・出張が多い(長期の予定なし) ----
  byDept('営業部').forEach((w, i) => {
    for (let k = 0; k < 5; k++) {
      const r = random();
      if (r < 0.45) {
        single(w, pick(['協力会社訪問', '施主打合せ', '現地調査', '見積説明']), d(k), '外出', {
          startTime: pick(['09:00', '10:00', '13:00', '14:30']),
          endTime: pick(['12:00', '16:00', '17:00'])
        });
      } else if (r < 0.75) {
        single(w, '本社', d(k), '在社');
      }
    }
    if (i === 0) {
      // 出張(期間)
      period(w, '大阪支店', d(1), d(3), '出張');
    }
    // 来週・先週にも少し
    single(w, '施主打合せ', d(8 + (i % 4)), '外出');
    single(w, '本社', d(-5 + (i % 4)), '在社');
  });

  // ---- 設計部:在社+現場確認 ----
  byDept('設計部').forEach((w, i) => {
    period(w, '本社(設計室)', d(-60), d(90), '在社');
    if (i % 2 === 0) {
      single(w, SITES_BUILD[i % SITES_BUILD.length] + '(現場確認)', d(1 + i), '現場', { startTime: '13:00' });
    }
  });
  single(byDept('設計部')[1], '確認申請', d(0), 'その他');

  // ---- 作業員:行き先は別サイトの「作業員の行き先」リスト(名前の文字で突き合わせる)----
  const crewWorkers = byDept('作業員');
  let crewId = 1;
  const crewAssignments = [];
  const crewSite = (w, title, start, end, nameOverride) =>
    crewAssignments.push({ id: crewId++, workerName: nameOverride || w.name, title, startDate: start, endDate: end });
  // 名前の空白が全角でも突き合わせられることの確認
  crewSite(crewWorkers[0], SITES_BUILD[1], d(-10), d(20), crewWorkers[0].name.replace(' ', '\u3000'));
  // 総務に申請する前に、行き先に「休暇」と書かれた日 → 区分を休暇として表示・集計する(ver 0.8.4)
  crewSite(crewWorkers[0], '休暇 0.5日', d(3), d(3));
  // ver 0.9.0:作業員の行き先の札と、同じ日の2行
  // 「休暇 PM」は午後休の札(現場の帯はそのまま)。同じ日に総務も「午後」を入れた → 総務の札だけ出る
  crewSite(crewWorkers[0], '休暇 PM', d(4), d(4));
  leave(crewWorkers[0], d(4), 'afternoon', '13:00から');
  // 同じ日に2現場(長期の現場の帯+その日だけの応援の現場)
  crewSite(crewWorkers[1], '駅前ロータリー整備(応援)', d(1), d(1));
  // 「早退 15時」は早退の札(現場の帯はそのまま)
  crewSite(crewWorkers[3], '早退 15時', d(2), d(2));
  // 週の途中で現場が切り替わる
  crewSite(crewWorkers[1], SITES_CIVIL[1], d(-5), d(2));
  crewSite(crewWorkers[1], SITES_CIVIL[3], d(3), d(30));
  // 総務の休暇・休日出勤が優先されることの確認
  crewSite(crewWorkers[2], SITES_BUILD[3], d(-3), d(10));
  leave(crewWorkers[2], d(1), 'fullDay');
  holidayWork(crewWorkers[2], d(5), SITES_BUILD[3]);
  // 行動予定表の長期の予定より作業員の行き先が優先、単発の予定は作業員の行き先より優先
  period(crewWorkers[3], '(行動予定表の長期の予定:作業員の行き先が優先)', d(-30), d(30));
  crewSite(crewWorkers[3], SITES_CIVIL[2], d(0), d(25));
  single(crewWorkers[3], '本社(安全講習)', d(3), '研修');
  // 作業員以外の人もリストに入っているが、反映するのは「作業員」の部署だけ(建築部の人の行は使わない)
  crewSite(build[4], '(作業員以外の人の行:表示されない)', d(-5), d(10));
  // WorkerNameList にいない名前(管理者には知らせが出る)
  crewAssignments.push({ id: crewId++, workerName: '名簿にない 作業員', title: SITES_CIVIL[0], startDate: d(0), endDate: d(5) });

  // ---- 退職者(画面には出ないことの確認) ----
  byDept('退職者').forEach((w) => period(w, '(退職者の予定:表示されない)', d(-10), d(10)));

  // ---- 会社休日 ----
  const holidays = [
    // 実際の祝日・年末年始(2026〜2027年)。種別は選択肢の文字(出勤日以外は休日あつかい)
    // 名称が空欄の行は、見出しに種別の文字(例 休業日)が出る
    { date: '2026-11-03', name: '文化の日', dayType: 'holiday', kindLabel: '祝日' },
    { date: '2026-11-23', name: '勤労感謝の日', dayType: 'holiday', kindLabel: '祝日' },
    { date: '2026-12-29', name: '', dayType: 'holiday', kindLabel: '休業日' },
    { date: '2026-12-30', name: '', dayType: 'holiday', kindLabel: '休業日' },
    { date: '2026-12-31', name: '', dayType: 'holiday', kindLabel: '休業日' },
    { date: '2027-01-01', name: '元日', dayType: 'holiday', kindLabel: '祝日' },
    { date: '2027-01-04', name: '', dayType: 'holiday', kindLabel: '休業日' },
    { date: '2027-01-11', name: '成人の日', dayType: 'holiday', kindLabel: '祝日' },
    // いつ開いても見えるように、今週の前後に置くダミー
    { date: d(-2), name: '', dayType: 'workday', kindLabel: '出勤日' },
    { date: d(9), name: '', dayType: 'holiday', kindLabel: '一斉有給' },
    { date: d(12), name: '', dayType: 'workday', kindLabel: '出勤日' }
  ];

  return {
    workers,
    categories: CATEGORIES,
    currentUser: { account: self.account, isAdmin: false },
    entries,
    leaves,
    holidayWorks,
    holidays,
    crewAssignments
  };
}

module.exports = { createDummyData, makeWorkerRows };
