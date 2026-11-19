// 「絞り込み」ボタンと、押すと開く小さな画面(ポップアップ)
// ふだんは閉じておき、予定表の上の場所を取らないようにする。
// 中身:部署・区分の絞り込み(表示の設定は ver 0.8.0 から「表示設定」へ分けた)

import * as React from 'react';
import styles from './ScheduleBoard.module.scss';
import { ToolPopover } from './ToolPopover';

export interface IFilterPopoverProps {
  department: string;
  category: string;
  departments: string[];
  categories: string[];
  onDepartmentChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
}

/** 「すべて」を表す値 */
export const ALL = '';

export const FilterPopover: React.FC<IFilterPopoverProps> = (props) => {
  const activeCount = (props.department !== ALL ? 1 : 0) + (props.category !== ALL ? 1 : 0);
  return (
    <ToolPopover icon="filter" label="絞り込み" dialogLabel="絞り込み" activeCount={activeCount}>
      {(close) => (
        <>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>部署</span>
            <select className={styles.input} value={props.department} onChange={(e) => props.onDepartmentChange(e.target.value)}>
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
          <div className={styles.popoverFoot}>
            <button type="button" className={styles.primaryButton} onClick={close}>
              閉じる
            </button>
          </div>
        </>
      )}
    </ToolPopover>
  );
};
