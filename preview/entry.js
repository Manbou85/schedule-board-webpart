// プレビュー版の入口(preview/build-preview.mjs が1つのHTMLにまとめます)
// 本番と同じ画面の部品(ビルド済みの lib-commonjs)に、メモリ上のダミーデータをつないで表示します。

const React = require('react');
const { createRoot } = require('react-dom/client');
const { ScheduleBoard } = require('SB_LIB/components/ScheduleBoard');
const { MemoryScheduleService } = require('SB_LIB/services/MemoryScheduleService');
const { DEFAULT_EXCLUDED_DEPARTMENTS, todayKey } = require('SB_LIB/core');
const { createDummyData } = require('./dummyData');

const today = todayKey();
const service = new MemoryScheduleService(createDummyData(today));

createRoot(document.getElementById('pv-root')).render(
  React.createElement(ScheduleBoard, {
    service,
    excludedDepartments: DEFAULT_EXCLUDED_DEPARTMENTS,
    pinSelfByDefault: true,
    today
  })
);
