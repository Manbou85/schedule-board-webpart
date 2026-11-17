// プレビュー版(アーティファクトで見る1ファイルのHTML)を作るスクリプトです。
//
// 使い方:npm run build のあとで  npm run preview  → temp/schedule-preview.html(Git には入りません)
//
// 本番の部品(ビルド済みの lib-commonjs)とダミーデータを、CSS・JS ごと1つのHTMLにまとめます。
// 外部への読み込みはありません。

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(join(root, 'package.json'));
// webpack は SPFx のビルドの仕組みに入っているものを使う(CLI は入力待ちで止まるため、Node から呼ぶ)
const webpack = require('webpack');

const lib = join(root, 'lib-commonjs');
const cssFiles = ['components/ScheduleBoard.module.scss.css'].map((f) => join(lib, f));
if (!cssFiles.every((f) => existsSync(f))) {
  throw new Error('ビルド済みのファイルがありません。先に npm run build を実行してください。');
}

const outDir = join(root, 'temp');
mkdirSync(outDir, { recursive: true });
const bundleName = 'schedule-preview-bundle.js';

// lib-commonjs の CSS はクラス名がそのままなので、SCSS の読み込みは「クラス名そのまま」を返す部品に差し替える
const scssShim = join(outDir, 'scss-shim.js');
writeFileSync(scssShim, 'module.exports = { __esModule: true, default: new Proxy({}, { get: (_, k) => k }) };\n');

const stats = await new Promise((resolve, reject) => {
  webpack(
    {
      mode: 'production',
      devtool: false,
      entry: join(here, 'entry.js'),
      output: { path: outDir, filename: bundleName },
      resolve: { alias: { SB_LIB: lib }, modules: [join(root, 'node_modules')] },
      plugins: [new webpack.NormalModuleReplacementPlugin(/\.module\.scss$/, scssShim)],
      performance: { hints: false }
    },
    (err, result) => (err ? reject(err) : resolve(result))
  );
});
if (stats.hasErrors()) {
  throw new Error(stats.toString('errors-only'));
}

const bundlePath = join(outDir, bundleName);
// React などの著作権表示は別ファイルに分けられるので、ページの中に戻す
const licensePath = `${bundlePath}.LICENSE.txt`;
const license = existsSync(licensePath)
  ? `/*!\n${readFileSync(licensePath, 'utf8').replace(/\*\//g, '* /')}\n*/\n`
  : '';
const bundle = (license + readFileSync(bundlePath, 'utf8')).replace(/<\/script/gi, '<\\/script');
const css = cssFiles
  .map((f) => readFileSync(f, 'utf8').replace(/^@charset[^;]*;/, '').replace(/\/\*# sourceMappingURL=.*?\*\//g, ''))
  .join('\n');
for (const f of [bundlePath, licensePath, scssShim]) {
  rmSync(f, { force: true });
}

let commit = '';
try {
  commit = execSync('git rev-parse --short HEAD', { cwd: root }).toString().trim();
} catch {
  // Git が使えない環境では省略
}
const footer =
  '本番の画面部品(src/components)から自動で作成・作成日時 ' +
  new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }) +
  (commit ? `・コミット ${commit}` : '');

const template = readFileSync(join(here, 'template.html'), 'utf8');
for (const mark of ['/*__CSS__*/', '/*__FOOTER__*/', '/*__BUNDLE__*/']) {
  if (template.split(mark).length !== 2) {
    throw new Error(`template.html に ${mark} がちょうど1つ必要です`);
  }
}
const html = template
  .replace('/*__CSS__*/', () => css)
  .replace('/*__FOOTER__*/', () => footer)
  .replace('/*__BUNDLE__*/', () => bundle);

const outFile = join(outDir, 'schedule-preview.html');
writeFileSync(outFile, html);
console.log(`作成しました: ${outFile}(${Math.round(html.length / 1024)} KB)`);
