// プレビュー版の入口(preview/build-preview.mjs が1つのHTMLにまとめます)
// 本番と同じ画面の部品(ビルド済みの lib-commonjs)に、メモリ上のダミーデータをつないで表示します。
// 上の黄色い帯の切り替え(管理者として見る・保存を失敗させる)は、プレビューだけのものです。

const React = require('react');
const { createRoot } = require('react-dom/client');
const { ScheduleBoard } = require('SB_LIB/components/ScheduleBoard');
const { MemoryScheduleService } = require('SB_LIB/services/MemoryScheduleService');
const { DEFAULT_EXCLUDED_DEPARTMENTS, todayKey } = require('SB_LIB/core');
const { createDummyData } = require('./dummyData');
const { version } = require('../package.json');

const h = React.createElement;
const today = todayKey();
const data = createDummyData(today);
const service = new MemoryScheduleService(data);
// SharePoint から読むときの待ち時間をまねる(週の切り替えで表がどう見えるかを確かめるため)
service.latencyMs = 400;
const selfAccount = data.currentUser.account;

function PreviewControls() {
  const [admin, setAdmin] = React.useState(false);
  const [fail, setFail] = React.useState(false);
  const toggleAdmin = (on) => {
    service.setCurrentUser({ account: selfAccount, isAdmin: on });
    setAdmin(on);
  };
  const toggleFail = (on) => {
    service.failSaves = on;
    setFail(on);
  };
  return h(
    React.Fragment,
    null,
    h(
      'div',
      { className: 'pv-controls' },
      h('span', { className: 'pv-controls-title' }, 'プレビューの切り替え:'),
      h('label', null, h('input', { type: 'checkbox', checked: admin, onChange: (e) => toggleAdmin(e.target.checked) }), ' 管理者として見る(全員の予定を編集・代理登録)'),
      h('label', null, h('input', { type: 'checkbox', checked: fail, onChange: (e) => toggleFail(e.target.checked) }), ' 保存を失敗させる(エラー表示の確認用)')
    ),
    h(
      'div',
      { className: 'pv-card' },
      // 管理者の切り替えでは、部品を作り直してユーザー情報を読み直す
      h(ScheduleBoard, {
        key: admin ? 'admin' : 'user',
        service,
        excludedDepartments: DEFAULT_EXCLUDED_DEPARTMENTS,
        pinSelfByDefault: true,
        today,
        version,
        title: '行動予定表',
        // WEBパーツの設定「部署の中で先頭に並べる人」の確かめ用:役員の3人目(No. は最後)を役員の一番上に出す
        frontWorkerNames: ['上野 達也'],
        helpContact: '例:システム担当 ◯◯(内線 123)\nプレビューでは、WEBパーツの設定に書いた文字がここに出ます。'
      })
    )
  );
}

createRoot(document.getElementById('pv-root')).render(h(PreviewControls));
