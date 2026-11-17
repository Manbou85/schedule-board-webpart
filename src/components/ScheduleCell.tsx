// 1マス(1人×1日)の中身
// どれを表示するかは core の resolveCell で決まっているので、ここでは見た目だけを作る。

import * as React from 'react';
import { formatTimeRange, ICell, ILeaveBadge, IScheduleEntry } from '../core';
import { getCategoryStyle, HOLIDAY_WORK_STYLE, LEAVE_STYLE } from './categoryStyle';
import { formatPeriod } from './format';
import { Icon } from './Icon';
import styles from './ScheduleBoard.module.scss';

export interface IScheduleCellProps {
  cell: ICell;
  /** 前の日も同じ長期の予定(帯が左につながる) */
  joinsPrev: boolean;
  /** 次の日も同じ長期の予定(帯が右につながる) */
  joinsNext: boolean;
}

/** 午前休などのバッジ。補足(時刻など)はマウスを乗せる/タップすると出る */
const LeaveBadge: React.FC<{ badge: ILeaveBadge }> = ({ badge }) => {
  const [open, setOpen] = React.useState(false);
  if (!badge.remarks) {
    return <span className={styles.leaveBadge}>{badge.label}</span>;
  }
  return (
    <span className={styles.leaveBadgeWrap}>
      <button
        type="button"
        className={styles.leaveBadge}
        title={badge.remarks}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {badge.label}
        <Icon name="info" size={13} className={styles.badgeInfo} />
      </button>
      {open && <span className={styles.badgeRemarks}>{badge.remarks}</span>}
    </span>
  );
};

const SingleEntry: React.FC<{ entry: IScheduleEntry }> = ({ entry }) => {
  const st = getCategoryStyle(entry.category);
  const time = formatTimeRange(entry.startTime, entry.endTime);
  return (
    <div className={styles.single} style={{ borderLeftColor: st.color, background: st.background }} title={entry.note || undefined}>
      <Icon name={st.icon} color={st.color} className={styles.icon} />
      <span className={styles.entryText}>
        <span className={styles.categoryLabel}>{entry.category}</span>
        <span className={styles.place}>{entry.title}</span>
        {time && <span className={styles.time}>{time}</span>}
      </span>
    </div>
  );
};

export const ScheduleCell: React.FC<IScheduleCellProps> = ({ cell, joinsPrev, joinsNext }) => {
  const c = cell.content;
  let body: React.ReactNode;

  switch (c.kind) {
    case 'leave':
      body = (
        <div className={styles.leave} style={{ borderLeftColor: LEAVE_STYLE.color, background: LEAVE_STYLE.background }}>
          <Icon name={LEAVE_STYLE.icon} color={LEAVE_STYLE.color} className={styles.icon} />
          <span className={styles.place}>休暇</span>
        </div>
      );
      break;
    case 'holidayWork':
      body = (
        <div className={styles.single} style={{ borderLeftColor: HOLIDAY_WORK_STYLE.color, background: HOLIDAY_WORK_STYLE.background }}>
          <Icon name={HOLIDAY_WORK_STYLE.icon} color={HOLIDAY_WORK_STYLE.color} className={styles.icon} />
          <span className={styles.entryText}>
            <span className={styles.holidayWorkBadge}>休出</span>
            <span className={styles.place}>{c.holidayWork.workPlace}</span>
            {c.timeText && <span className={styles.time}>{c.timeText}</span>}
          </span>
        </div>
      );
      break;
    case 'single':
      body = c.entries.map((e) => <SingleEntry key={e.id} entry={e} />);
      break;
    case 'period': {
      const st = getCategoryStyle(c.entry.category);
      const time = formatTimeRange(c.entry.startTime, c.entry.endTime);
      const classNames = [styles.band];
      if (joinsPrev) {
        classNames.push(styles.joinPrev);
      }
      if (joinsNext) {
        classNames.push(styles.joinNext);
      }
      if (c.dimmed) {
        classNames.push(styles.dimmed);
      }
      const text = (
        <>
          <Icon name={st.icon} color={st.color} className={styles.icon} />
          <span className={styles.entryText}>
            <span className={styles.categoryLabel}>{c.entry.category}</span>
            <span className={styles.place}>{c.entry.title}</span>
            {time && <span className={styles.time}>{time}</span>}
          </span>
        </>
      );
      body = (
        <div
          className={classNames.join(' ')}
          style={{ background: st.background, borderColor: st.color }}
          title={c.entry.category + ':' + c.entry.title + '(' + formatPeriod(c.entry.startDate, c.entry.endDate) + ')'}
        >
          {joinsPrev ? (
            // 帯の続き:文字は見えなくする(高さをそろえるため場所は取る)。読み上げ用には残す
            <>
              <span className={styles.srOnly}>{c.entry.category + ' ' + c.entry.title}</span>
              <span className={styles.ghost} aria-hidden="true">
                {text}
              </span>
            </>
          ) : (
            text
          )}
        </div>
      );
      break;
    }
    default:
      body = undefined;
  }

  return (
    <>
      {body}
      {cell.badges.length > 0 && (
        <div className={styles.badges}>
          {cell.badges.map((b, i) => (
            <LeaveBadge key={i} badge={b} />
          ))}
        </div>
      )}
    </>
  );
};
