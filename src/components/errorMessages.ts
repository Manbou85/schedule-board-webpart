// 保存・読み込みに失敗したときの、やさしい文言
// 画面の部品は SharePoint の部品に依存しないので、エラーの「状態コード」(status)だけを見る

const CONTACT = '何度やってもうまくいかないときは、管理者に連絡してください。';

function statusOf(error: unknown): number | undefined {
  const s = error && (error as { status?: unknown }).status;
  return typeof s === 'number' ? s : undefined;
}

/** 保存・変更・削除に失敗したとき */
export function saveErrorMessage(error: unknown, action: '保存' | '削除'): string {
  const status = statusOf(error);
  if (status === 401 || status === 403) {
    return 'この予定を' + action + 'する権限がありません。自分の予定かどうか確かめてください。' + CONTACT;
  }
  if (status === 404) {
    return '予定が見つかりませんでした。ほかの人が先に変更・削除した可能性があります。画面を開き直してください。';
  }
  return action + 'できませんでした。通信の状態を確かめて、もう一度お試しください。' + CONTACT;
}

/** 管理者向けの、くわしい内容(エラーの文言)。なければ空 */
export function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : '';
}
