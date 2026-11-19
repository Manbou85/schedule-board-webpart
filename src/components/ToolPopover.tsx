// ツールバーのボタンと、押すと開く小さな画面(ポップアップ)の共通部品
// 「絞り込み」と「表示設定」で使う。外側を押す/Esc キーで閉じる。開いたら中の最初の入力欄へ移る。

import * as React from 'react';
import { Icon, IconName } from './Icon';
import styles from './ScheduleBoard.module.scss';

export interface IToolPopoverProps {
  icon: IconName;
  /** ボタンの文字(スマホでは見た目だけ省いてアイコンにする) */
  label: string;
  /** 開いた画面の名前(読み上げ用) */
  dialogLabel: string;
  /** 条件などを使っている数。1以上ならボタンに数字を出して色を変える */
  activeCount?: number;
  /** 中身。close を呼ぶと閉じる */
  children: (close: () => void) => React.ReactNode;
}

export const ToolPopover: React.FC<IToolPopoverProps> = (props) => {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const activeCount = props.activeCount || 0;

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
    // 開いたら中の最初の入力欄・ボタンへ(キーボードで続けて操作できるように)
    const first = panelRef.current && panelRef.current.querySelector<HTMLElement>('select, input, button');
    if (first) {
      first.focus();
    }
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = (): void => setOpen(false);

  return (
    <div className={styles.popoverWrap} ref={wrapRef}>
      <button
        type="button"
        ref={buttonRef}
        className={styles.toolButton + (activeCount > 0 ? ' ' + styles.toolButtonActive : '')}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={props.label}
        onClick={() => setOpen(!open)}
      >
        <Icon name={props.icon} size={18} />
        <span className={styles.toolButtonText}>{props.label}</span>
        {activeCount > 0 && <span className={styles.countBadge}>{activeCount}</span>}
      </button>
      {open && (
        <div className={styles.popover} role="dialog" aria-label={props.dialogLabel} ref={panelRef}>
          {props.children(close)}
        </div>
      )}
    </div>
  );
};
