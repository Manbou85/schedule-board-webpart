// 1マス(1人×1日)の中身
// どれを表示するかは core の resolveCell で決まっているので、ここでは見た目だけを作る。

import * as React from 'react';
import { DateKey, formatTimeRange, ICell, ILeaveBadge, IScheduleEntry, LEAVE_CATEGORY } from '../core';
import { getCategoryStyle, HOLIDAY_WORK_STYLE, LEAVE_STYLE } from './categoryStyle';
import { finishedLabel, formatPeriod } from './format';
import { Icon } from './Icon';
import styles from './ScheduleBoard.module.scss';

export interface IScheduleCellProps {
  cell: ICell;
  /** 前の日も同じ長期の予定(帯が左につながる) */
  joinsPrev: boolean;
  /** 次の日も同じ長期の予定(帯が右につながる) */
  joinsNext: boolean;
  /** 今日のマスか(帯の続きでも、今日の列には行き先を出す) */
  isToday?: boolean;
  /** 編集できる人の行のとき:予定を押したら編集フォームを開く(長期の予定は、押した日も渡す) */
  onEdit?: (entry: IScheduleEntry, date?: DateKey) => void;
}

interface IEntryBoxProps {
  entry: IScheduleEntry;
  onEdit?: (entry: IScheduleEntry) => void;
  className: string;
  style: React.CSSProperties;
  title?: string;
  children: React.ReactNode;
}

/** 予定1件の箱。編集できるときはボタンにする(押すと編集フォーム) */
export const EntryBox: React.FC<IEntryBoxProps> = ({ entry, onEdit, className, style, title, children }) =>
  onEdit ? (
    <button
      type="button"
      className={className + ' ' + styles.entryButton}
      style={style}
      title={(title ? title + '\n' : '') + '押すと変更・削除できます'}
      onClick={(e) => {
        e.stopPropagation(); // マスを押したとき(新しく追加)と区別する
        onEdit(entry);
      }}
    >
      {children}
    </button>
  ) : (
    <div className={className} style={style} title={title}>
      {children}
    </div>
  );

/**
 * 午前休などのバッジ。
 * 週間表示:補足(時刻など)はマウスを乗せる/タップすると出る
 * 日表示(showRemarks):補足を常に出す
 */
export const LeaveBadge: React.FC<{ badge: ILeaveBadge; showRemarks?: boolean }> = ({ badge, showRemarks }) => {
  const [open, setOpen] = React.useState(false);
  if (!badge.remarks) {
    return <span className={styles.leaveBadge}>{badge.label}</span>;
  }
  if (showRemarks) {
    return (
      <span className={styles.badgeInline}>
        <span className={styles.leaveBadge}>{badge.label}</span>
        <span className={styles.badgeRemarksInline}>{badge.remarks}</span>
      </span>
    );
  }
  return (
    <span className={styles.leaveBadgeWrap}>
      <button
        type="button"
        className={styles.leaveBadge}
        title={badge.remarks}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
      >
        {badge.label}
        <Icon name="info" size={13} className={styles.badgeInfo} />
      </button>
      {open && <span className={styles.badgeRemarks}>{badge.remarks}</span>}
    </span>
  );
};

/**
 * 区分名を出さなくてよい予定か。区分も行き先も「休暇」(ワンタップ登録など)のときは、
 * 総務の休暇と同じく「休暇」の1行だけにする(ver 0.7.0。見た目を総務の休暇とそろえる。開発者回答)
 */
function hideCategoryLabel(entry: IScheduleEntry): boolean {
  return entry.category === LEAVE_CATEGORY && entry.title === entry.category;
}

const SingleEntry: React.FC<{ entry: IScheduleEntry; onEdit?: (entry: IScheduleEntry) => void; finished?: boolean }> = ({
  entry,
  onEdit,
  finished
}) => {
  const st = getCategoryStyle(entry.category);
  const time = formatTimeRange(entry.startTime, entry.endTime);
  return (
    <EntryBox
      entry={entry}
      onEdit={onEdit}
      className={styles.single + (finished ? ' ' + styles.finished : '')}
      style={{ borderLeftColor: st.color, background: st.background }}
      title={entry.note || undefined}
    >
      <Icon name={st.icon} color={st.color} className={styles.icon} />
      <span className={styles.entryText}>
        {(finished || !hideCategoryLabel(entry)) && (
          <span className={styles.categoryLabel}>{finished ? finishedLabel(entry.category) : entry.category}</span>
        )}
        <span className={styles.place}>{entry.title}</span>
        {time && <span className={styles.time}>{time}</span>}
      </span>
    </EntryBox>
  );
};

export const ScheduleCell: React.FC<IScheduleCellProps> = ({ cell, joinsPrev, joinsNext, isToday, onEdit }) => {
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
      body = c.entries.map((e) => (
        <SingleEntry key={e.id} entry={e} onEdit={onEdit} finished={c.finishedIds.indexOf(e.id) >= 0} />
      ));
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
            {!hideCategoryLabel(c.entry) && <span className={styles.categoryLabel}>{c.entry.category}</span>}
            <span className={styles.place}>{c.entry.title}</span>
            {time && <span className={styles.time}>{time}</span>}
          </span>
        </>
      );
      body = (
        <>
        <EntryBox
          entry={c.entry}
          onEdit={onEdit ? (e) => onEdit(e, cell.date) : undefined}
          className={classNames.join(' ')}
          style={{ background: st.background, borderColor: st.color }}
          title={c.entry.category + ':' + c.entry.title + '(' + formatPeriod(c.entry.startDate, c.entry.endDate) + ')'}
        >
          {joinsPrev ? (
            // 帯の続き:文字は見えなくする(高さをそろえるため場所は取る)。読み上げ用には残す。
            // ただし今日の列では、アイコンと行き先だけ見せる(区分名は省いた短い形で「続き」とわかるように。ver 0.8.1)。
            // 今日の列を上から見るだけで、全員の今日の行き先がわかるようにするため(開発者の要望)
            <>
              <span className={styles.srOnly}>{c.entry.category + ' ' + c.entry.title}</span>
              <span className={styles.ghost + (isToday ? ' ' + styles.ghostToday : '')} aria-hidden="true">
                {text}
              </span>
            </>
          ) : (
            text
          )}
        </EntryBox>
        {c.finished.map((e) => (
          <SingleEntry key={e.id} entry={e} onEdit={onEdit} finished={true} />
        ))}
        </>
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
