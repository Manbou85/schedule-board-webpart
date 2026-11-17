// 行動予定表の画面全体(いまは週間表示のみ)
// データは IScheduleDataService から受け取るので、プレビュー版でも WEBパーツ版でも同じ部品を使う。

import * as React from 'react';
import {
  addDays,
  createHolidayCalendar,
  DateKey,
  DEFAULT_CELL_RULE_OPTIONS,
  EMPTY_WORKER_DATA,
  excludeDepartments,
  filterWorkers,
  findSelf,
  groupByDepartment,
  groupByWorker,
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
import { ALL, FilterPopover } from './FilterPopover';
import { DatePickButton } from './DatePickButton';
import { DayList } from './DayList';
import { formatShortDate, formatShortRange } from './format';
import { getCategoryStyle, HOLIDAY_WORK_STYLE, LEAVE_STYLE } from './categoryStyle';
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
}

/** 週間表示/日表示 */
export type ViewMode = 'week' | 'day';

/** スマホ幅かどうか(最初の表示を決めるときだけ使う) */
function isNarrowScreen(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
}

interface IBase {
  workers: IWorker[];
  categories: string[];
  selfId?: number;
}

const SELF_GROUP = '__self__';

export const ScheduleBoard: React.FC<IScheduleBoardProps> = (props) => {
  const { service, excludedDepartments, pinSelfByDefault } = props;
  const cellRuleOptions = props.cellRuleOptions || DEFAULT_CELL_RULE_OPTIONS;
  const today = props.today || todayKey();
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
  const [range, setRange] = React.useState<IRangeData | undefined>(undefined);
  const [error, setError] = React.useState<string>('');
  const [criteria, setCriteria] = React.useState<IFilterCriteria>({});
  const [pinSelf, setPinSelf] = React.useState<boolean>(pinSelfByDefault);
  const [collapsed, setCollapsed] = React.useState<string[]>([]);

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
        setBase({ workers: list, categories, selfId: self ? self.id : undefined });
      })
      .catch(() => alive && setError('メンバーの一覧を読み込めませんでした。少し時間をおいて、ページを開き直してください。'));
    return () => {
      alive = false;
    };
  }, [service, excludedKey]);

  // 表示している範囲のデータを読む(週・日を切り替えるたび)
  React.useEffect(() => {
    let alive = true;
    setRange(undefined);
    service
      .getRange(rangeStart, rangeEnd)
      .then((r) => alive && setRange(r))
      .catch(() => alive && setError('予定を読み込めませんでした。少し時間をおいて、ページを開き直してください。'));
    return () => {
      alive = false;
    };
  }, [service, rangeStart, rangeEnd]);

  const days = React.useMemo(() => {
    const calendar = createHolidayCalendar(range ? range.holidays : []);
    return (view === 'week' ? weekDates(rangeStart) : [rangeStart]).map(calendar);
  }, [view, rangeStart, range]);

  // 全員ぶんのマスを作る(表示ルールは core の resolveRow)
  const rows = React.useMemo(() => {
    const map = new Map<number, ICell[]>();
    if (!base || !range) {
      return map;
    }
    const byWorker = groupByWorker(range);
    base.workers.forEach((w) => {
      map.set(w.id, resolveRow(days, w.id, byWorker.get(w.id) || EMPTY_WORKER_DATA, cellRuleOptions));
    });
    return map;
  }, [base, range, days, cellRuleOptions]);

  if (error) {
    return (
      <div className={styles.scheduleBoard}>
        <p className={styles.message} role="alert">
          {error}
        </p>
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

  const shown = filterWorkers(base.workers, rows, criteria);
  const self = base.selfId !== undefined ? shown.filter((w) => w.id === base.selfId) : [];
  const usePin = pinSelf && self.length > 0;
  const groups: IGridGroup[] = [];
  if (usePin) {
    groups.push({ key: SELF_GROUP, label: 'あなた', workers: self, collapsible: false });
  }
  groupByDepartment(usePin ? shown.filter((w) => w.id !== base.selfId) : shown).forEach((g) => {
    groups.push({ key: g.department, label: g.department || '(部署なし)', workers: g.workers, collapsible: true });
  });
  const filtering = shown.length !== base.workers.length;

  const departments = groupByDepartment(base.workers).map((g) => g.department);
  const categoryOptions = base.categories.concat([LEAVE_CATEGORY, HOLIDAY_WORK_CATEGORY]);
  const thisWeek = startOfWeek(today);
  const openDay = (d: DateKey): void => {
    setDate(d);
    setView('day');
  };
  const day = days[0];
  const department = criteria.departments && criteria.departments[0] ? criteria.departments[0] : ALL;
  const category = criteria.categories && criteria.categories[0] ? criteria.categories[0] : ALL;

  const toggleGroup = (key: string): void => {
    setCollapsed(collapsed.indexOf(key) >= 0 ? collapsed.filter((k) => k !== key) : collapsed.concat([key]));
  };

  return (
    <div className={styles.scheduleBoard}>
      <div className={styles.toolbar}>
        {/* 左:日付の移動 */}
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
            {view === 'week' ? formatShortRange(weekStart, addDays(weekStart, 6)) : formatShortDate(date)}
            {view === 'day' && date === today && <span className={styles.todayChip}>今日</span>}
            {view === 'day' && range && day && day.isHoliday && <span className={styles.holidayChip}>{day.holidayName || '休日'}</span>}
          </div>
          <DatePickButton value={date} onChange={setDate} />
        </div>

        {/* 右:探す・絞り込み・表示の切り替え */}
        <div className={styles.toolGroup}>
          <label className={styles.searchBox}>
            <Icon name="search" size={18} className={styles.searchIcon} />
            <span className={styles.srOnly}>名前・現場名で探す</span>
            <input
              type="search"
              className={styles.searchInput}
              value={criteria.keyword || ''}
              placeholder="名前・現場名で探す"
              onChange={(e) => setCriteria({ ...criteria, keyword: e.target.value })}
            />
          </label>
          <FilterPopover
            department={department}
            category={category}
            departments={departments}
            categories={categoryOptions}
            pinSelf={pinSelf}
            hasSelf={base.selfId !== undefined}
            onDepartmentChange={(v) => setCriteria({ ...criteria, departments: v ? [v] : [] })}
            onCategoryChange={(v) => setCriteria({ ...criteria, categories: v ? [v] : [] })}
            onPinSelfChange={setPinSelf}
          />
          <div className={styles.viewSwitch} role="group" aria-label="表示の切り替え">
            <button type="button" className={styles.viewButton} aria-pressed={view === 'week'} onClick={() => setView('week')}>
              週
            </button>
            <button type="button" className={styles.viewButton} aria-pressed={view === 'day'} onClick={() => setView('day')}>
              日
            </button>
          </div>
        </div>
      </div>

      {/* 絞り込み中だけ出す行:条件の札(× で外せる)と人数 */}
      {!isEmptyCriteria(criteria) && (
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
          <span className={styles.count}>
            {base.workers.length}人中 {shown.length}人を表示
          </span>
          <button type="button" className={styles.linkButton} onClick={() => setCriteria({})}>
            すべて解除
          </button>
        </div>
      )}

      {!range ? (
        <p className={styles.message}>予定を読み込み中です…</p>
      ) : shown.length === 0 ? (
        <p className={styles.message}>条件に合う人がいません。条件を変えてみてください。</p>
      ) : view === 'week' ? (
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
        />
      ) : (
        <DayList
          groups={groups}
          rows={rows}
          selfId={base.selfId}
          collapsed={filtering ? [] : collapsed}
          onToggleGroup={toggleGroup}
        />
      )}

      <ul className={styles.legend} aria-label="区分の見かた">
        {base.categories.map((c) => {
          const st = getCategoryStyle(c);
          return (
            <li key={c} style={{ borderLeftColor: st.color, background: st.background }}>
              <Icon name={st.icon} color={st.color} size={16} /> {c}
            </li>
          );
        })}
        <li style={{ borderLeftColor: LEAVE_STYLE.color, background: LEAVE_STYLE.background }}>
          <Icon name={LEAVE_STYLE.icon} color={LEAVE_STYLE.color} size={16} /> 休暇
        </li>
        <li style={{ borderLeftColor: HOLIDAY_WORK_STYLE.color, background: HOLIDAY_WORK_STYLE.background }}>
          <Icon name={HOLIDAY_WORK_STYLE.icon} color={HOLIDAY_WORK_STYLE.color} size={16} /> 休日出勤
        </li>
      </ul>
    </div>
  );
};
