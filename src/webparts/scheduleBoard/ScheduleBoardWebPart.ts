// 行動予定表 WEBパーツ本体(組み立てだけ)
// 画面は src/components、データの読み書きは src/services、計算は src/core にある。

import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField,
  PropertyPaneToggle
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';

import { DEFAULT_CELL_RULE_OPTIONS, DEFAULT_CREW_DEPARTMENTS, DEFAULT_EXCLUDED_DEPARTMENTS, Density, parseDensity } from '../../core';
import { ScheduleBoard, IScheduleBoardProps, IViewPrefsStore } from '../../components/ScheduleBoard';
import { SharePointScheduleService } from '../../services/SharePointScheduleService';
import { DEFAULT_LIST_SETTINGS, ISpListSettings } from '../../services/spConfig';

/** WEBパーツの設定(ページの編集画面で変更できる) */
export interface IScheduleBoardWebPartProps extends Partial<ISpListSettings> {
  /** 上に小さく出すタイトル。空欄にすると出さない(一度も設定していなければ「行動予定表」) */
  title?: string;
  /** 作業員の行き先リストを反映する部署(「、」や改行で区切る。一度も設定していなければ「作業員」) */
  crewDepartments?: string;
  /** ヘルプの「困ったとき」に出す連絡先 */
  helpContact?: string;
  /** 部署の並び順(「、」や改行で区切る。空欄なら No. 順) */
  departmentOrder?: string;
  /** 予定表から外す部署(「、」や改行で区切って複数) */
  excludedDepartments?: string;
  /** 「自分を一番上に表示」を最初からオンにする */
  pinSelfByDefault?: boolean;
  /** 総務の「1日」休暇と本人の単発予定が重なったら、休暇を優先する */
  leaveBeforeSingle?: boolean;
}

/**
 * 表示の設定(表示の大きさ:コンパクト/ふつう/大きめ)を、このブラウザに覚えておく。
 * 使えないブラウザ(保存が禁止されている など)では、覚えずに「ふつう」で表示する。
 * ver 0.7 までは「行の高さ」(COMPACT_KEY)で覚えていたので、新しい値がなければそちらを読む
 */
const DENSITY_KEY = 'scheduleBoard.density';
const COMPACT_KEY = 'scheduleBoard.compact';
export const browserPrefsStore: IViewPrefsStore = {
  loadDensity: (): Density | undefined => {
    try {
      return parseDensity(window.localStorage.getItem(DENSITY_KEY), window.localStorage.getItem(COMPACT_KEY));
    } catch {
      return undefined;
    }
  },
  saveDensity: (density: Density): void => {
    try {
      window.localStorage.setItem(DENSITY_KEY, density);
    } catch {
      // 覚えられなくても表示は切り替わるので、何もしない
    }
  }
};

/** タイトルの初期値 */
export const DEFAULT_TITLE = '行動予定表';

/** 「、」「,」改行で区切った文字 → 一覧(空は除く) */
export function splitList(text: string | undefined): string[] {
  return (text || '')
    .split(/[,、\n]/)
    .map((s) => s.trim())
    .filter((s) => !!s);
}

export default class ScheduleBoardWebPart extends BaseClientSideWebPart<IScheduleBoardWebPartProps> {
  private _root: Root | undefined;

  public render(): void {
    const p = this.properties;
    const pick = (value: string | undefined, fallback: string): string => (value && value.trim()) || fallback;
    const lists: ISpListSettings = {
      entriesList: pick(p.entriesList, DEFAULT_LIST_SETTINGS.entriesList),
      workersList: pick(p.workersList, DEFAULT_LIST_SETTINGS.workersList),
      holidaysSiteUrl: (p.holidaysSiteUrl || '').trim(),
      holidaysList: pick(p.holidaysList, DEFAULT_LIST_SETTINGS.holidaysList),
      leavesList: pick(p.leavesList, DEFAULT_LIST_SETTINGS.leavesList),
      holidayWorksList: pick(p.holidayWorksList, DEFAULT_LIST_SETTINGS.holidayWorksList),
      adminGroup: pick(p.adminGroup, DEFAULT_LIST_SETTINGS.adminGroup),
      crewSiteUrl: (p.crewSiteUrl || '').trim(),
      crewList: (p.crewList || '').trim()
    };
    const user = this.context.pageContext.user;
    const service = new SharePointScheduleService({
      spHttpClient: this.context.spHttpClient,
      webUrl: this.context.pageContext.web.absoluteUrl,
      userEmail: user.email || user.loginName,
      lists
    });
    const excluded = splitList(p.excludedDepartments);

    const element: React.ReactElement<IScheduleBoardProps> = React.createElement(ScheduleBoard, {
      service,
      excludedDepartments: excluded.length > 0 ? excluded : DEFAULT_EXCLUDED_DEPARTMENTS,
      pinSelfByDefault: p.pinSelfByDefault !== false,
      cellRuleOptions: { leaveBeforeSingle: p.leaveBeforeSingle !== false },
      // manifest の version は "*"(= package.json の version)
      version: this.manifest.version,
      title: p.title === undefined ? DEFAULT_TITLE : p.title,
      helpContact: p.helpContact,
      departmentOrder: splitList(p.departmentOrder),
      prefsStore: browserPrefsStore,
      // 一度も設定していなければ「作業員」。空欄にしたら全員
      crewDepartments: p.crewDepartments === undefined ? DEFAULT_CREW_DEPARTMENTS : splitList(p.crewDepartments)
    });

    if (!this._root) {
      this._root = createRoot(this.domElement);
    }
    this._root.render(element);
  }

