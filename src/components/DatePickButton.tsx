// カレンダーのボタン。押すとブラウザの「日付を選ぶ」画面が開く。
// ふだんは入力欄を見せず、場所を取らないようにする。
// 古いブラウザなどで開けないときは、入力欄をボタンの横に出す。

import * as React from 'react';
import { DateKey, isValidDateKey } from '../core';
import { Icon } from './Icon';
import styles from './ScheduleBoard.module.scss';

export interface IDatePickButtonProps {
  value: DateKey;
  onChange: (value: DateKey) => void;
}

export const DatePickButton: React.FC<IDatePickButtonProps> = ({ value, onChange }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [showInput, setShowInput] = React.useState(false);

  const open = (): void => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    try {
      // showPicker は新しいブラウザ(Edge・Chrome・Safari 16 以降)で使える
      (input as HTMLInputElement & { showPicker: () => void }).showPicker();
    } catch {
      setShowInput(true);
      input.focus();
    }
  };

  return (
    <span className={styles.datePick}>
      <button type="button" className={styles.iconButton} aria-label="日付を選ぶ" title="日付を選ぶ" onClick={open}>
        <Icon name="calendar" size={18} />
      </button>
      <input
        ref={inputRef}
        type="date"
        className={showInput ? styles.dateInput : styles.dateInputHidden}
        value={value}
        tabIndex={showInput ? 0 : -1}
        aria-label="日付"
        onChange={(e) => {
          if (isValidDateKey(e.target.value)) {
            onChange(e.target.value);
            setShowInput(false);
          }
        }}
      />
    </span>
  );
};
