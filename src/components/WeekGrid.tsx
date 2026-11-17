// 週間表示の表(縦:メンバー、横:7日)
// ヘッダー(日付)と名前の列は、スクロールしても固定する。

import * as React from 'react';
import { DateKey, ICell, IDayInfo, IWorker } from '../core';
import { formatMonthDay, formatWeekday } from './format';
import { Icon } from './Icon';
import { ScheduleCell } from './ScheduleCell';
import styles from './ScheduleBoard.module.scss';

/** 表の中のまとまり(部署、または「あなた」) */
export interface IGridGroup {
  key: string;
  label: string;
  workers: IWorker[];
  /** 折りたためるか(「あなた」の行は折りたたまない) */
  collapsible: boolean;
}

export interface IWeekGridProps {
  days: IDayInfo[];
  today: DateKey;
  groups: IGridGroup[];
  rows: Map<number, ICell[]>;
  selfId?: number;
  collapsed: string[];
  onToggleGroup: (key: string) => void;
  /** 日付を押したとき(その日の日表示を開く) */
  onSelectDay: (date: DateKey) => void;
}

/** 2つのマスが同じ長期の予定(帯をつなげる) */
function samePeriod(a: ICell | undefined, b: ICell | undefined): boolean {
  return (
    !!a && !!b && a.content.kind === 'period' && b.content.kind === 'period' && a.content.entry.id === b.content.entry.id
  );
}

export const WeekGrid: React.FC<IWeekGridProps> = (props) => {
  const { days, today, groups, rows, selfId, collapsed, onToggleGroup, onSelectDay } = props;

  const dayClass = (d: IDayInfo, base: string): string => {
    const c = [base];
    if (d.isHoliday) {
      c.push(styles.holiday);
    }
    if (d.date === today) {
      c.push(styles.today);
    }
    return c.join(' ');
  };

  return (
    <div className={styles.gridScroll}>
      <table className={styles.grid}>
        <thead>
          <tr>
            <th scope="col" className={styles.nameHead}>
              名前
            </th>
            {days.map((d) => (
              <th key={d.date} scope="col" className={dayClass(d, styles.dayHead)}>
                <button
                  type="button"
                  className={styles.dayHeadButton}
                  title={'この日の予定をくわしく見る'}
                  onClick={() => onSelectDay(d.date)}
                >
                  <span className={styles.dayDate}>{formatMonthDay(d.date)}</span>
                  <span className={d.dayOfWeek === 0 ? styles.sunday : d.dayOfWeek === 6 ? styles.saturday : ''}>
                    ({formatWeekday(d.date)})
                  </span>
                  {d.date === today && <span className={styles.todayMark}>今日</span>}
                  {d.holidayName && <span className={styles.holidayName}>{d.holidayName}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((g) => {
          const isCollapsed = g.collapsible && collapsed.indexOf(g.key) >= 0;
          return (
            <tbody key={g.key}>
              <tr className={styles.groupRow}>
                <th colSpan={days.length + 1} scope="colgroup">
                  {g.collapsible ? (
                    <button
                      type="button"
                      className={styles.groupButton}
                      aria-expanded={!isCollapsed}
                      onClick={() => onToggleGroup(g.key)}
                    >
                      <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={16} />
                      {g.label}
                      <span className={styles.groupCount}>({g.workers.length}人)</span>
                    </button>
                  ) : (
                    <span className={styles.groupButton}>{g.label}</span>
                  )}
                </th>
              </tr>
              {!isCollapsed &&
                g.workers.map((w) => {
                  const cells = rows.get(w.id) || [];
                  return (
                    <tr key={w.id} className={w.id === selfId ? styles.selfRow : undefined}>
                      <th scope="row" className={styles.nameCell}>
                        <span className={styles.workerName}>{w.name}</span>
                        {w.id === selfId && <span className={styles.selfMark}>あなた</span>}
                      </th>
                      {cells.map((cell, i) => (
                        <td key={cell.date} className={dayClass(days[i], styles.cell)}>
                          <ScheduleCell cell={cell} joinsPrev={samePeriod(cells[i - 1], cell)} joinsNext={samePeriod(cell, cells[i + 1])} />
                        </td>
                      ))}
                    </tr>
                  );
                })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
};
