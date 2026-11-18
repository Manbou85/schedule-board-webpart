// 登録画面などの「上に重ねる画面」を、ページのいちばん外側(body の直下)に出すための部品
//
// SharePoint のページでは、WEBパーツの中に重ねる画面を置くと、ページの上の部分(サイトの見出し・検索欄)の
// 下にもぐって、画面の上が見切れることがある(開発者の実機確認 2026-11-18)。
// いちばん外側に出せば、SharePoint の見出しより上に表示できる。

import * as React from 'react';
import { createPortal } from 'react-dom';
import styles from './ScheduleBoard.module.scss';

export const ModalPortal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  if (typeof document === 'undefined') {
    return <>{children}</>;
  }
  // 予定表と同じ文字の大きさ・色にするため、予定表のいちばん外側と同じ印を付けて包む
  return createPortal(<div className={styles.scheduleBoard + ' ' + styles.portalRoot}>{children}</div>, document.body);
};
