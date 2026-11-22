import {
  excludeDepartments,
  findSelf,
  groupByDepartment,
  moveSelfToTop,
  orderDepartments,
  promoteWithinDepartment,
  sortWorkers,
  DEFAULT_EXCLUDED_DEPARTMENTS
} from './workers';
import { IWorker } from './types';

const workers: IWorker[] = [
  { id: 1, name: '山田 太郎', no: '0201', department: '総務部', account: 'Yamada@example.com' },
  { id: 2, name: '佐藤 花子', no: '0101', department: '役員', account: 'sato@example.com' },
  { id: 3, name: '鈴木 一郎', no: '0301', department: '建築部' },
  { id: 4, name: '田中 次郎', no: '9901', department: '退職者', account: 'tanaka@example.com' },
  { id: 5, name: '高橋 三郎', no: '0202', department: '総務部' }
];

describe('予定表に出す人の整理', () => {
  it('退職者を外す(全角・半角の空白の違いは気にしない)', () => {
    const ids = excludeDepartments(workers, DEFAULT_EXCLUDED_DEPARTMENTS).map((w) => w.id);
    expect(ids).toEqual([1, 2, 3, 5]);
    expect(excludeDepartments(workers, [' 退職者 ', '役員']).map((w) => w.id)).toEqual([1, 3, 5]);
    // 空の指定は無視する
    expect(excludeDepartments(workers, ['']).length).toBe(5);
  });

  it('No. の順に並べる(元の並びは変えない)', () => {
    expect(sortWorkers(workers).map((w) => w.no)).toEqual(['0101', '0201', '0202', '0301', '9901']);
    expect(workers[0].id).toBe(1);
  });

  it('部署ごとにまとめる(見出しの順は並び順どおり)', () => {
    const groups = groupByDepartment(sortWorkers(excludeDepartments(workers, ['退職者'])));
    expect(groups.map((g) => g.department)).toEqual(['役員', '総務部', '建築部']);
    expect(groups[1].workers.map((w) => w.id)).toEqual([1, 5]);
  });

  it('ログイン中のユーザーと M365User が一致する人を「自分」とする(大文字・小文字は区別しない)', () => {
    expect(findSelf(workers, 'yamada@EXAMPLE.com')?.id).toBe(1);
    expect(findSelf(workers, 'nobody@example.com')).toBeUndefined();
    expect(findSelf(workers, '')).toBeUndefined();
  });

  it('自分を一番上に移す', () => {
    const sorted = sortWorkers(workers);
    expect(moveSelfToTop(sorted, 5).map((w) => w.id)).toEqual([5, 2, 1, 3, 4]);
    expect(moveSelfToTop(sorted, undefined)).toBe(sorted);
  });
});

describe('部署の並び順', () => {
  const groups = ['役員', '企画室', '総務部', '建築部'].map((department) => ({ department, workers: [] }));
  const names = (gs: { department: string }[]): string[] => gs.map((g) => g.department);

  it('指定がなければ今までどおり', () => {
    expect(names(orderDepartments(groups, []))).toEqual(['役員', '企画室', '総務部', '建築部']);
    expect(names(orderDepartments(groups, ['', ' ']))).toEqual(['役員', '企画室', '総務部', '建築部']);
  });

  it('指定した部署はその順に、指定しなかった部署はうしろに今までの順で', () => {
    expect(names(orderDepartments(groups, ['建築部', ' 総務部 ']))).toEqual(['建築部', '総務部', '役員', '企画室']);
  });

  it('リストにない部署名を書いても困らない', () => {
    expect(names(orderDepartments(groups, ['営業部', '企画室']))).toEqual(['企画室', '役員', '総務部', '建築部']);
  });
});

describe('部署の中で先頭に並べる人(例:社長)', () => {
  const list: IWorker[] = [
    { id: 11, name: '青木 健太', no: '0101', department: '役員' },
    { id: 12, name: '石川 誠', no: '0102', department: '役員' },
    { id: 13, name: '上野 達也', no: '0103', department: '役員' },
    { id: 21, name: '大西 美咲', no: '0201', department: '総務部' },
    { id: 22, name: '岡本 恵', no: '0202', department: '総務部' }
  ];
  const ids = (ws: IWorker[]): number[] => ws.map((w) => w.id);

  it('指定した人を、自分の部署の一番上に出す(部署の並びは変えない)', () => {
    expect(ids(promoteWithinDepartment(list, ['上野 達也']))).toEqual([13, 11, 12, 21, 22]);
    expect(groupByDepartment(promoteWithinDepartment(list, ['岡本 恵'])).map((g) => g.department)).toEqual(['役員', '総務部']);
    expect(ids(promoteWithinDepartment(list, ['岡本 恵']))).toEqual([11, 12, 13, 22, 21]);
  });

  it('全角・半角・空白のちがいは気にしない', () => {
    expect(ids(promoteWithinDepartment(list, ['上野達也']))).toEqual([13, 11, 12, 21, 22]);
    expect(ids(promoteWithinDepartment(list, ['上野　達也']))).toEqual([13, 11, 12, 21, 22]);
  });

  it('同じ部署に複数書けば、書いた順に並ぶ', () => {
    expect(ids(promoteWithinDepartment(list, ['上野 達也', '石川 誠']))).toEqual([13, 12, 11, 21, 22]);
  });

  it('指定が空・名前が合わないときは今までどおり', () => {
    expect(ids(promoteWithinDepartment(list, []))).toEqual([11, 12, 13, 21, 22]);
    expect(ids(promoteWithinDepartment(list, ['', '名簿にない人']))).toEqual([11, 12, 13, 21, 22]);
  });
});
