// 画面で使うアイコン(線で描いた単色の SVG)
// - 絵文字は OS によって絵柄・色がばらばらになるため、自前で描いたものにそろえる
// - 24×24 のマス目に、線の太さ 1.75 で描く。色は文字の色(currentColor)を受け継ぐ
// - 外部のフォントや画像は読み込まない

import * as React from 'react';

export type IconName =
  | 'helmet' // 現場
  | 'building' // 在社
  | 'car' // 外出
  | 'suitcase' // 出張
  | 'book' // 研修
  | 'moon' // 休み
  | 'pin' // その他
  | 'tag' // 対応表にない区分
  | 'sun' // 休暇
  | 'calendarCheck' // 休日出勤
  | 'info'
  | 'chevronLeft'
  | 'chevronRight'
  | 'chevronDown';

/** 線(path)と円(circle)の組み合わせで1つのアイコンを表す */
interface IShape {
  paths: string[];
  circles?: [number, number, number][];
}

const SHAPES: { [name in IconName]: IShape } = {
  helmet: {
    // 工事用ヘルメット:丸い頭の部分+前後のつば+まん中の2本の筋
    paths: ['M4.5 15.5V14a7.5 7.5 0 0 1 15 0v1.5', 'M2.5 15.5h19v2.5h-19z', 'M10 6.8V11M14 6.8V11']
  },
  building: {
    paths: ['M5 21V4h10v17', 'M15 9h4v12', 'M3 21h18', 'M8.5 8h.01M11.5 8h.01M8.5 12h.01M11.5 12h.01M8.5 16h.01M11.5 16h.01']
  },
  car: {
    paths: ['M5 16H3v-4.5L5 11l1.6-4.2A2 2 0 0 1 8.5 5.5h7a2 2 0 0 1 1.9 1.3L19 11l2 .5V16h-2', 'M9 16h6', 'M5 11h14'],
    circles: [
      [7, 16, 2],
      [17, 16, 2]
    ]
  },
  suitcase: {
    paths: ['M5 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', 'M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2', 'M3 12.5h18']
  },
  book: {
    paths: ['M12 6.5C10 5 7 4.5 3 5v13c4-.5 7 0 9 1.5 2-1.5 5-2 9-1.5V5c-4-.5-7 0-9 1.5z', 'M12 6.5V19']
  },
  moon: {
    paths: ['M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z']
  },
  pin: {
    paths: ['M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z'],
    circles: [[12, 10, 2]]
  },
  tag: {
    paths: ['M3.5 12.5V4a.5.5 0 0 1 .5-.5h8.5L21 12l-8.5 8.5z'],
    circles: [[8, 8, 1.5]]
  },
  sun: {
    paths: ['M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4'],
    circles: [[12, 12, 4]]
  },
  calendarCheck: {
    paths: ['M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z', 'M3 10h18', 'M8 3v4M16 3v4', 'M9 15.5l2 2 4-4']
  },
  info: {
    paths: ['M12 11v5', 'M12 8h.01'],
    circles: [[12, 12, 9]]
  },
  chevronLeft: { paths: ['M15 5l-7 7 7 7'] },
  chevronRight: { paths: ['M9 5l7 7-7 7'] },
  chevronDown: { paths: ['M5 9l7 7 7-7'] }
};

export interface IIconProps {
  name: IconName;
  /** 大きさ(px)。初期値 18 */
  size?: number;
  className?: string;
  /** 色。省略すると文字の色 */
  color?: string;
}

/** アイコン。飾りなので読み上げはしない(意味は横の文字で伝える) */
export const Icon: React.FC<IIconProps> = ({ name, size = 18, className, color }) => {
  const shape = SHAPES[name];
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      style={{ flex: 'none', display: 'block' }}
    >
      {shape.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {(shape.circles || []).map(([cx, cy, r], i) => (
        <circle key={'c' + i} cx={cx} cy={cy} r={r} />
      ))}
    </svg>
  );
};
