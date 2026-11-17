// 検索・絞り込み(名前・現場名・部署・区分)
// 絞り込みの条件はすべて「かつ」でつなぐ(名前と部署を両方入れたら、両方に合う人だけ)。

import { cellCategories, cellPlaces } from './cellRule';
import { ICell, IWorker } from './types';

/**
 * 検索用に文字をそろえる。
 * - 全角英数字・半角カナなどを標準の形に(NFKC)
 * - 英字は小文字に
 * - 空白(半角・全角)はすべて取り除く → 「山田太郎」でも「山田 太郎」でも、名字だけ・名前だけでもヒット
 */
export function normalizeForSearch(text: string | undefined): string {
  return (text || '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
}

/** text に query が含まれるか(query が空なら常に true) */
export function matchesText(text: string | undefined, query: string | undefined): boolean {
  const q = normalizeForSearch(query);
  if (!q) {
    return true;
  }
  return normalizeForSearch(text).indexOf(q) >= 0;
}

/** 絞り込みの条件。空のものは「条件なし」 */
export interface IFilterCriteria {
  /** 名前(WorkerName)の一部 */
  name?: string;
  /** 行き先・現場名(休日出勤の出勤先も含む)の一部 */
  place?: string;
  /** 部署(いずれかに合えばよい) */
  departments?: string[];
  /** 区分(いずれかに合えばよい)。休暇は「休暇」、休日出勤は「休日出勤」 */
  categories?: string[];
}

/** 条件が何も入っていないか */
export function isEmptyCriteria(c: IFilterCriteria): boolean {
  return (
    !normalizeForSearch(c.name) &&
    !normalizeForSearch(c.place) &&
    !(c.departments && c.departments.length > 0) &&
    !(c.categories && c.categories.length > 0)
  );
}

function hasAny(values: string[], wanted: string[]): boolean {
  const w = wanted.map(normalizeForSearch);
  return values.some((v) => w.indexOf(normalizeForSearch(v)) >= 0);
}

/**
 * 条件に合う人だけを残す(並び順はそのまま)。
 * 現場名と区分は、表示中のマス(週間表示なら7日、日表示なら1日)に出ている内容で判定する。
 * @param rows 担当者ID → 表示中のマスの並び(cellRule.ts の resolveRow で作る)
 */
export function filterWorkers(
  workers: IWorker[],
  rows: Map<number, ICell[]>,
  criteria: IFilterCriteria
): IWorker[] {
  if (isEmptyCriteria(criteria)) {
    return workers;
  }
  return workers.filter((w) => {
    if (!matchesText(w.name, criteria.name)) {
      return false;
    }
    if (criteria.departments && criteria.departments.length > 0 && !hasAny([w.department], criteria.departments)) {
      return false;
    }
    const cells = rows.get(w.id) || [];
    if (normalizeForSearch(criteria.place)) {
      const placeHit = cells.some((c) => cellPlaces(c).some((p) => matchesText(p, criteria.place)));
      if (!placeHit) {
        return false;
      }
    }
    if (criteria.categories && criteria.categories.length > 0) {
      const wanted = criteria.categories;
      const categoryHit = cells.some((c) => hasAny(cellCategories(c), wanted));
      if (!categoryHit) {
        return false;
      }
    }
    return true;
  });
}

/**
 * 自分が過去に入力した行き先・現場名の候補(登録フォーム用)。
 * 新しく使った順(開始日の新しい順)に、重複を除いて返す。input があれば、それを含むものだけ。
 */
export function suggestPlaces(
  entries: { title: string; startDate: string; workerId: number }[],
  workerId: number,
  input?: string,
  limit: number = 10
): string[] {
  const mine = entries
    .filter((e) => e.workerId === workerId && e.title && e.title.trim())
    .sort((a, b) => (a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0));
  const seen: string[] = [];
  const result: string[] = [];
  for (let i = 0; i < mine.length && result.length < limit; i++) {
    const title = mine[i].title.trim();
    const key = normalizeForSearch(title);
    if (seen.indexOf(key) < 0 && matchesText(title, input)) {
      seen.push(key);
      result.push(title);
    }
  }
  return result;
}
