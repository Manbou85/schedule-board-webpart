// 行動予定表の画面全体(いまは週間表示のみ)
// データは IScheduleDataService から受け取るので、プレビュー版でも WEBパーツ版でも同じ部品を使う。

import * as React from 'react';
import {
  addDays,
  canEditWorker,
  Density,
  fitTableHeight,
  NO_ENTRY_STATUS,
  summarizeStatus,
  crewToEntries,
  DEFAULT_CREW_DEPARTMENTS,
  draftFromEntry,
  findActiveOuting,
  IEntryDraft,
  INow,
  IReturnOption,
  QUICK_OUT_CATEGORY,
  quickOutEntry,
  returnedEntry,
  timeOf,
  IScheduleEntry,
  newDraft,
  suggestPlaces,
  createHolidayCalendar,
  DateKey,
  DEFAULT_CELL_RULE_OPTIONS,
  EMPTY_WORKER_DATA,
  excludeDepartments,
  filterWorkers,
  findSelf,
  groupByDepartment,
  groupByWorker,
  orderDepartments,
  HOLIDAY_WORK_CATEGORY,
  ICell,
  ICellRuleOptions,
  IFilterCriteria,
  isEmptyCriteria,
  IWorker,
  LEAVE_CATEGORY,
  resolveRow,
  sortWorkers,
  startOfWeek,
  todayKey,
  weekDates
} from '../core';
import { IRangeData, IScheduleDataService } from '../services/IScheduleDataService';
import { DisplayPopover } from './DisplayPopover';
import { ALL, FilterPopover } from './FilterPopover';
import { DatePickButton } from './DatePickButton';
import { DayList } from './DayList';
import { EntryForm } from './EntryForm';
import { errorDetail, saveErrorMessage } from './errorMessages';
import { PeriodChoiceDialog } from './PeriodChoiceDialog';
import { ModalPortal } from './ModalPortal';
import { QuickOutDialog } from './QuickOutDialog';
import { formatClock, formatMonthDay, formatShortDate, formatShortRange, formatVersion, formatWeekday } from './format';
import { getCategoryStyle, HOLIDAY_WORK_STYLE, ICategoryStyle, LEAVE_STYLE } from './categoryStyle';
import { HelpDialog } from './HelpDialog';
import { Icon } from './Icon';
import { IGridGroup, WeekGrid } from './WeekGrid';
import styles from './ScheduleBoard.module.scss';

export interface IScheduleBoardProps {
  service: IScheduleDataService;
  /** 予定表から外す部署(初期値:退職者) */
  excludedDepartments: string[];
  /** 「自分を一番上に表示」の最初の状態 */
  pinSelfByDefault: boolean;
  cellRuleOptions?: ICellRuleOptions;
  /** 今日の日付(プレビューで日付を固定したいとき用。ふだんは空) */
  today?: DateKey;
  /** 最初に出す表示。省略するとスマホ幅は日表示、それ以外は週間表示 */
  initialView?: ViewMode;
  /** 版(例 '0.2.0')。右下に小さく「ver 0.2.0」と出す。どの版を試しているか確かめるため */
  version?: string;
  /** 上に小さく出すタイトル(例 行動予定表)。空なら出さない */
  title?: string;
  /** ヘルプの「困ったとき」に出す連絡先。空なら出さない */
  helpContact?: string;
  /** 部署の並び順(書いた部署から順に。空なら No. 順のまま) */
  departmentOrder?: string[];
  /** 作業員の行き先リストを反映する部署(空なら全員。WEBパーツの設定。初期値は「作業員」) */
  crewDepartments?: string[];
  /** 「行の高さ」などの表示の設定を覚えておく場所。省略すると覚えない(開き直すと「ふつう」に戻る) */
  prefsStore?: IViewPrefsStore;
}

/** 自動で読み直す間隔(5分) */
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
/** 時計(今日の日付・今の時刻)を進める間隔(1分) */
const CLOCK_INTERVAL_MS = 60 * 1000;
/** タブに戻ったとき、前の読み込みからこれ以上たっていたら読み直す(1分) */
const REFRESH_ON_RETURN_MS = 60 * 1000;

function isPageHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/** 表示の設定を覚えておく場所(WEBパーツではブラウザ、プレビューでは覚えない) */
export interface IViewPrefsStore {
  loadDensity(): Density | undefined;
  saveDensity(density: Density): void;
}

/** 週間表示/日表示 */
export type ViewMode = 'week' | 'day';

/** スマホ幅かどうか(最初の表示を決めるときだけ使う) */
function isNarrowScreen(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
}

/** 予定表の高さを渡す CSS の変数の名前 */
const TABLE_HEIGHT_VAR = '--sb-table-height';

/**
 * ページのスクロールする入れ物を探す(SharePoint ではページの中の div、プレビューではブラウザの画面そのもの)。
 * 見つからなければ undefined(ブラウザの画面がスクロールする)。
 * 横だけ隠す設定の入れ物も「縦はスクロールできる」あつかいになり、実際には中身に合わせて伸びるだけのことがあるため、
 * 下の端が画面の下の端と同じ入れ物(=画面の高さに収まっている入れ物)だけを選ぶ
 */