  protected onDispose(): void {
    if (this._root) {
      this._root.unmount();
    }
    this._root = undefined;
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  /** 設定の入力中に毎回読み直さないよう、「適用」ボタンで反映する */
  protected get disableReactivePropertyChanges(): boolean {
    return true;
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    const d = DEFAULT_LIST_SETTINGS;
    const listNote = 'リストの名前、または「Lists/〜」の形の URL(空欄なら初期値)';
    return {
      pages: [
        {
          header: { description: '行動予定表の設定です。変更したら「適用」を押してください。' },
          groups: [
            {
              groupName: '表示',
              groupFields: [
                PropertyPaneTextField('title', {
                  label: 'タイトル',
                  description: '予定表の上に小さく出します。空欄にすると出しません',
                  placeholder: DEFAULT_TITLE
                }),
                PropertyPaneTextField('helpContact', {
                  label: 'ヘルプの「困ったとき」の連絡先',
                  description: '使い方の画面の最後に出します。空欄なら出しません',
                  placeholder: '例:システム担当 ◯◯(内線 123)',
                  multiline: true,
                  rows: 2
                }),
                PropertyPaneTextField('departmentOrder', {
                  label: '部署の並び順',
                  description: '上から並べたい順に、1行に1部署ずつ書きます。書かなかった部署はうしろに並びます。空欄なら No. の順です',
                  placeholder: '例:\n役員\n企画室\n建築部',
                  multiline: true,
                  rows: 5
                }),
                PropertyPaneTextField('excludedDepartments', {
                  label: '予定表に出さない部署',
                  description: '「、」または改行で区切って複数指定できます(空欄なら「' + DEFAULT_EXCLUDED_DEPARTMENTS.join('、') + '」)',
                  placeholder: DEFAULT_EXCLUDED_DEPARTMENTS.join('、'),
                  multiline: true,
                  rows: 2
                }),
                PropertyPaneToggle('pinSelfByDefault', {
                  label: '「自分を一番上に表示」を最初からオンにする',
                  onText: 'オン',
                  offText: 'オフ',
                  checked: true
                }),
                PropertyPaneToggle('leaveBeforeSingle', {
                  label: '総務の「1日」休暇と本人の単発予定が重なったら、休暇を優先する',
                  onText: '休暇を優先',
                  offText: '単発予定を優先',
                  checked: DEFAULT_CELL_RULE_OPTIONS.leaveBeforeSingle
                })
              ]
            },
            {
              groupName: 'リスト',
              groupFields: [
                PropertyPaneTextField('entriesList', { label: '行動予定リスト', description: listNote, placeholder: d.entriesList }),
                PropertyPaneTextField('workersList', { label: '対象者リスト', description: listNote, placeholder: d.workersList }),
                PropertyPaneTextField('leavesList', { label: '休暇情報共有リスト', description: listNote, placeholder: d.leavesList }),
                PropertyPaneTextField('holidayWorksList', {
                  label: '休日出勤情報共有リスト',
                  description: listNote,
                  placeholder: d.holidayWorksList
                }),
                PropertyPaneTextField('holidaysSiteUrl', {
                  label: '会社休日リストのあるサイトの URL',
                  description: '別のサイトのリストを使うときだけ入力(例 https://〜.sharepoint.com/sites/〜)。空欄ならこのサイト',
                  placeholder: 'https://'
                }),
                PropertyPaneTextField('holidaysList', { label: '会社休日リスト', description: listNote, placeholder: d.holidaysList })
              ]
            },
            {
              groupName: '作業員の行き先(別サイトのリスト)',
              groupFields: [
                PropertyPaneTextField('crewSiteUrl', {
                  label: '作業員の行き先リストのあるサイトの URL',
                  description: '例 https://〜.sharepoint.com/sites/〜(空欄ならこのサイト)',
                  placeholder: 'https://'
                }),
                PropertyPaneTextField('crewList', {
                  label: '作業員の行き先リスト',
                  description: 'リストの名前、または「Lists/〜」の形の URL。空欄なら作業員の行き先は表示しません',
                  placeholder: 'Lists/List'
                }),
                PropertyPaneTextField('crewDepartments', {
                  label: '作業員の行き先を反映する部署',
                  description:
                    'この部署の人だけ、作業員の行き先リストの内容を出します(「、」や改行で区切って複数)。空欄にすると全員に反映します',
                  placeholder: DEFAULT_CREW_DEPARTMENTS.join('、')
                })
              ]
            },
            {
              groupName: '管理者',
              groupFields: [
                PropertyPaneTextField('adminGroup', {
                  label: '管理者の SharePoint グループ名',
                  description: 'このグループの人は、全員の予定を編集・代理登録できます',
                  placeholder: d.adminGroup
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
