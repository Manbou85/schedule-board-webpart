// 「ちょっと外出」の小さな画面
// 行き先(空欄でもよい)を入れて、戻りの時間のボタンを1回押せば登録できる。

import * as React from 'react';
import { IReturnOption, RETURN_OPTIONS } from '../core';
import { getCategoryStyle } from './categoryStyle';
import { Icon } from './Icon';
import styles from './ScheduleBoard.module.scss';

export interface IQuickOutDialogProps {
  /** 最近の外出先(候補として出す) */
  recentPlaces: string[];
  /** 登録する。失敗したら、やさしい文言を返す(Promise を reject) */
  onSave: (place: string, option: IReturnOption) => Promise<void>;
  onClose: () => void;
}

export const QuickOutDialog: React.FC<IQuickOutDialogProps> = (props) => {
  const [place, setPlace] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [failure, setFailure] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const st = getCategoryStyle('外出');

  // 開いたら行き先の欄へ(スマホなどタッチの機器では、キーボードが急に出ないよう見出しへ)。閉じたら元の場所に戻す
  React.useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const touch = !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const target = touch ? titleRef.current : inputRef.current;
    if (target) {
      target.focus();
    }
    return () => {
      if (before && before.focus) {
        before.focus();
      }
    };
  }, []);

  const close = (): void => {
    if (!saving) {
      props.onClose();
    }
  };
  const save = (option: IReturnOption): void => {
    setSaving(true);
    setFailure('');
    props.onSave(place, option).then(
      () => setSaving(false),
      (message: unknown) => {
        setSaving(false);
        setFailure(typeof message === 'string' ? message : '登録できませんでした。もう一度お試しください。');
      }
    );
  };

  return (
    <div
      className={styles.overlay}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          close();
        }
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          close();
        }
      }}
    >
      <div className={styles.dialog + ' ' + styles.quickDialog} role="dialog" aria-modal="true" aria-labelledby="sb-quick-title">
        <div className={styles.dialogHead}>
          <h2 id="sb-quick-title" className={styles.dialogTitle} tabIndex={-1} ref={titleRef}>
            <span className={styles.quickTitle}>
              <Icon name={st.icon} color={st.color} size={20} />
              ちょっと外出
            </span>
          </h2>
          <button type="button" className={styles.iconButton} aria-label="閉じる" title="閉じる" onClick={close}>
            <Icon name="close" size={18} />
          </button>
        </div>
        <div className={styles.dialogBody}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>行き先(任意)</span>
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              value={place}
              maxLength={200}
              placeholder="例:銀行、市役所"
              onChange={(e) => setPlace(e.target.value)}
            />
          </label>
          {props.recentPlaces.length > 0 && (
            <div className={styles.suggestRow + ' ' + styles.quickSuggest}>
              {props.recentPlaces.map((p) => (
                <button key={p} type="button" className={styles.suggestChip} aria-pressed={place === p} onClick={() => setPlace(p)}>
                  {p}
                </button>
              ))}
            </div>
          )}
          <div className={styles.field} role="group" aria-labelledby="sb-quick-return">
            <span id="sb-quick-return" className={styles.fieldLabel}>
              戻り(押すと登録します)
            </span>
            <div className={styles.returnGrid}>
              {RETURN_OPTIONS.map((o) => (
                <button key={o.key} type="button" className={styles.returnButton} disabled={saving} onClick={() => save(o)}>
                  {o.minutes !== undefined ? o.label + '後' : o.label}
                </button>
              ))}
            </div>
          </div>
          {saving && <p className={styles.quickNote}>登録しています…</p>}
          {failure && (
            <p className={styles.formAlert} role="alert">
              {failure}
            </p>
          )}
          <div className={styles.dialogFoot}>
            <span />
            <button type="button" className={styles.toolButton} disabled={saving} onClick={close}>
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