function findScrollParent(el: HTMLElement): HTMLElement | undefined {
  const viewportBottom = document.documentElement.clientHeight;
  let p = el.parentElement;
  while (p && p !== document.body && p !== document.documentElement) {
    const overflowY = window.getComputedStyle(p).overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      Math.abs(p.getBoundingClientRect().bottom - viewportBottom) <= 2
    ) {
      return p;
    }
    p = p.parentElement;
  }
  return undefined;
}

interface ILoadedRange {
  key: string;
  view: ViewMode;
  start: DateKey;
  end: DateKey;
  data: IRangeData;
}

interface IBase {
  workers: IWorker[];
  categories: string[];
  selfId?: number;
  isAdmin: boolean;
}

const SELF_GROUP = '__self__';

/** 人数のまとめの札のアイコンと色 */
function statusStyle(status: string): ICategoryStyle {
  if (status === LEAVE_CATEGORY) {
    return LEAVE_STYLE;
  }
  if (status === HOLIDAY_WORK_CATEGORY) {
    return HOLIDAY_WORK_STYLE;
  }
  if (status === NO_ENTRY_STATUS) {
    return { icon: 'tag', color: '#8a8a8a', background: '#f3f3f3' };
  }
  return getCategoryStyle(status);
}

/** 管理者向け:作業員の行き先リストが表示されないときの手がかり(設定や名前の確認用) */
function crewAdminNotices(range: IRangeData | undefined, unmatched: string[]): string[] {
  const notes: string[] = [];
  const info = range ? range.crewInfo : undefined;
  if (info && info.rows === 0) {
    notes.push(
      '(管理者向け)作業員の行き先リストは読めましたが、表示中の期間の登録が0件でした。設定のサイトの URL・リストと、リストの開始日・終了日を確かめてください。'
    );
  }
  if (info && info.unreadable > 0) {
    notes.push('(管理者向け)作業員の行き先リストの ' + info.unreadable + ' 行は、作業員の名前か開始日が読めなかったため表示していません。');
  }
  if (unmatched.length > 0) {
    notes.push('(管理者向け)作業員の行き先リストに、WorkerNameList と名前が合わない人がいます:' + unmatched.join('、'));
  }
  return notes;
}

