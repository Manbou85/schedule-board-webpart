// ヘルプ(使い方の説明)の画面
// 操作してみないとわからないこと(休暇・休日出勤は総務の登録で自動で出る、長期の予定は1回登録すればよい など)を説明する。

import * as React from 'react';
import { getCategoryStyle, HOLIDAY_WORK_STYLE, ICategoryStyle, LEAVE_STYLE } from './categoryStyle';
import { Icon } from './Icon';
import styles from './ScheduleBoard.module.scss';

export interface IHelpDialogProps {
  /** 区分の一覧(アイコンと色の見かたに出す) */
  categories: string[];
  /** 困ったときの連絡先(WEBパーツの設定)。空なら出さない */
  contact?: string;
  onClose: () => void;
}

const LegendItem: React.FC<{ st: ICategoryStyle; label: string }> = ({ st, label }) => (
  <li style={{ borderLeftColor: st.color, background: st.background }}>
    <Icon name={st.icon} color={st.color} size={16} /> {label}
  </li>
);

export const HelpDialog: React.FC<IHelpDialogProps> = (props) => {
  const titleRef = React.useRef<HTMLHeadingElement>(null);

  // 開いたら見出しに移動し、閉じたら元の場所に戻す(キーボード・読み上げの人のため)
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

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      props.onClose();
    }
  };
  const contact = (props.contact || '').trim();

  return (
    <div
      className={styles.overlay}
      onKeyDown={onKeyDown}
      onClick={(e) => {
        // 画面の外側(暗いところ)を押しても閉じる
        if (e.target === e.currentTarget) {
          props.onClose();
        }
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="sb-help-title">
        <div className={styles.dialogHead}>
          <h2 id="sb-help-title" className={styles.dialogTitle} tabIndex={-1} ref={titleRef}>
            使い方
          </h2>
          <button type="button" className={styles.iconButton} aria-label="閉じる" title="閉じる" onClick={props.onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className={styles.dialogBody + ' ' + styles.helpBody}>
          <section>
            <h3 className={styles.helpHeading}>休暇・休日出勤は、自動で出ます</h3>
            <ul className={styles.helpList}>
              <li>
                総務への<strong>申請が登録されると、この予定表に自動で出ます</strong>。自分で登録する必要はありません。
              </li>
              <li>1日の休暇は「休暇」と出て、ほかの予定より優先されます。</li>
              <li>
                半休・遅刻・早退は、予定の下に「午前休」などの小さな札で出ます。札を押すと、時刻などの補足が見られます。
              </li>
              <li>休日出勤は「休出」の札と、出勤先・時刻で出ます。</li>
              <li>作業員の行き先は、作業員の行き先のリストに登録された現場が自動で出ます。</li>
              <li>この画面からは登録・変更できません。内容がちがうときは、総務に伝えてください。</li>
            </ul>
          </section>

          <section>
            <h3 className={styles.helpHeading}>長期の現場は、期間で1回登録するだけ</h3>
            <ul className={styles.helpList}>
              <li>
                何日も続く現場は「<strong>期間</strong>」で開始日と終了日を登録すれば、<strong>毎日の登録はいりません</strong>。
              </li>
              <li>
                その期間中の外出・出張・休みなどは「1日だけ」で足すと、その日はそちらが優先して出ます(長期の現場の登録は、そのままでかまいません)。
              </li>
              <li>予定を押すと、変更・削除ができます。</li>
            </ul>
          </section>

          <section>
            <h3 className={styles.helpHeading}>かんたん登録</h3>
            <ul className={styles.helpList}>
              <li>
                「<strong>ちょっと外出</strong>」ボタン(「予定を追加」の左):行き先と戻りの時間を選ぶだけで登録できます。行き先は入力しなくても登録できます。
              </li>
              <li>
                帰社したら「<strong>帰社しました</strong>」ボタンを押してください。予定が薄く「外出・帰社済み」になります。戻りの時刻を過ぎた今日の予定も、薄く表示されます。
              </li>
              <li>「予定を追加」の画面の「今日は在社」「今日は休み」も、1回押すだけで登録できます。</li>
            </ul>
          </section>

          <section>
            <h3 className={styles.helpHeading}>探す・しぼる</h3>
            <ul className={styles.helpList}>
              <li>「名前・現場名で探す」の欄に入力すると、その場でしぼり込みます。名字だけ・名前だけでも探せます。</li>
              <li>現場名を入れると「この現場に誰がいる?」がわかります。</li>
              <li>「絞り込み」から、部署や区分(例:今日「在社」の人)でしぼれます。</li>
              <li>
                「絞り込み」の「行の高さ」を「コンパクト」にすると、一度にたくさんの人を見られます(この設定は、使っているブラウザに記憶されます)。
              </li>
            </ul>
          </section>

          <section>
            <h3 className={styles.helpHeading}>予定表の見かた</h3>
            <ul className={styles.legend + ' ' + styles.helpLegend} aria-label="区分の見かた">
              {props.categories.map((c) => (
                <LegendItem key={c} st={getCategoryStyle(c)} label={c} />
              ))}
              <LegendItem st={LEAVE_STYLE} label="休暇" />
              <LegendItem st={HOLIDAY_WORK_STYLE} label="休日出勤" />
            </ul>
            <ul className={styles.helpList}>
              <li>今日の列は青い枠で囲まれます。土日・祝日・会社の休みの列は、色が付きます。</li>
              <li>長期の現場は、横につながった帯で出ます。休日の部分は薄く出ます。</li>
              <li>5分ごとに自動で新しくなります。右上の時刻を押すと、すぐ新しくなります。</li>
            </ul>
          </section>

          {contact && (
            <section>
              <h3 className={styles.helpHeading}>困ったとき</h3>
              <p className={styles.helpText}>{contact}</p>
            </section>
          )}

          <div className={styles.dialogFoot}>
            <span />
            <button type="button" className={styles.primaryButton} onClick={props.onClose}>
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
