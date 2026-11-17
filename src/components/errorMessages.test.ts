import { errorDetail, saveErrorMessage } from './errorMessages';

describe('失敗したときの文言', () => {
  it('権限がない(401・403)ときは、権限の文言', () => {
    expect(saveErrorMessage({ status: 403 }, '保存')).toContain('この予定を保存する権限がありません');
    expect(saveErrorMessage({ status: 401 }, '削除')).toContain('この予定を削除する権限がありません');
  });

  it('見つからない(404)ときは、開き直しを案内', () => {
    expect(saveErrorMessage({ status: 404 }, '削除')).toContain('画面を開き直してください');
  });

  it('それ以外は、通信の確認を案内', () => {
    expect(saveErrorMessage(new Error('x'), '保存')).toBe(
      '保存できませんでした。通信の状態を確かめて、もう一度お試しください。何度やってもうまくいかないときは、管理者に連絡してください。'
    );
  });

  it('管理者向けのくわしい内容', () => {
    expect(errorDetail(new Error('状態コード 400'))).toBe('状態コード 400');
    expect(errorDetail('x')).toBe('');
  });
});
