// 「絞り込み」ボタンと、押すと開く小さな画面(ポップアップ)
// ふだんは閉じておき、予定表の上の場所を取らないようにする。
// 中身:部署・区分の絞り込み、「自分を一番上に表示」と「行の高さ」の設定

import * as React from 'react';
import { Icon } from './Icon';
import styles from './ScheduleBoard.module.scss';

export interface IFilterPopoverProps {
  department: string;
  category: string;
  departments: string[];
  categories: string[];
  pinSelf: boolean;
  /** 自分の行があるか(ないときは「自分を一番上に」を出さない) */
  hasSelf: boolean;
  onDepartmentChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onPinSelfChange: (pin: boolean) => void;
  /** 行の高さ(ふつう/コンパクト) */
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
}

/** 「すべて」を表す値 */
export const ALL = '';

export const FilterPopover: React.FC<IFilterPopoverProps> = (props) => {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const firstRef = React.useRef<HTMLSelectElement>(null);
  const activeCount = (props.department !== ALL ? 1 : 0) + (props.category !== ALL ? 1 : 0);

  // 開いている間:外側を押す/Esc キーで閉じる
  React.useEffect(() => {
    if (!open) {
      return undefined;
    }
    const onDown = (e: MouseEvent | TouchEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
        if (buttonRef.current) {
          buttonRef.current.focus();
        }
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    if (firstRef.current) {
      firstRef.current.focus();
    }
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={styles.popoverWrap} ref={wrapRef}>
      <button
        type="button"
        ref={buttonRef}
        className={styles.toolButton + (activeCount > 0 ? ' ' + styles.toolButtonActive : '')}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        <Icon name="filter" size={18} />
        <span className={styles.toolButtonText}>絞り込み</span>
        {activeCount > 0 && <span className={styles.countBadge}>{activeCount}</span>}
      </button>
      {open && (
        <div className={styles.popover} role="dialog" aria-label="絞り込みと表示の設定">
          <label className={styles.field}>
            <span className={styles.fieldLabel}>部署</span>
            <select
              ref={firstRef}
              className={styles.input}
              value={props.department}
              onChange={(e) => props.onDepartmentChange(e.target.value)}
            >
              <option value={ALL}>すべて</option>
              {props.departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>区分</span>
            <select className={styles.input} value={props.category} onChange={(e) => props.onCategoryChange(e.target.value)}>
              <option value={ALL}>すべて</option>
              {props.categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.popoverSection}>
            <span className={styles.fieldLabel}>表示の設定</span>
            {props.hasSelf && (
              <label className={styles.checkbox}>
                <input type="checkbox" checked={props.pinSelf} onChange={(e) => props.onPinSelfChange(e.target.checked)} />
                自分を一番上に表示
              </label>
            )}
            <div className={styles.densityRow} role="radiogroup" aria-label="行の高さ">
              <span className={styles.densityLabel}>行の高さ</span>
              <div className={styles.segment}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={!props.compact}
                  className={styles.segmentButton}
                  onClick={() => props.onCompactChange(false)}
                >
                  ふつう
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={props.compact}
                  className={styles.segmentButton}
                  onClick={() => props.onCompactChange(true)}
                >
                  コンパクト
                </button>
              </div>
            </div>
          </div>
          <div className={styles.popoverFoot}>
            <button type="button" className={styles.primaryButton} onClick={() => setOpen(false)}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