export const ScheduleBoard: React.FC<IScheduleBoardProps> = (props) => {
  const { service, excludedDepartments, pinSelfByDefault } = props;
  const cellRuleOptions = props.cellRuleOptions || DEFAULT_CELL_RULE_OPTIONS;
  // 今の時刻。開きっぱなしでも日付が変わるように、1分ごとに進める
  const [now, setNow] = React.useState<Date>(() => new Date());
  const today = props.today || todayKey(now);
  // 配列のままだと毎回「変わった」と判定されるので、文字にして比べる
  const excludedKey = excludedDepartments.join('\n');

  const [base, setBase] = React.useState<IBase | undefined>(undefined);
  const [view, setView] = React.useState<ViewMode>(props.initialView || (isNarrowScreen() ? 'day' : 'week'));
  // 選んでいる日。週間表示では、この日を含む週を出す
  const [date, setDate] = React.useState<DateKey>(today);
  const weekStart = startOfWeek(date);
  // 表示中の範囲(週間表示は7日、日表示は1日)だけを読み込む
  const rangeStart = view === 'week' ? weekStart : date;
  const rangeEnd = view === 'week' ? addDays(weekStart, 6) : date;
  // 読み込み済みのデータと、その範囲・表示。週や日を切り替えたときは、新しいデータが届くまで前の表を出したままにする
  // (表を消さないので、スクロールの位置がそのまま残り、同じ人を続けて見やすい)
  const [loaded, setLoaded] = React.useState<ILoadedRange | undefined>(undefined);
  const rangeKey = view + ':' + rangeStart + '/' + rangeEnd;
  const range = loaded ? loaded.data : undefined;
  const shownView: ViewMode = loaded ? loaded.view : view;
  const shownStart = loaded ? loaded.start : rangeStart;
  const shownEnd = loaded ? loaded.end : rangeEnd;
  // 新しい範囲を読み込み中(前の表を薄く出している)
  const loading = !!loaded && loaded.key !== rangeKey;
  const [error, setError] = React.useState<string>('');
  const [errorInfo, setErrorInfo] = React.useState<string>('');
  const [criteria, setCriteria] = React.useState<IFilterCriteria>({});
  const [pinSelf, setPinSelf] = React.useState<boolean>(pinSelfByDefault);
  // 表示の大きさ(コンパクト/ふつう/大きめ。社員がそれぞれ選ぶ。初期値は「ふつう」。WEBパーツではブラウザに覚えておく)
  const [density, setDensityState] = React.useState<Density>(() => {
    const saved = props.prefsStore ? props.prefsStore.loadDensity() : undefined;
    return saved || 'normal';
  });
  const setDensity = (value: Density): void => {
    setDensityState(value);
    if (props.prefsStore) {
      props.prefsStore.saveDensity(value);
    }
  };
  const [collapsed, setCollapsed] = React.useState<string[]>([]);
  // 開いている登録・編集フォーム(閉じているときは undefined)
  const [formDraft, setFormDraft] = React.useState<IEntryDraft | undefined>(undefined);
  // 読み直すための番号(保存のあと・5分ごと・タブに戻ったときに増やす)
  const [reloadKey, setReloadKey] = React.useState(0);
  // 最後に読み込めた時刻(画面の「◯◯:◯◯ 更新」)と、自動の読み直しに失敗したかどうか
  const [updatedAt, setUpdatedAt] = React.useState<Date | undefined>(undefined);
  const [refreshFailed, setRefreshFailed] = React.useState(false);
  // いま画面に出しているデータの範囲(同じ範囲の読み直しは、画面を消さずに裏で行う)
  const loadedRangeRef = React.useRef('');
  const lastLoadRef = React.useRef(0);
  const reload = React.useCallback(() => setReloadKey((k) => k + 1), []);

  // 時計を進める。5分ごとに読み直す(タブが隠れているあいだは休む)
  React.useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), CLOCK_INTERVAL_MS);
    const refresh = window.setInterval(() => {
      if (!isPageHidden()) {
        reload();
      }
    }, REFRESH_INTERVAL_MS);
    // ほかのタブから戻ってきたら、すぐ新しくする
    const onVisible = (): void => {
      if (isPageHidden()) {
        return;
      }
      setNow(new Date());
      if (Date.now() - lastLoadRef.current > REFRESH_ON_RETURN_MS) {
        reload();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(clock);
      window.clearInterval(refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  // 開きっぱなしで日付が変わったら、「今日」を見ていた人は新しい今日へ進める
  const prevTodayRef = React.useRef(today);
  React.useEffect(() => {
    const prev = prevTodayRef.current;
    if (prev !== today) {
      prevTodayRef.current = today;
      setDate((d) => (d === prev ? today : d));
    }
  }, [today]);
  const [helpOpen, setHelpOpen] = React.useState(false);
  // 人数のまとめで選んだ状態(例 外出)。その状態の人だけにしぼる。空ならしぼらない
  const [statusFilter, setStatusFilter] = React.useState('');
  // 「自分の行へ」ボタン:自分の行が見えなくなったときだけ出す(表が画面に見えているときに限る)
  const tableAreaRef = React.useRef<HTMLDivElement>(null);
  const [selfOutOfView, setSelfOutOfView] = React.useState(false);
  // 長期の予定を押したときの選択画面
  const [periodChoice, setPeriodChoice] = React.useState<{ entry: IScheduleEntry; date: DateKey } | undefined>(undefined);
  // 「ちょっと外出」の画面と、その候補(最近の外出先)
  const [quickOpen, setQuickOpen] = React.useState(false);
  const [quickPlaces, setQuickPlaces] = React.useState<string[]>([]);
  const [returning, setReturning] = React.useState(false);
  // 表示中の範囲に今日が入っていないとき用の、今日の予定(「帰社しました」を出すかどうかの判定に使う)
  const [todayEntries, setTodayEntries] = React.useState<IScheduleEntry[] | undefined>(undefined);
  // 「予定を登録しました」などのお知らせ
  const [toast, setToast] = React.useState('');

  // 予定表の高さを、画面の残りの高さに合わせる(ページ全体と予定表のスクロールが二重にならないように。ver 0.6.7)
  // 高さは CSS の変数 --sb-table-height で予定表に渡す(画面を作り直さずに済むように、要素に直接書く)
  const rootRef = React.useRef<HTMLDivElement>(null);
  // WEBパーツより下にあるもの(ページの下の余白など)の高さ。ページがはみ出したときに測り直す
  const pageBelowRef = React.useRef(24);
  const fitHeight = React.useCallback((): void => {
    const root = rootRef.current;
    const area = tableAreaRef.current;
    if (!root || !area) {
      return;
    }
    const scroller = findScrollParent(root);
    let contentTop: number;
    let visibleHeight: number;
    let scrollHeight: number;
    if (scroller) {
      contentTop = scroller.getBoundingClientRect().top + scroller.clientTop - scroller.scrollTop;
      visibleHeight = scroller.clientHeight;
      scrollHeight = scroller.scrollHeight;
    } else {
      contentTop = -(window.pageYOffset || 0);
      visibleHeight = document.documentElement.clientHeight;
      scrollHeight = document.documentElement.scrollHeight;
    }
    const rootRect = root.getBoundingClientRect();
    const areaRect = area.getBoundingClientRect();
    if (scrollHeight > visibleHeight + 1) {
      pageBelowRef.current = Math.max(0, scrollHeight - (rootRect.bottom - contentTop));
    }
    const height = fitTableHeight({
      visibleHeight,
      tableTop: areaRect.top - contentTop,
      belowTable: rootRect.bottom - areaRect.bottom + pageBelowRef.current,
      viewportWidth: window.innerWidth
    });
    const value = height === undefined ? '' : height + 'px';
    if (root.style.getPropertyValue(TABLE_HEIGHT_VAR) !== value) {
      if (value) {
        root.style.setProperty(TABLE_HEIGHT_VAR, value);
      } else {
        root.style.removeProperty(TABLE_HEIGHT_VAR);
      }
    }
  }, []);
  // 表示が変わるたび(週・日の切り替え、読み込み、絞り込み、部署の開閉など)と、画面の大きさが変わったときに測り直す
  React.useLayoutEffect(fitHeight);
  React.useEffect(() => {
    window.addEventListener('resize', fitHeight);
    return () => window.removeEventListener('resize', fitHeight);
  }, [fitHeight]);

  React.useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadPlaces = React.useCallback(
    (workerId: number): Promise<string[]> =>
      service.getRecentEntries(workerId, 100).then((list) => suggestPlaces(list, workerId, undefined, 30)),
    [service]
  );
  const saveEntry = React.useCallback(
    (entry: Omit<IScheduleEntry, 'id'> & { id?: number }): Promise<void> =>
      (entry.id !== undefined ? service.updateEntry(entry as IScheduleEntry) : service.createEntry(entry)).then(() => undefined),
    [service]
  );
  const deleteEntry = React.useCallback((id: number): Promise<void> => service.deleteEntry(id), [service]);

  // 人・区分・ログイン中のユーザーは、ページを開いたときに1回だけ読む
  React.useEffect(() => {
    let alive = true;
    Promise.all([service.getWorkers(), service.getCategories(), service.getCurrentUser()])
      .then(([workers, categories, user]) => {
        if (!alive) {
          return;
        }
        const list = sortWorkers(excludeDepartments(workers, excludedKey.split('\n')));
        const self = findSelf(list, user.account);
        setBase({ workers: list, categories, selfId: self ? self.id : undefined, isAdmin: user.isAdmin });
      })
      .catch((e: unknown) => {
        if (alive) {
          setError('メンバーの一覧を読み込めませんでした。少し時間をおいて、ページを開き直してください。');
          setErrorInfo(errorDetail(e));
        }
      });
    return () => {
      alive = false;
    };
  }, [service, excludedKey]);

  // 表示している範囲のデータを読む(週・日を切り替えるたび、読み直しのたび)
  React.useEffect(() => {
    let alive = true;
    // 同じ範囲の読み直しは裏で読み、失敗しても今の表示を残す(画面がちらつかないように)
    const silent = loadedRangeRef.current === rangeKey;
    const requested = { key: rangeKey, view, start: rangeStart, end: rangeEnd };
    service
      .getRange(rangeStart, rangeEnd)
      .then((r) => {
        if (!alive) {
          return;
        }
        loadedRangeRef.current = rangeKey;
        lastLoadRef.current = Date.now();
        setLoaded({ ...requested, data: r });
        setUpdatedAt(new Date());
        setRefreshFailed(false);
      })
      .catch((e: unknown) => {
        if (!alive) {
          return;
        }
        if (silent) {
          // 裏での読み直しに失敗したときは、今の表示を残して小さく知らせるだけにする
          setRefreshFailed(true);
          return;
        }
        setError('予定を読み込めませんでした。少し時間をおいて、ページを開き直してください。');
        setErrorInfo(errorDetail(e));
      });
    return () => {
      alive = false;
    };
    // rangeKey は view・rangeStart・rangeEnd から作るので、これだけ見ればよい
  }, [service, rangeKey, reloadKey]);

  // 今の日時(終わった今日の予定を薄くする・外出中かどうかの判定に使う)
  const nowTime = timeOf(now);
  const nowInfo = React.useMemo<INow>(() => ({ date: today, time: nowTime }), [today, nowTime]);

  // 今日が表示中の範囲に入っていないとき(ほかの週を見ているとき)は、今日の分を別に読む
  const coversToday = today >= shownStart && today <= shownEnd;
  const selfId = base ? base.selfId : undefined;
  React.useEffect(() => {
    if (coversToday || selfId === undefined) {
      return undefined;
    }
    let alive = true;
    service.getRange(today, today).then(
      (r) => alive && setTodayEntries(r.entries),
      () => undefined // 読めなくても予定表は使えるので、何もしない
    );
    return () => {
      alive = false;
    };
  }, [service, coversToday, selfId, today, reloadKey]);
  const selfTodayEntries = coversToday ? (range ? range.entries : undefined) : todayEntries;
  const activeOuting =
    selfId !== undefined && selfTodayEntries ? findActiveOuting(selfTodayEntries, selfId, nowInfo) : undefined;

  const days = React.useMemo(() => {
    const calendar = createHolidayCalendar(range ? range.holidays : []);
    return (shownView === 'week' ? weekDates(shownStart) : [shownStart]).map(calendar);
  }, [shownView, shownStart, range]);

  // 作業員の行き先(別サイトのリスト)を、名前で WorkerNameList の人に結びつける
  const crewDeptKey = (props.crewDepartments || DEFAULT_CREW_DEPARTMENTS).join('\n');
  const crew = React.useMemo(
    () =>
      base && range
        ? crewToEntries(range.crewAssignments || [], base.workers, crewDeptKey ? crewDeptKey.split('\n') : [])
        : { entries: [], unmatched: [] },
    [base, range, crewDeptKey]
  );

  // 全員ぶんのマスを作る(表示ルールは core の resolveRow)
  const rows = React.useMemo(() => {
    const map = new Map<number, ICell[]>();
    if (!base || !range) {
      return map;
    }
    const byWorker = groupByWorker({ entries: range.entries, leaves: range.leaves, holidayWorks: range.holidayWorks, crew: crew.entries });
    base.workers.forEach((w) => {
      map.set(w.id, resolveRow(days, w.id, byWorker.get(w.id) || EMPTY_WORKER_DATA, cellRuleOptions, nowInfo));
    });
    return map;
  }, [base, range, crew, days, cellRuleOptions, nowInfo]);

  // 自分の行と表が画面に見えているかを見張る(IntersectionObserver:要素が見えるかどうかをブラウザが知らせてくれるしくみ)
  React.useEffect(() => {
    const area = tableAreaRef.current;
    const selfEl = area ? (area.querySelector('[data-self-row]') as HTMLElement | null) : null;
    if (!area || !selfEl || typeof IntersectionObserver === 'undefined') {
      setSelfOutOfView(false);
      return undefined;
    }
    let areaVisible = true;
    let selfVisible = true;
    const update = (): void => setSelfOutOfView(areaVisible && !selfVisible);
    const observer = new IntersectionObserver((list) => {
      list.forEach((e) => {
        if (e.target === area) {
          areaVisible = e.isIntersecting;
        } else {
          selfVisible = e.isIntersecting;
        }
      });
      update();
    });
    observer.observe(area);
    observer.observe(selfEl);
    return () => observer.disconnect();
  });

  if (error) {
    return (
      <div className={styles.scheduleBoard}>
        <p className={styles.message} role="alert">
          {error}
        </p>
        {errorInfo && <p className={styles.errorDetail}>くわしい内容(管理者向け):{errorInfo}</p>}
      </div>
    );
  }
  if (!base) {
    return (
      <div className={styles.scheduleBoard}>
        <p className={styles.message}>読み込み中です…</p>
      </div>
    );
  }

  const filtered = filterWorkers(base.workers, rows, criteria);
  // 人数のまとめ:日表示はその日、週間表示は今日がその週にあれば今日(なければ出さない)
  let summaryIndex = -1;
  if (range && !loading) {
    if (shownView === 'day') {
      summaryIndex = 0;
    } else {
      for (let i = 0; i < days.length; i++) {
        if (days[i].date === today) {
          summaryIndex = i;
        }
      }
    }
  }
  const summaryDate = summaryIndex >= 0 ? days[summaryIndex].date : '';
  const summary = summaryIndex >= 0 ? summarizeStatus(filtered, rows, summaryIndex, base.categories, nowInfo) : [];
  const activeStatus = summary.filter((s) => s.status === statusFilter)[0];
  const shown = activeStatus ? filtered.filter((w) => activeStatus.workerIds.indexOf(w.id) >= 0) : filtered;
  const summaryLabel = summaryDate
    ? (summaryDate === today ? '今日 ' : '') + formatMonthDay(summaryDate) + '(' + formatWeekday(summaryDate) + ')'
    : '';
  const self = base.selfId !== undefined ? shown.filter((w) => w.id === base.selfId) : [];
  const usePin = pinSelf && self.length > 0;
  const groups: IGridGroup[] = [];
  if (usePin) {
    groups.push({ key: SELF_GROUP, label: 'あなた', workers: self, collapsible: false });
  }
  const departmentOrder = props.departmentOrder || [];
  orderDepartments(groupByDepartment(usePin ? shown.filter((w) => w.id !== base.selfId) : shown), departmentOrder).forEach((g) => {
    groups.push({ key: g.department, label: g.department || '(部署なし)', workers: g.workers, collapsible: true });
  });
  const filtering = shown.length !== base.workers.length;

  const departments = orderDepartments(groupByDepartment(base.workers), departmentOrder).map((g) => g.department);
  // 区分の選択肢に「休暇」があれば(ver 0.7.0 から)、総務の休暇とあわせて1つにする
  const categoryOptions = base.categories.concat(
    [LEAVE_CATEGORY, HOLIDAY_WORK_CATEGORY].filter((c) => base.categories.indexOf(c) < 0)
  );
  const thisWeek = startOfWeek(today);
  const openDay = (d: DateKey): void => {
    setDate(d);
    setView('day');
  };
  const day = days[0];
  const canEdit = (workerId: number): boolean => canEditWorker(workerId, base.selfId, base.isAdmin);
  const canAdd = base.isAdmin || base.selfId !== undefined;
  // 「予定を追加」ボタンの日付:日表示はその日。週間表示は、今日がその週にあれば今日、なければ週の月曜
  const addDefaultDate = view === 'day' ? date : today >= weekStart && today <= addDays(weekStart, 6) ? today : weekStart;
  const openAdd = (workerId: number | undefined, d: DateKey): void => setFormDraft(newDraft(workerId, d));
  // 長期の予定(帯)を押したら、「この日だけ別の予定を追加」か「期間の予定を変更」かを選んでもらう
  const openEdit = (entry: IScheduleEntry, d?: DateKey): void => {
    if (entry.readOnly && !d) {
      return; // 作業員の行き先リストの予定は、この画面では変更しない
    }
    if (entry.entryType === 'period' && d) {
      setPeriodChoice({ entry, date: d });
    } else {
      setFormDraft(draftFromEntry(entry));
    }
  };
  const closeForm = (message?: string): void => {
    setFormDraft(undefined);
    if (message) {
      setToast(message);
      reload();
    }
  };
  const department = criteria.departments && criteria.departments[0] ? criteria.departments[0] : ALL;
  const category = criteria.categories && criteria.categories[0] ? criteria.categories[0] : ALL;

  const toggleGroup = (key: string): void => {
    setCollapsed(collapsed.indexOf(key) >= 0 ? collapsed.filter((k) => k !== key) : collapsed.concat([key]));
  };

  const title = (props.title || '').trim();
  // お知らせ:読めなかったリスト。管理者には、作業員の行き先で名前が合わない人も知らせる(設定の確認用)
  const warnings = (range && range.warnings ? range.warnings : []).concat(
    base.isAdmin ? crewAdminNotices(range, crew.unmatched) : []
  );
  const dateText = view === 'week' ? formatShortRange(weekStart, addDays(weekStart, 6)) : formatShortDate(date);

  // 「ちょっと外出」:自分の行があり、区分に「外出」があるときだけ使える
  const canQuickOut = base.selfId !== undefined && base.categories.indexOf(QUICK_OUT_CATEGORY) >= 0 && !!selfTodayEntries;
  const openQuickOut = (): void => {
    setQuickPlaces([]);
    setQuickOpen(true);
    if (base.selfId !== undefined) {
      const id = base.selfId;
      service.getRecentEntries(id, 100).then(
        (list) => {
          const outings = list.filter((e) => e.category.trim() === QUICK_OUT_CATEGORY);
          setQuickPlaces(
            suggestPlaces(outings, id, undefined, 12)
              .map((p) => p.replace('(直帰)', '').trim())
              .filter((p, i, all) => !!p && p !== '外出' && all.indexOf(p) === i)
              .slice(0, 6)
          );
        },
        () => undefined
      );
    }
  };
  const saveQuickOut = (place: string, option: IReturnOption): Promise<void> => {
    if (base.selfId === undefined) {
      return Promise.reject('');
    }
    return service.createEntry(quickOutEntry(base.selfId, today, new Date(), place, option)).then(
      () => {
        setQuickOpen(false);
        setToast(option.key === 'direct' ? '外出(直帰)を登録しました' : '外出を登録しました。帰社したら「帰社しました」を押してください');
        reload();
      },
      (e: unknown) => Promise.reject(saveErrorMessage(e, '保存'))
    );
  };
  const markReturned = (): void => {
    if (!activeOuting || returning) {
      return;
    }
    setReturning(true);
    service.updateEntry(returnedEntry(activeOuting, new Date())).then(
      () => {
        setReturning(false);
        setNow(new Date());
        setToast('帰社を登録しました');
        reload();
      },
      (e: unknown) => {
        setReturning(false);
        setToast(saveErrorMessage(e, '保存'));
      }
    );
  };

  const rootClass =
    styles.scheduleBoard + (density === 'compact' ? ' ' + styles.compact : density === 'large' ? ' ' + styles.large : '');

  return (
    <div ref={rootRef} className={rootClass}>
      <div className={styles.titleRow}>
        {title ? <h2 className={styles.boardTitle}>{title}</h2> : <span />}
        <div className={styles.titleTools}>
        {updatedAt && (
          <button
            type="button"
            className={styles.updatedButton + (refreshFailed ? ' ' + styles.updatedFailed : '')}
            title="今すぐ新しくする(5分ごとに自動で新しくなります)"
            onClick={reload}
          >
            <Icon name="refresh" size={14} />
            {refreshFailed ? '新しくできませんでした(' + formatClock(updatedAt) + ' の内容)' : formatClock(updatedAt) + ' 更新'}
          </button>
        )}
        </div>
      </div>
      <div className={styles.toolbar}>
        {/* 左端:よく使う登録のボタン(ver 0.8.0 で左端へ。SharePoint リストの「新しいアイテムを追加」などと同じ場所。
            画面の幅や日付の文字の長さが変わっても位置が動かない)。スマホでは日付の移動の下に、横幅いっぱいの1行で出す */}
          {(canQuickOut || canAdd) && (
            <div className={styles.actionGroup}>
          {canQuickOut &&
            (activeOuting ? (
              <button
                type="button"
                className={styles.returnNowButton}
                disabled={returning}
                title={'外出中:' + activeOuting.title + (activeOuting.endTime ? '(' + activeOuting.endTime + ' 戻り予定)' : '')}
                onClick={markReturned}
              >
                {/* 会社に戻る=在社と同じ建物(「ちょっと外出」の車と対になる。開発者回答) */}
                <Icon name="building" size={18} />
                {returning ? '登録しています…' : '帰社しました'}
              </button>
            ) : (
              <button type="button" className={styles.quickOutButton} onClick={openQuickOut}>
                <Icon name="car" size={18} />
                ちょっと外出
              </button>
            ))}
              {canAdd && (
                <button
                  type="button"
                  className={styles.addButton}
                  onClick={() => openAdd(base.selfId, addDefaultDate)}
                >
                  <Icon name="plus" size={18} />
                  <span className={styles.toolButtonText}>予定を追加</span>
                </button>
              )}
            </div>
          )}
        {/* 表示の切り替え(週・日)と日付の移動 */}
        <div className={styles.leftGroup}>
            <div className={styles.viewSwitch} role="group" aria-label="表示の切り替え">
              <button type="button" className={styles.viewButton} aria-pressed={view === 'week'} onClick={() => setView('week')}>
                週
              </button>
              <button type="button" className={styles.viewButton} aria-pressed={view === 'day'} onClick={() => setView('day')}>
                日
              </button>
            </div>
        <div className={styles.navGroup} role="group" aria-label={view === 'week' ? '週の切り替え' : '日の切り替え'}>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={view === 'week' ? '前の週' : '前の日'}
            title={view === 'week' ? '前の週' : '前の日'}
            onClick={() => setDate(addDays(date, view === 'week' ? -7 : -1))}
          >
            <Icon name="chevronLeft" size={18} />
          </button>
          <button
            type="button"
            className={styles.toolButton}
            disabled={view === 'week' ? weekStart === thisWeek : date === today}
            onClick={() => setDate(today)}
          >
            {view === 'week' ? '今週' : '今日'}
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={view === 'week' ? '次の週' : '次の日'}
            title={view === 'week' ? '次の週' : '次の日'}
            onClick={() => setDate(addDays(date, view === 'week' ? 7 : 1))}
          >
            <Icon name="chevronRight" size={18} />
          </button>
          <div className={styles.dateLabel} aria-live="polite">
            {/* 先頭の「2026年 」はスマホでは省く(1行に収めるため) */}
            <span className={styles.yearText}>{dateText.substring(0, 6)}</span>
            {dateText.substring(6)}
            {view === 'day' && date === today && <span className={styles.todayChip}>今日</span>}
            {view === 'day' && range && !loading && day && day.isHoliday && <span className={styles.holidayChip}>{day.holidayName || '休日'}</span>}
            {view === 'day' && range && !loading && day && day.workdayName && <span className={styles.workdayChip}>{day.workdayName}</span>}
          </div>
          <DatePickButton value={date} onChange={setDate} />
        </div>
        </div>

        {/* 右:探す・絞り込み・表示設定・ヘルプ */}
        <div className={styles.toolGroup}>
          <label className={styles.searchBox}>
            <Icon name="search" size={18} className={styles.searchIcon} />
            <span className={styles.srOnly}>名前・行き先で探す</span>
            <input
              type="search"
              className={styles.searchInput}
              value={criteria.keyword || ''}
              placeholder="名前・行き先で探す"
              onChange={(e) => setCriteria({ ...criteria, keyword: e.target.value })}
            />
          </label>
          <FilterPopover
            department={department}
            category={category}
            departments={departments}
            categories={categoryOptions}
            onDepartmentChange={(v) => setCriteria({ ...criteria, departments: v ? [v] : [] })}
            onCategoryChange={(v) => setCriteria({ ...criteria, categories: v ? [v] : [] })}
          />
          <DisplayPopover
            density={density}
            onDensityChange={setDensity}
            pinSelf={pinSelf}
            hasSelf={base.selfId !== undefined}
            onPinSelfChange={setPinSelf}
          />
          <button
            type="button"
            className={styles.iconButton}
            aria-label="使い方(ヘルプ)"
            title="使い方(ヘルプ)"
            aria-haspopup="dialog"
            onClick={() => setHelpOpen(true)}
          >
            <Icon name="help" size={20} />
          </button>
        </div>
      </div>

      {warnings.length > 0 && (
        <div className={styles.warning} role="status">
          {warnings.map((w) => (
            <div key={w}>{w}</div>
          ))}
          {base.isAdmin &&
            range &&
            (range.warningDetails || []).map((d) => (
              <div key={'d' + d} className={styles.warningDetail}>
                くわしい内容(管理者向け):{d}
              </div>
            ))}
        </div>
      )}

      {/* 人数のまとめ:押すと、その状態の人だけにしぼる(もう一度押すと元に戻る) */}
      {summary.length > 0 && (
        <div className={styles.summaryRow} role="group" aria-label={'人数のまとめ(' + summaryLabel + ')'}>
          <span className={styles.summaryLabel}>{summaryLabel}</span>
          {summary.map((s) => {
            const st = statusStyle(s.status);
            const pressed = !!activeStatus && activeStatus.status === s.status;
            return (
              <button
                key={s.status}
                type="button"
                className={styles.summaryChip}
                aria-pressed={pressed}
                title={pressed ? 'もう一度押すと、しぼり込みを外します' : s.status + 'の人だけを表示します'}
                style={pressed ? { borderColor: st.color, background: st.background } : undefined}
                onClick={() => setStatusFilter(pressed ? '' : s.status)}
              >
                <Icon name={st.icon} color={st.color} size={16} />
                {s.status}
                <span className={styles.summaryCount}>{s.count}</span>人
              </button>
            );
          })}
        </div>
      )}

      {/* 絞り込み中だけ出す行:条件の札(× で外せる)と人数 */}
      {(!isEmptyCriteria(criteria) || !!activeStatus) && (
        <div className={styles.activeFilters} aria-live="polite">
          {department !== ALL && (
            <button type="button" className={styles.chip} onClick={() => setCriteria({ ...criteria, departments: [] })}>
              部署:{department}
              <Icon name="close" size={14} />
              <span className={styles.srOnly}>(外す)</span>
            </button>
          )}
          {category !== ALL && (
            <button type="button" className={styles.chip} onClick={() => setCriteria({ ...criteria, categories: [] })}>
              区分:{category}
              <Icon name="close" size={14} />
              <span className={styles.srOnly}>(外す)</span>
            </button>
          )}
          {activeStatus && (
            <button type="button" className={styles.chip} onClick={() => setStatusFilter('')}>
              {summaryLabel}:{activeStatus.status}
              <Icon name="close" size={14} />
              <span className={styles.srOnly}>(外す)</span>
            </button>
          )}
          <span className={styles.count}>
            {base.workers.length}人中 {shown.length}人を表示
          </span>
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setCriteria({});
              setStatusFilter('');
            }}
          >
            すべて解除
          </button>
        </div>
      )}

      <div ref={tableAreaRef} className={styles.tableArea + (loading ? ' ' + styles.tableLoading : '')} aria-busy={loading}>
      {!range ? (
        <p className={styles.message}>予定を読み込み中です…</p>
      ) : shown.length === 0 ? (
        <p className={styles.message}>条件に合う人がいません。条件を変えてみてください。</p>
      ) : shownView === 'week' ? (
        <WeekGrid
          days={days}
          today={today}
          groups={groups}
          rows={rows}
          selfId={base.selfId}
          // 絞り込み中は、見落とさないようにすべて開いて表示する
          collapsed={filtering ? [] : collapsed}
          onToggleGroup={toggleGroup}
          onSelectDay={openDay}
          canEdit={canEdit}
          onAdd={openAdd}
          onEdit={openEdit}
        />
      ) : (
        <DayList
          groups={groups}
          rows={rows}
          selfId={base.selfId}
          collapsed={filtering ? [] : collapsed}
          onToggleGroup={toggleGroup}
          canEdit={canEdit}
          onAdd={(workerId) => openAdd(workerId, shownStart)}
          onEdit={openEdit}
        />
      )}
      </div>

      {formDraft && (
        <EntryForm
          initial={formDraft}
          today={today}
          categories={base.categories}
          workers={base.workers}
          isAdmin={base.isAdmin}
          selfId={base.selfId}
          loadPlaces={loadPlaces}
          onSave={saveEntry}
          onDelete={deleteEntry}
          onClose={closeForm}
        />
      )}

      {/* 画面に固定して出すもの(お知らせ・「自分の行へ」)は、ページのいちばん外側に出す。
          SharePoint では WEBパーツの中に固定して置くと、画面ではなく WEBパーツのいちばん下に出てしまうため */}
      <ModalPortal>
        <div className={styles.toastArea} aria-live="polite">
          {toast && <div className={styles.toast}>{toast}</div>}
        </div>

        {selfOutOfView && (
          <button
            type="button"
            className={styles.toSelfButton}
            onClick={() => {
              const area = tableAreaRef.current;
              const selfEl = area ? (area.querySelector('[data-self-row]') as HTMLElement | null) : null;
              if (selfEl) {
                selfEl.scrollIntoView({ block: 'center', behavior: 'smooth' });
              }
            }}
          >
            <Icon name="arrowUp" size={18} />
            自分の行へ
          </button>
        )}
      </ModalPortal>

      {periodChoice && (
        <PeriodChoiceDialog
          entry={periodChoice.entry}
          date={periodChoice.date}
          onAddForDay={() => {
            setPeriodChoice(undefined);
            openAdd(periodChoice.entry.workerId, periodChoice.date);
          }}
          onEditPeriod={() => {
            setPeriodChoice(undefined);
            setFormDraft(draftFromEntry(periodChoice.entry));
          }}
          onClose={() => setPeriodChoice(undefined)}
        />
      )}
      {quickOpen && <QuickOutDialog recentPlaces={quickPlaces} onSave={saveQuickOut} onClose={() => setQuickOpen(false)} />}
      {helpOpen && <HelpDialog categories={base.categories} contact={props.helpContact} onClose={() => setHelpOpen(false)} />}

      {formatVersion(props.version) && (
        <p className={styles.versionBadge} title="このWEBパーツの版">
          {formatVersion(props.version)}
        </p>
      )}
    </div>
  );
};
