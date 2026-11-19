// 「表示設定」ボタンと、押すと開く小さな画面(ver 0.8.0)
// 見え方の設定をまとめる:表示の大きさ(コンパクト/ふつう/大きめ)、自分を一番上に表示。
// 「絞り込み」の中にあると初めての人が気づきにくいため、ボタンを分けた(開発者の要望)

import * as React from 'react';
import { DENSITIES, DENSITY_LABELS, Density } from '../core';
import styles from './ScheduleBoard.module.scss';
import { ToolPopover } from './ToolPopover';

export interface IDisplayPopoverProps {
  density: Density;
  onDensityChange: (density: Density) => void;
  pinSelf: boolean;
  /** 自分の行があるか(ないときは「自分を一番上に」を出さない) */
  hasSelf: boolean;
  onPinSelfChange: (pin: boolean) => void;
}

export const DisplayPopover: React.FC<IDisplayPopoverProps> = (props) => (
  <ToolPopover icon="settings" label="表示設定" dialogLabel="表示設定">
    {(close) => (
      <>
        <div className={styles.field} role="radiogroup" aria-labelledby="sb-density-label">
          <span id="sb-density-label" className={styles.fieldLabel}>
            表示の大きさ
          </span>
          <div className={styles.segment + ' ' + styles.densitySegment}>
            {DENSITIES.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={props.density === d}
                className={styles.segmentButton}
                onClick={() => props.onDensityChange(d)}
              >
                {DENSITY_LABELS[d]}
              </button>
            ))}
          </div>
          <span className={styles.densityNote}>
            大きめ:文字と行を大きくします
            <br />
            コンパクト:一度にたくさんの人を表示します
          </span>
        </div>
        {props.hasSelf && (
          <label className={styles.checkbox}>
            <input type="checkbox" checked={props.pinSelf} onChange={(e) => props.onPinSelfChange(e.target.checked)} />
            自分を一番上に表示
          </label>
        )}
        <div className={styles.popoverFoot}>
          <button type="button" className={styles.primaryButton} onClick={close}>
            閉じる
          </button>
        </div>
      </>
    )}
  </ToolPopover>
);
