// 予定表の高さを、画面の残りの高さに合わせる計算(開発者の要望 ver 0.6.7)
// - ページ全体のスクロールと予定表の中のスクロールが二重にならないように、
//   予定表の下の端が、画面(ページのスクロールする入れ物)の下の端にぴったり来る高さを求める
// - WEBパーツがページの下のほうにあって残りが少ないとき・スマホ幅のときは使わない(今までどおり画面の75%)
// 画面の部品からは、測った数字だけを渡す(DOM に依存しない)

export interface IFitHeightInput {
  /** ページのスクロールする入れ物の、見えている高さ(px) */
  visibleHeight: number;
  /** 入れ物のいちばん上から、予定表の上の端までの長さ(px。スクロールした分も含める) */
  tableTop: number;
  /** 予定表より下にあるものの高さ(版の表示・WEBパーツの余白・ページの下の余白など。px) */
  belowTable: number;
  /** 画面の横幅(px) */
  viewportWidth: number;
}

/** これより狭い画面(スマホ)では合わせない */
export const FIT_MIN_WIDTH = 641;
/** 合わせたときの高さがこれより低いなら、合わせない(見られる人数が少なすぎるため) */
export const FIT_MIN_HEIGHT = 300;

/**
 * 予定表の高さ(px)。合わせないときは undefined(今までどおり画面の75%)。
 */
export function fitTableHeight(input: IFitHeightInput): number | undefined {
  if (input.viewportWidth < FIT_MIN_WIDTH) {
    return undefined;
  }
  const height = Math.floor(input.visibleHeight - input.tableTop - Math.max(0, input.belowTable));
  // 画面の半分も取れないときは、WEBパーツがページの下のほうにある → 合わせない
  if (height < FIT_MIN_HEIGHT || height < input.visibleHeight / 2) {
    return undefined;
  }
  return height;
}
