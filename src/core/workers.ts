// 予定表に出す人の整理(退職者の除外・並び順・部署ごとのまとまり・自分の判定)

import { IWorker } from './types';

/** 除外する部署の初期値(WEBパーツの設定で変更できるようにする) */
export const DEFAULT_EXCLUDED_DEPARTMENTS: string[] = ['退職者'];

function sameText(a: string, b: string): boolean {
  return a.normalize('NFKC').trim() === b.normalize('NFKC').trim();
}

/** 部署が除外リストに入っている人を外す(予定表・検索・担当者の選択肢で使う) */
export function excludeDepartments(workers: IWorker[], excluded: string[]): IWorker[] {
  return workers.filter((w) => !excluded.some((d) => d.trim() !== '' && sameText(w.department, d)));
}

/** No. の文字列順に並べる(同じ No. なら名前順) */
export function sortWorkers(workers: IWorker[]): IWorker[] {
  return workers.slice().sort((a, b) => {
    if (a.no !== b.no) {
      return a.no < b.no ? -1 : 1;
    }
    return a.name < b.name ? -1 : a.name > b.name ? 1 : a.id - b.id;
  });
}

/** 部署ごとのまとまり */
export interface IDepartmentGroup {
  department: string;
  workers: IWorker[];
}

/** 並び順を保ったまま、部署ごとにまとめる(見出しの順は、その部署の最初の人の位置) */
export function groupByDepartment(workers: IWorker[]): IDepartmentGroup[] {
  const groups: IDepartmentGroup[] = [];
  const index = new Map<string, IDepartmentGroup>();
  workers.forEach((w) => {
    let g = index.get(w.department);
    if (!g) {
      g = { department: w.department, workers: [] };
      index.set(w.department, g);
      groups.push(g);
    }
    g.workers.push(w);
  });
  return groups;
}

/**
 * 部署のまとまりを、指定の順に並べかえる(WEBパーツの設定「部署の並び順」)。
 * 指定した部署はその順に、指定しなかった部署はそのうしろに今までの順(No. 順)で並ぶ。
 * 指定が空なら今までどおり。部署名は前後の空白と全角・半角のちがいを気にしない。
 */
export function orderDepartments<T extends { department: string }>(groups: T[], order: string[]): T[] {
  const norm = (s: string): string => s.normalize('NFKC').trim();
  const keys = order.map(norm).filter((s) => !!s);
  if (keys.length === 0) {
    return groups;
  }
  const rank = (g: T): number => {
    const i = keys.indexOf(norm(g.department));
    return i >= 0 ? i : keys.length;
  };
  // 同じ順位どうしは元の順を保つ(古いブラウザでも安定するよう、元の位置で比べる)
  return groups
    .map((g, i) => ({ g, i }))
    .sort((a, b) => rank(a.g) - rank(b.g) || a.i - b.i)
    .map((x) => x.g);
}

/** ログイン中のユーザー(メールアドレスなど)と M365User が一致する人を探す。大文字・小文字は区別しない */
export function findSelf(workers: IWorker[], account: string | undefined): IWorker | undefined {
  const target = (account || '').trim().toLowerCase();
  if (!target) {
    return undefined;
  }
  for (let i = 0; i < workers.length; i++) {
    const a = workers[i].account;
    if (a && a.trim().toLowerCase() === target) {
      return workers[i];
    }
  }
  return undefined;
}

/** 自分を一番上に移す(「自分の行を一番上に固定」のオプション用)。自分がいなければそのまま */
export function moveSelfToTop(workers: IWorker[], selfId: number | undefined): IWorker[] {
  if (selfId === undefined) {
    return workers;
  }
  const self = workers.filter((w) => w.id === selfId);
  return self.concat(workers.filter((w) => w.id !== selfId));
}
