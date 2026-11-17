// 検索・絞り込みの入力欄(名前・現場名・部署・区分)
// 条件は画面の中だけで覚える(開き直したらリセット)。

import * as React from 'react';
import { IFilterCriteria } from '../core';
import { Icon } from './Icon';
import styles from './ScheduleBoard.module.scss';

export interface IFilterBarProps {
  criteria: IFilterCriteria;
  departments: string[];
  categories: string[];
  pinSelf: boolean;
  /** 自分の行があるか(ないときは「自分を一番上に」を出さない) */
  hasSelf: boolean;
  shownCount: number;
  totalCount: number;
  onChange: (criteria: IFilterCriteria) => void;
  onPinSelfChange: (pin: boolean) => void;
}

const ALL = '';

export const FilterBar: React.FC<IFilterBarProps> = (props) => {
  const { criteria, departments, categories, onChange } = props;
  const set = (patch: Partial<IFilterCriteria>): void => onChange({ ...criteria, ...patch });
  const department = criteria.departments && criteria.departments[0] ? criteria.departments[0] : ALL;
  const category = criteria.categories && criteria.categories[0] ? criteria.categories[0] : ALL;
  const filtered =
    !!criteria.name || !!criteria.place || department !== ALL || category !== ALL;
  // スマホ幅では、名前以外の条件はボタンで開く(画面が入力欄だけで埋まらないように)
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreActive = !!criteria.place || department !== ALL || category !== ALL;

  return (
    <div className={styles.filterBar + (moreOpen ? ' ' + styles.moreOpen : '')} role="search">
      <label className={styles.field}>
        <span className={styles.fieldLabel}>名前で探す</span>
        <input
          type="search"
          className={styles.input}
          value={criteria.name || ''}
          placeholder="例:山田"
          onChange={(e) => set({ name: e.target.value })}
        />
      </label>
      <button
        type="button"
        className={styles.linkButton + ' ' + styles.moreToggle}
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen(!moreOpen)}
      >
        <Icon name="chevronDown" size={16} className={moreOpen ? styles.flipped : undefined} />
        {moreOpen ? 'くわしい条件を閉じる' : 'くわしい条件(現場名・部署・区分)' + (moreActive ? ' ※指定あり' : '')}
      </button>
      <label className={styles.field + ' ' + styles.moreField}>
        <span className={styles.fieldLabel}>現場名・行き先で探す</span>
        <input
          type="search"
          className={styles.input}
          value={criteria.place || ''}
          placeholder="例:〇〇ビル"
          onChange={(e) => set({ place: e.target.value })}
        />
      </label>
      <label className={styles.field + ' ' + styles.moreField}>
        <span className={styles.fieldLabel}>部署</span>
        <select
          className={styles.input}
          value={department}
          onChange={(e) => set({ departments: e.target.value ? [e.target.value] : [] })}
        >
          <option value={ALL}>すべて</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field + ' ' + styles.moreField}>
        <span className={styles.fieldLabel}>区分</span>
        <select
          className={styles.input}
          value={category}
          onChange={(e) => set({ categories: e.target.value ? [e.target.value] : [] })}
        >
          <option value={ALL}>すべて</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.filterFoot}>
        {props.hasSelf && (
          <label className={styles.checkbox}>
            <input type="checkbox" checked={props.pinSelf} onChange={(e) => props.onPinSelfChange(e.target.checked)} />
            自分を一番上に表示
          </label>
        )}
        <span className={styles.count} aria-live="polite">
          {filtered ? props.totalCount + '人中 ' + props.shownCount + '人を表示' : props.totalCount + '人'}
        </span>
        {filtered && (
          <button type="button" className={styles.linkButton} onClick={() => onChange({})}>
            条件をクリア
          </button>
        )}
      </div>
    </div>
  );
};
