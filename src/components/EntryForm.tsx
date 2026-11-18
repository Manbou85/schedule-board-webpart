// 予定の登録・編集フォーム(画面の上に重ねて出す小窓。スマホでは画面いっぱい)
// 項目は最小限:種別・区分・行き先・日付・時刻(任意)・メモ(任意)
// 入力のチェックと保存する形への整え方は core の entryForm.ts

import * as React from 'react';
import {
  DateKey,
  DEFAULT_QUICK_ACTIONS,
  draftToEntry,
  hasErrors,
  IEntryDraft,
  IEntryErrors,
  IQuickAction,
  IScheduleEntry,
  isValidDateKey,
  IWorker,
  matchesText,
  normalizeForSearch,
  quickDraft,
  validateDraft
} from '../core';
import { getCategoryStyle } from './categoryStyle';
import { saveErrorMessage } from './errorMessages';
import { formatMonthDay, formatWeekday } from './format';
import { Icon } from './Icon';
import styles from './ScheduleBoard.module.scss';

export interface IEntryFormProps {
  /** 最初の入力内容(新しく登録するときは newDraft、編集のときは draftFromEntry) */
  initial: IEntryDraft;
  today: DateKey;
  categories: string[];
  /** 担当者の選択肢(管理者のときだけ使う) */
  workers: IWorker[];
  isAdmin: boolean;
  selfId?: number;
  quickActions?: IQuickAction[];
  /** その人が過去に入力した行き先(新しい順) */
  loadPlaces: (workerId: number) => Promise<string[]>;
  onSave: (entry: Omit<IScheduleEntry, 'id'> & { id?: number }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  /** 閉じる。保存・削除したときは、知らせる文言を渡す */
  onClose: (message?: string) => void;
}


/** 'M/D(曜)'。今日なら「今日」 */
function dayText(date: DateKey, today: DateKey): string {
  return date === today ? '今日' : formatMonthDay(date) + '(' + formatWeekday(date) + ')';
}

export const EntryForm: React.FC<IEntryFormProps> = (props) => {
  const { initial, today, categories, workers, isAdmin, selfId, loadPlaces } = props;
  const isEdit = initial.id !== undefined;
  const [draft, setDraft] = React.useState<IEntryDraft>(initial);
  const [showErrors, setShowErrors] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [failure, setFailure] = React.useState('');
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [places, setPlaces] = React.useState<string[]>([]);
  const titleRef = React.useRef<HTMLHeadingElement>(null);

  const errors: IEntryErrors = validateDraft(draft);
  const shown: IEntryErrors = showErrors ? errors : {};
  const set = (patch: Partial<IEntryDraft>): void => setDraft({ ...draft, ...patch });

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

  // 担当者が決まったら、その人の過去の行き先を読む(候補に出す)
  React.useEffect(() => {
    let alive = true;
    setPlaces([]);
    if (draft.workerId !== undefined) {
      loadPlaces(draft.workerId).then(
        (list) => alive && setPlaces(list),
        () => undefined // 候補が読めなくても入力はできるので、何もしない
      );
    }
    return () => {
      alive = false;
    };
  }, [draft.workerId, loadPlaces]);

  const close = (message?: string): void => {
    if (!saving) {
      props.onClose(message);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    }
  };

  const save = (d: IEntryDraft): void => {
    const errs = validateDraft(d);
    if (hasErrors(errs)) {
      setShowErrors(true);
      return;
    }
    setSaving(true);
    setFailure('');
    props.onSave(draftToEntry(d)).then(
      () => {
        setSaving(false);
        props.onClose(isEdit ? '予定を変更しました' : '予定を登録しました');
      },
      (error: unknown) => {
        setSaving(false);
        setFailure(saveErrorMessage(error, '保存'));
      }
    );
  };

  const remove = (): void => {
    if (draft.id === undefined) {
      return;
    }
    setSaving(true);
    setFailure('');
    props.onDelete(draft.id).then(
      () => {
        setSaving(false);
        props.onClose('予定を削除しました');
      },
      (error: unknown) => {
        setSaving(false);
        setConfirmDelete(false);
        setFailure(saveErrorMessage(error, '削除'));
      }
    );
  };

  const setStartDate = (v: string): void => {
    // 期間で、終了日が開始日より前になったら、終了日を開始日にそろえる
    set({ startDate: v, endDate: isValidDateKey(v) && draft.endDate < v ? v : draft.endDate });
  };

  const setEntryType = (t: IEntryDraft['entryType']): void => {
    set({ entryType: t, endDate: draft.endDate < draft.startDate ? draft.startDate : draft.endDate });
  };

  const worker = workers.filter((w) => w.id === draft.workerId)[0];
  // 「今日で終了にする」:登録済みの期間の予定で、今日が期間の途中(終了日より前)のとき
  const canEndToday =
    isEdit && draft.entryType === 'period' && isValidDateKey(draft.startDate) && draft.startDate <= today && today < draft.endDate;
  const quickActions = (props.quickActions || DEFAULT_QUICK_ACTIONS).filter((a) => categories.indexOf(a.category) >= 0);
  const suggestions = places
    .filter((p) => normalizeForSearch(p) !== normalizeForSearch(draft.title) && matchesText(p, draft.title))
    .slice(0, 6);

  return (
    <div className={styles.overlay} onKeyDown={onKeyDown}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="sb-entry-title">
        <div className={styles.dialogHead}>
          <h2 id="sb-entry-title" className={styles.dialogTitle} tabIndex={-1} ref={titleRef}>
            {isEdit ? '予定を変更' : '予定を追加'}
          </h2>
          <button type="button" className={styles.iconButton} aria-label="閉じる" title="閉じる" onClick={() => close()}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <form
          className={styles.dialogBody}
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            save(draft);
          }}
        >
          {/* 担当者:管理者は選べる(代理登録)。一般の人は自分だけ */}
          {isAdmin ? (
            <label className={styles.field}>
              <span className={styles.fieldLabel}>担当者</span>
              <select
                className={styles.input}
                value={draft.workerId === undefined ? '' : String(draft.workerId)}
                disabled={isEdit}
                onChange={(e) => set({ workerId: e.target.value ? Number(e.target.value) : undefined })}
              >
                <option value="">選んでください</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                    {w.id === selfId ? '(あなた)' : !w.account ? '(PCなし)' : ''}
                  </option>
                ))}
              </select>
              {shown.workerId && <span className={styles.fieldError}>{shown.workerId}</span>}
            </label>
          ) : (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>担当者</span>
              <span className={styles.staticValue}>
                {worker ? worker.name : ''}
                {draft.workerId === selfId ? '(あなた)' : ''}
              </span>
            </div>
          )}

          {/* ワンタップ登録(新しく登録するときだけ) */}
          {!isEdit && quickActions.length > 0 && draft.workerId !== undefined && (
            <div className={styles.field}>
              <span className={styles.fieldLabel}>ワンタップで登録</span>
              <div className={styles.quickRow}>
                {quickActions.map((a) => {
                  const st = getCategoryStyle(a.category);
                  return (
                    <button
                      key={a.category}
                      type="button"
                      className={styles.quickButton}
                      disabled={saving || !isValidDateKey(draft.startDate)}
                      onClick={() => save(quickDraft(draft.workerId as number, draft.startDate, a))}
                    >
                      <Icon name={st.icon} color={st.color} size={18} />
                      {dayText(draft.startDate, today)}は{a.category}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className={styles.field} role="radiogroup" aria-label="登録の種類">
            <span className={styles.fieldLabel}>登録の種類</span>
            <div className={styles.segment}>
              <button
                type="button"
                role="radio"
                aria-checked={draft.entryType === 'single'}
                className={styles.segmentButton}
                onClick={() => setEntryType('single')}
              >
                1日だけ
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={draft.entryType === 'period'}
                className={styles.segmentButton}
                onClick={() => setEntryType('period')}
              >
                期間(長期の現場など)
              </button>
            </div>
          </div>

          <div className={styles.field} role="radiogroup" aria-label="区分">
            <span className={styles.fieldLabel}>区分</span>
            <div className={styles.categoryGrid}>
              {categories.map((c) => {
                const st = getCategoryStyle(c);
                const checked = draft.category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    className={styles.categoryButton}
                    style={checked ? { borderColor: st.color, background: st.background } : undefined}
                    onClick={() => set({ category: c })}
                  >
                    <Icon name={st.icon} color={st.color} size={18} />
                    {c}
                  </button>
                );
              })}
            </div>
            {shown.category && <span className={styles.fieldError}>{shown.category}</span>}
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>行き先・現場名</span>
            <input
              type="text"
              className={styles.input}
              value={draft.title}
              maxLength={255}
              placeholder="例:駅前ビル新築工事"
              aria-invalid={!!shown.title}
              onChange={(e) => set({ title: e.target.value })}
            />
            {shown.title && <span className={styles.fieldError}>{shown.title}</span>}
          </label>
          {suggestions.length > 0 && (
            <div className={styles.suggestRow}>
              <span className={styles.fieldLabel}>最近の行き先:</span>
              {suggestions.map((p) => (
                <button key={p} type="button" className={styles.suggestChip} onClick={() => set({ title: p })}>
                  {p}
                </button>
              ))}
            </div>
          )}

          <div className={styles.fieldRow}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>{draft.entryType === 'single' ? '日付' : '開始日'}</span>
              <input
                type="date"
                className={styles.input}
                value={draft.startDate}
                aria-invalid={!!shown.startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
              {shown.startDate && <span className={styles.fieldError}>{shown.startDate}</span>}
            </label>
            {draft.entryType === 'period' && (
              <label className={styles.field}>
                <span className={styles.fieldLabel}>終了日</span>
                <input
                  type="date"
                  className={styles.input}
                  value={draft.endDate}
                  min={draft.startDate}
                  aria-invalid={!!shown.endDate}
                  onChange={(e) => set({ endDate: e.target.value })}
                />
                {shown.endDate && <span className={styles.fieldError}>{shown.endDate}</span>}
                {canEndToday && (
                  <button type="button" className={styles.linkButton + ' ' + styles.endTodayButton} onClick={() => set({ endDate: today })}>
                    今日で終了にする
                  </button>
                )}
                {isEdit && draft.entryType === 'period' && draft.endDate === today && initial.endDate !== today && (
                  <span className={styles.fieldHint}>終了日を今日にしました。「保存」を押すと確定します。</span>
                )}
              </label>
            )}
          </div>

          <div className={styles.field}>
            <span className={styles.fieldLabel}>時刻(任意)</span>
            <div className={styles.timeRow}>
              <input
                type="time"
                className={styles.input}
                aria-label="開始時刻"
                value={draft.startTime}
                onChange={(e) => set({ startTime: e.target.value })}
              />
              <span aria-hidden="true">〜</span>
              <input
                type="time"
                className={styles.input}
                aria-label="終了・戻り時刻"
                value={draft.endTime}
                onChange={(e) => set({ endTime: e.target.value })}
              />
            </div>
            {shown.time && <span className={styles.fieldError}>{shown.time}</span>}
          </div>

          <label className={styles.field}>
            <span className={styles.fieldLabel}>メモ(任意)</span>
            <textarea className={styles.input} rows={2} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
          </label>

          {showErrors && hasErrors(errors) && (
            <p className={styles.formAlert} role="alert">
              入力していない項目があります。赤い文字のところを確かめてください。
            </p>
          )}
          {failure && (
            <p className={styles.formAlert} role="alert">
              {failure}
            </p>
          )}

          <div className={styles.dialogFoot}>
            {confirmDelete ? (
              <div className={styles.confirmBox} role="alertdialog" aria-label="削除の確認">
                <span>この予定を削除しますか?元には戻せません。</span>
                <div className={styles.footButtons}>
                  <button type="button" className={styles.toolButton} disabled={saving} onClick={() => setConfirmDelete(false)}>
                    やめる
                  </button>
                  <button type="button" className={styles.dangerButton} disabled={saving} onClick={remove}>
                    {saving ? '削除しています…' : '削除する'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                {isEdit ? (
                  <button type="button" className={styles.dangerLink} disabled={saving} onClick={() => setConfirmDelete(true)}>
                    削除
                  </button>
                ) : (
                  <span />
                )}
                <div className={styles.footButtons}>
                  <button type="button" className={styles.toolButton} disabled={saving} onClick={() => close()}>
                    キャンセル
                  </button>
                  <button type="submit" className={styles.primaryButton} disabled={saving}>
                    {saving ? '保存しています…' : '保存'}
                  </button>
                </div>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
