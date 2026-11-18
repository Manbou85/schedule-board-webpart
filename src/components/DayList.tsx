// 日表示(選んだ1日の、メンバーごとのくわしい予定)
// 表示ルールは週間表示と同じ(core の resolveCell)。時刻・期間・メモ・休暇の補足は常に出す。

import * as React from 'react';
import { formatTimeRange, ICell, IScheduleEntry } from '../core';
import { getCategoryStyle, HOLIDAY_WORK_STYLE, ICategoryStyle, LEAVE_STYLE } from './categoryStyle';
import { finishedLabel, formatPeriod } from './format';
import { Icon } from './Icon';
import { EntryBox, LeaveBadge } from './ScheduleCell';
import { IGridGroup } from './WeekGrid';
import styles from './ScheduleBoard.module.scss';

export interface IDayListProps {
  groups: IGridGroup[];
  /** 担当者ID → その日のマス(1つ) */
  rows: Map<number, ICell[]>;
  selfId?: number;
  collapsed: string[];
  onToggleGroup: (key: string) => void;
  canEdit: (workerId: number) => boolean;
  onAdd: (workerId: number) => void;
  onEdit: (entry: IScheduleEntry) => void;
}

interface IDetailProps {
  /** 編集できる予定のとき:押すと変更フォーム */
  entry?: IScheduleEntry;
  onEdit?: (entry: IScheduleEntry) => void;
  st: ICategoryStyle;
  /** 区分名などの小さい見出し */
  label: React.ReactNode;
  place: string;
  /** 時刻・期間などの補足 */
  meta: string[];
  note?: string;
  dimmed?: boolean;
}

/** 予定1件分(アイコン+区分+行き先+時刻など) */
const Detail: React.FC<IDetailProps> = ({ entry, onEdit, st, label, place, meta, note, dimmed }) => {
  const inner = (
    <>
    <Icon name={st.icon} color={st.color} size={20} className={styles.icon} />
    <div className={styles.dayEntryText}>
      <span className={styles.categoryLabel}>{label}</span>
      <span className={styles.dayPlace}>{place}</span>
      {meta.filter((m) => !!m).length > 0 && <span className={styles.time}>{meta.filter((m) => !!m).join(' ・ ')}</span>}
      {note && <span className={styles.dayNote}>{note}</span>}
    </div>
    </>
  );
  const className = styles.dayEntry + (dimmed ? ' ' + styles.dimmed : '');
  const style = { borderLeftColor: st.color, background: st.background };
  return entry ? (
    <EntryBox entry={entry} onEdit={onEdit} className={className} style={style}>
      {inner}
    </EntryBox>
  ) : (
    <div className={className} style={style}>
      {inner}
    </div>
  );
};

function entryMeta(e: IScheduleEntry, withPeriod: boolean): string[] {
  return [formatTimeRange(e.startTime, e.endTime), withPeriod ? '期間 ' + formatPeriod(e.startDate, e.endDate) : ''];
}

const DayCell: React.FC<{ cell: ICell | undefined; onEdit?: (entry: IScheduleEntry) => void }> = ({ cell, onEdit }) => {
  if (!cell) {
    return <></>;
  }
  const c = cell.content;
  let body: React.ReactNode;
  switch (c.kind) {
    case 'leave':
      body = <Detail st={LEAVE_STYLE} label="休暇(総務の登録)" place="休暇" meta={[]} note={c.leave.remarks} />;
      break;
    case 'holidayWork':
      body = (
        <Detail
          st={HOLIDAY_WORK_STYLE}
          label={<span className={styles.holidayWorkBadge}>休出</span>}
          place={c.holidayWork.workPlace}
          meta={[c.timeText]}
        />
      );
      break;
    case 'single':
      body = c.entries.map((e) => {
        const finished = c.finishedIds.indexOf(e.id) >= 0;
        return (
          <Detail
            key={e.id}
            entry={e}
            onEdit={onEdit}
            st={getCategoryStyle(e.category)}
            label={finished ? finishedLabel(e.category) : e.category}
            place={e.title}
            meta={entryMeta(e, false)}
            note={e.note}
            dimmed={finished}
          />
        );
      });
      break;
    case 'period':
      body = (
        <Detail
          entry={c.entry}
          onEdit={onEdit}
          st={getCategoryStyle(c.entry.category)}
          label={c.dimmed ? c.entry.category + '(休日)' : c.entry.category}
          place={c.entry.title}
          meta={entryMeta(c.entry, true)}
          note={c.entry.note}
          dimmed={c.dimmed}
        />
      );
      if (c.finished.length > 0) {
        body = (
          <>
            {body}
            {c.finished.map((e) => (
              <Detail
                key={e.id}
                entry={e}
                onEdit={onEdit}
                st={getCategoryStyle(e.category)}
                label={finishedLabel(e.category)}
                place={e.title}
                meta={entryMeta(e, false)}
                note={e.note}
                dimmed={true}
              />
            ))}
          </>
        );
      }
      break;
    default:
      body = undefined;
  }
  return (
    <>
      {body}
      {cell.badges.length > 0 && (
        <div className={styles.badges}>
          {cell.badges.map((b, i) => (
            <LeaveBadge key={i} badge={b} showRemarks={true} />
          ))}
        </div>
      )}
    </>
  );
};

export const DayList: React.FC<IDayListProps> = ({ groups, rows, selfId, collapsed, onToggleGroup, canEdit, onAdd, onEdit }) => (
  <div className={styles.dayList}>
    {groups.map((g) => {
      const isCollapsed = g.collapsible && collapsed.indexOf(g.key) >= 0;
      return (
        <section key={g.key}>
          <h3 className={styles.dayGroupHead}>
            {g.collapsible ? (
              <button type="button" className={styles.groupButton} aria-expanded={!isCollapsed} onClick={() => onToggleGroup(g.key)}>
                <Icon name={isCollapsed ? 'chevronRight' : 'chevronDown'} size={16} />
                {g.label}
                <span className={styles.groupCount}>({g.workers.length}人)</span>
              </button>
            ) : (
              <span className={styles.groupButton}>{g.label}</span>
            )}
          </h3>
          {!isCollapsed && (
            <ul className={styles.dayRows}>
              {g.workers.map((w) => (
                <li key={w.id} className={styles.dayRow + (w.id === selfId ? ' ' + styles.selfRow : '')}>
                  <div className={styles.dayName}>
                    <span className={styles.workerName}>{w.name}</span>
                    {w.id === selfId && <span className={styles.selfMark}>あなた</span>}
                  </div>
                  <div className={styles.dayContent}>
                    <DayCell cell={(rows.get(w.id) || [])[0]} onEdit={canEdit(w.id) ? onEdit : undefined} />
                    {canEdit(w.id) && (
                      <button type="button" className={styles.dayAdd} onClick={() => onAdd(w.id)}>
                        <Icon name="plus" size={14} />
                        予定を追加
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      );
    })}
  </div>
);
