// 長期の予定(帯)を押したときの選択
// 「この日だけ外出」などを足したいのに、長期の予定全体を変えてしまわないよう、どちらにするかを選んでもらう。

import * as React from 'react';
import { DateKey, IScheduleEntry } from '../core';
import { getCategoryStyle } from './categoryStyle';
import { formatMonthDay, formatPeriod, formatWeekday } from './format';
import { Icon } from './Icon';
import { ModalPortal } from './ModalPortal';
import styles from './ScheduleBoard.module.scss';

export interface IPeriodChoiceDialogProps {
  entry: IScheduleEntry;
  /** 押した日 */
  date: DateKey;
  /** この日に別の予定を追加する */
  onAddForDay: () => void;
  /** 期間の予定そのものを変更する */
  onEditPeriod: () => void;
  onClose: () => void;
}

export const PeriodChoiceDialog: React.FC<IPeriodChoiceDialogProps> = (props) => {
  const { entry, date } = props;
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const st = getCategoryStyle(entry.category);
  const dayText = formatMonthDay(date) + '(' + formatWeekday(date) + ')';

  React.useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    if (titleRef.current) {
      titleRef.current.focus();
    }
    return () => {
      if (before && before.focus) {
        before.focus();
      }
    };
  }, []);

  return (
    <ModalPortal>
      <div
        className={styles.overlay}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            props.onClose();
          }
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            props.onClose();
          }
        }}
      >
        <div className={styles.dialog + ' ' + styles.quickDialog} role="dialog" aria-modal="true" aria-labelledby="sb-period-title">
          <div className={styles.dialogHead}>
            <h2 id="sb-period-title" className={styles.dialogTitle} tabIndex={-1} ref={titleRef}>
              どちらにしますか?
            </h2>
            <button type="button" className={styles.iconButton} aria-label="閉じる" title="閉じる" onClick={props.onClose}>
              <Icon name="close" size={18} />
            </button>
          </div>
          <div className={styles.dialogBody}>
            <div className={styles.periodSummary} style={{ borderLeftColor: st.color, background: st.background }}>
              <Icon name={st.icon} color={st.color} size={20} />
              <span className={styles.entryText}>
                <span className={styles.categoryLabel}>
                  {entry.category}
                  {entry.readOnly ? '(作業員の行き先リスト)' : '(期間の予定)'}
                </span>
                <span className={styles.place}>{entry.title}</span>
                <span className={styles.time}>{formatPeriod(entry.startDate, entry.endDate)}</span>
              </span>
            </div>
            <button type="button" className={styles.choiceButton} onClick={props.onAddForDay}>
              <Icon name="plus" size={20} />
              <span>
                <strong>{dayText}だけ、別の予定を追加</strong>
                <span className={styles.choiceNote}>外出・出張・休暇など。この日はこちらが優先して出ます</span>
              </span>
            </button>
            {entry.readOnly ? (
              <p className={styles.choiceNote}>
                この予定は「作業員の行き先」のリストから表示しています。現場名や期間の変更は、そのリストで行ってください。
              </p>
            ) : (
              <button type="button" className={styles.choiceButton} onClick={props.onEditPeriod}>
                <Icon name="calendar" size={20} />
                <span>
                  <strong>期間の予定を変更・削除</strong>
                  <span className={styles.choiceNote}>現場名・期間などを直します(すべての日に反映されます)</span>
                </span>
              </button>
            )}
            <div className={styles.dialogFoot}>
              <span />
              <button type="button" className={styles.toolButton} onClick={props.onClose}>
                キャンセル
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
