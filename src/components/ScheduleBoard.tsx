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
  IWorker,
  LEAVE_CATEGORY,
  resolveRow,
  sortWorkers,
  startOfWeek,
  todayKey,
  weekDates
} from '../core';
import { IRangeData, IScheduleDataService } from '../services/IScheduleDataService';
import { FilterBar } from './FilterBar';
import { formatWeekLabel } from './format';
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
  const [weekStart, setWeekStart] = React.useState<DateKey>(startOfWeek(today));
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

  // 表示している週のデータを読む(週を切り替えるたび)
  React.useEffect(() => {
    let alive = true;
    setRange(undefined);
    service
      .getRange(weekStart, addDays(weekStart, 6))
      .then((r) => alive && setRange(r))
      .catch(() => alive && setError('予定を読み込めませんでした。少し時間をおいて、ページを開き直してください。'));
    return () => {
      alive = false;
    };
  }, [service, weekStart]);

  const days = React.useMemo(() => {
    const calendar = createHolidayCalendar(range ? range.holidays : []);
    return weekDates(weekStart).map(calendar);
  }, [weekStart, range]);

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

  const toggleGroup = (key: string): void => {
    setCollapsed(collapsed.indexOf(key) >= 0 ? collapsed.filter((k) => k !== key) : collapsed.concat([key]));
  };

  return (
    <div className={styles.scheduleBoard}>
      <div className={styles.toolbar}>
        <h2 className={styles.title}>行動予定表</h2>
        <div className={styles.weekNav} role="group" aria-label="週の切り替え">
          <button type="button" className={styles.navButton} onClick={() => setWeekStart(addDays(weekStart, -7))}>
            <Icon name="chevronLeft" size={16} />
            前の週
          </button>
          <button
            type="button"
            className={styles.navButton}
            disabled={weekStart === thisWeek}
            onClick={() => setWeekStart(thisWeek)}
          >
            今週
          </button>
          <button type="button" className={styles.navButton} onClick={() => setWeekStart(addDays(weekStart, 7))}>
            次の週
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
        <div className={styles.weekLabel} aria-live="polite">
          {formatWeekLabel(weekStart, addDays(weekStart, 6))}
        </div>
      </div>

      <FilterBar
        criteria={criteria}
        departments={departments}
        categories={categoryOptions}
        pinSelf={pinSelf}
        hasSelf={base.selfId !== undefined}
        shownCount={shown.length}
        totalCount={base.workers.length}
        onChange={setCriteria}
        onPinSelfChange={setPinSelf}
      />

      {!range ? (
        <p className={styles.message}>予定を読み込み中です…</p>
      ) : shown.length === 0 ? (
        <p className={styles.message}>条件に合う人がいません。条件を変えてみてください。</p>
      ) : (
        <WeekGrid
          days={days}
          today={today}
          groups={groups}
          rows={rows}
          selfId={base.selfId}
          // 絞り込み中は、見落とさないようにすべて開いて表示する
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
