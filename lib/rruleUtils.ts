/**
 * RRULE (RFC 5545) ユーティリティ
 *
 * RRULE形式と日本語表記の相互変換を行う
 * 参考: https://tex2e.github.io/rfc-translater/html/rfc5545.html#3-3-10--Recurrence-Rule
 */

// 曜日の定義
const WEEKDAY_MAP: Record<string, string> = {
  MO: '月曜日',
  TU: '火曜日',
  WE: '水曜日',
  TH: '木曜日',
  FR: '金曜日',
  SA: '土曜日',
  SU: '日曜日',
};

const WEEKDAY_REVERSE_MAP: Record<string, string> = {
  '月': 'MO',
  '火': 'TU',
  '水': 'WE',
  '木': 'TH',
  '金': 'FR',
  '土': 'SA',
  '日': 'SU',
};

// 頻度の定義
const FREQ_MAP: Record<string, string> = {
  DAILY: '毎日',
  WEEKLY: '毎週',
  MONTHLY: '毎月',
  YEARLY: '毎年',
};

// 序数の定義
const ORDINAL_MAP: Record<number, string> = {
  1: '第1',
  2: '第2',
  3: '第3',
  4: '第4',
  5: '第5',
  '-1': '最終',
};

export interface RecurrenceRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval?: number;
  count?: number;
  until?: string; // YYYYMMDD or YYYYMMDDTHHMMSSZ
  byDay?: string[]; // MO, TU, WE, etc. または 1MO (第1月曜) など
  byMonthDay?: number[]; // 1-31 または -1 (最終日)
  byMonth?: number[]; // 1-12
  bySetPos?: number[]; // -1 (最終), 1, 2, etc.
  wkst?: string; // Week start (MO, SU, etc.)
}

/**
 * RRULE文字列をパースしてRecurrenceRuleオブジェクトに変換
 */
export function parseRRule(rruleString: string): RecurrenceRule | null {
  if (!rruleString) return null;

  // RRULE: プレフィックスを除去
  const rule = rruleString.replace(/^RRULE:/i, '');
  const parts = rule.split(';');
  const result: Partial<RecurrenceRule> = {};

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (!key || !value) continue;

    switch (key.toUpperCase()) {
      case 'FREQ':
        result.freq = value.toUpperCase() as RecurrenceRule['freq'];
        break;
      case 'INTERVAL':
        result.interval = parseInt(value, 10);
        break;
      case 'COUNT':
        result.count = parseInt(value, 10);
        break;
      case 'UNTIL':
        result.until = value;
        break;
      case 'BYDAY':
        result.byDay = value.split(',');
        break;
      case 'BYMONTHDAY':
        result.byMonthDay = value.split(',').map(v => parseInt(v, 10));
        break;
      case 'BYMONTH':
        result.byMonth = value.split(',').map(v => parseInt(v, 10));
        break;
      case 'BYSETPOS':
        result.bySetPos = value.split(',').map(v => parseInt(v, 10));
        break;
      case 'WKST':
        result.wkst = value;
        break;
    }
  }

  if (!result.freq) return null;

  return result as RecurrenceRule;
}

/**
 * RecurrenceRuleオブジェクトをRRULE文字列に変換
 */
export function buildRRule(rule: RecurrenceRule): string {
  const parts: string[] = [];

  parts.push(`FREQ=${rule.freq}`);

  if (rule.interval && rule.interval > 1) {
    parts.push(`INTERVAL=${rule.interval}`);
  }

  if (rule.count) {
    parts.push(`COUNT=${rule.count}`);
  }

  if (rule.until) {
    parts.push(`UNTIL=${rule.until}`);
  }

  if (rule.byDay && rule.byDay.length > 0) {
    parts.push(`BYDAY=${rule.byDay.join(',')}`);
  }

  if (rule.byMonthDay && rule.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${rule.byMonthDay.join(',')}`);
  }

  if (rule.byMonth && rule.byMonth.length > 0) {
    parts.push(`BYMONTH=${rule.byMonth.join(',')}`);
  }

  if (rule.bySetPos && rule.bySetPos.length > 0) {
    parts.push(`BYSETPOS=${rule.bySetPos.join(',')}`);
  }

  if (rule.wkst) {
    parts.push(`WKST=${rule.wkst}`);
  }

  return `RRULE:${parts.join(';')}`;
}

/**
 * RRULE文字列を日本語に変換
 */
export function rruleToJapanese(rruleString: string): string {
  const rule = parseRRule(rruleString);
  if (!rule) return rruleString;

  const parts: string[] = [];

  // 基本頻度
  const freqText = FREQ_MAP[rule.freq] || rule.freq;

  // インターバル処理
  if (rule.interval && rule.interval > 1) {
    switch (rule.freq) {
      case 'DAILY':
        parts.push(`${rule.interval}日ごと`);
        break;
      case 'WEEKLY':
        parts.push(`${rule.interval}週間ごと`);
        break;
      case 'MONTHLY':
        parts.push(`${rule.interval}か月ごと`);
        break;
      case 'YEARLY':
        parts.push(`${rule.interval}年ごと`);
        break;
    }
  } else {
    parts.push(freqText);
  }

  // 曜日指定 (BYDAY)
  if (rule.byDay && rule.byDay.length > 0) {
    const dayParts: string[] = [];

    for (const day of rule.byDay) {
      // 数字付きの曜日 (例: 1MO = 第1月曜)
      const match = day.match(/^(-?\d+)?([A-Z]{2})$/);
      if (match) {
        const ordinal = match[1];
        const weekday = match[2];
        const weekdayText = WEEKDAY_MAP[weekday] || weekday;

        if (ordinal) {
          const ordinalNum = parseInt(ordinal, 10);
          const ordinalText = ORDINAL_MAP[ordinalNum] || `第${ordinalNum}`;
          dayParts.push(`${ordinalText}${weekdayText}`);
        } else {
          dayParts.push(weekdayText);
        }
      }
    }

    if (dayParts.length > 0) {
      parts.push(`(${dayParts.join('、')})`);
    }
  }

  // 日付指定 (BYMONTHDAY)
  if (rule.byMonthDay && rule.byMonthDay.length > 0) {
    const dayParts = rule.byMonthDay.map(d => {
      if (d === -1) return '最終日';
      return `${d}日`;
    });
    parts.push(`(${dayParts.join('、')})`);
  }

  // 月指定 (BYMONTH)
  if (rule.byMonth && rule.byMonth.length > 0) {
    const monthNames = rule.byMonth.map(m => `${m}月`);
    parts.push(`(${monthNames.join('、')})`);
  }

  // 終了条件
  if (rule.count) {
    parts.push(`${rule.count}回まで`);
  }

  if (rule.until) {
    const until = rule.until;
    // YYYYMMDD または YYYYMMDDTHHMMSSZ 形式をパース
    const year = until.substring(0, 4);
    const month = until.substring(4, 6);
    const day = until.substring(6, 8);
    parts.push(`${year}年${parseInt(month)}月${parseInt(day)}日まで`);
  }

  return parts.join(' ');
}

/**
 * 繰り返し設定UIの状態を表すインターフェース
 */
export interface RecurrenceUIState {
  enabled: boolean;
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  // 週次の場合の曜日選択
  weeklyDays: string[]; // MO, TU, WE, etc.
  // 月次の場合の指定方法
  monthlyType: 'dayOfMonth' | 'dayOfWeek'; // 日付指定 or 曜日指定
  monthlyDayOfMonth: number; // 1-31
  monthlyWeekOrdinal: number; // 1-5 or -1 (最終)
  monthlyWeekDay: string; // MO, TU, etc.
  // 終了条件
  endType: 'never' | 'count' | 'until';
  endCount: number;
  endUntil: string; // YYYY-MM-DD
}

/**
 * デフォルトのUI状態
 */
export function getDefaultRecurrenceUIState(): RecurrenceUIState {
  return {
    enabled: false,
    freq: 'WEEKLY',
    interval: 1,
    weeklyDays: [],
    monthlyType: 'dayOfMonth',
    monthlyDayOfMonth: 1,
    monthlyWeekOrdinal: 1,
    monthlyWeekDay: 'MO',
    endType: 'never',
    endCount: 10,
    endUntil: '',
  };
}

/**
 * RRULE文字列をUI状態に変換
 */
export function rruleToUIState(rruleString: string): RecurrenceUIState {
  const defaultState = getDefaultRecurrenceUIState();

  if (!rruleString) {
    return defaultState;
  }

  const rule = parseRRule(rruleString);
  if (!rule) {
    return defaultState;
  }

  const state: RecurrenceUIState = {
    ...defaultState,
    enabled: true,
    freq: rule.freq,
    interval: rule.interval || 1,
  };

  // 曜日指定
  if (rule.byDay && rule.byDay.length > 0) {
    // 数字なしの曜日のみを抽出（週次用）
    const simpleDays = rule.byDay.filter(d => /^[A-Z]{2}$/.test(d));
    if (simpleDays.length > 0) {
      state.weeklyDays = simpleDays;
    }

    // 数字付きの曜日（月次用）
    const ordinalDay = rule.byDay.find(d => /^-?\d+[A-Z]{2}$/.test(d));
    if (ordinalDay) {
      const match = ordinalDay.match(/^(-?\d+)([A-Z]{2})$/);
      if (match) {
        state.monthlyType = 'dayOfWeek';
        state.monthlyWeekOrdinal = parseInt(match[1], 10);
        state.monthlyWeekDay = match[2];
      }
    }
  }

  // 日付指定
  if (rule.byMonthDay && rule.byMonthDay.length > 0) {
    state.monthlyType = 'dayOfMonth';
    state.monthlyDayOfMonth = rule.byMonthDay[0];
  }

  // 終了条件
  if (rule.count) {
    state.endType = 'count';
    state.endCount = rule.count;
  } else if (rule.until) {
    state.endType = 'until';
    // YYYYMMDD形式をYYYY-MM-DD形式に変換
    const year = rule.until.substring(0, 4);
    const month = rule.until.substring(4, 6);
    const day = rule.until.substring(6, 8);
    state.endUntil = `${year}-${month}-${day}`;
  }

  return state;
}

/**
 * UI状態をRRULE文字列に変換
 */
export function uiStateToRRule(state: RecurrenceUIState): string {
  if (!state.enabled) {
    return '';
  }

  const rule: RecurrenceRule = {
    freq: state.freq,
    interval: state.interval > 1 ? state.interval : undefined,
  };

  // 頻度別の追加設定
  switch (state.freq) {
    case 'WEEKLY':
      if (state.weeklyDays.length > 0) {
        rule.byDay = state.weeklyDays;
      }
      break;
    case 'MONTHLY':
      if (state.monthlyType === 'dayOfMonth') {
        rule.byMonthDay = [state.monthlyDayOfMonth];
      } else {
        // 第N週の曜日
        rule.byDay = [`${state.monthlyWeekOrdinal}${state.monthlyWeekDay}`];
      }
      break;
  }

  // 終了条件
  if (state.endType === 'count') {
    rule.count = state.endCount;
  } else if (state.endType === 'until' && state.endUntil) {
    // YYYY-MM-DD形式をYYYYMMDD形式に変換
    rule.until = state.endUntil.replace(/-/g, '');
  }

  return buildRRule(rule);
}

/**
 * 簡易的な日本語表現を返す（カレンダー表示用）
 */
export function getRecurrenceLabel(rruleString: string): string {
  if (!rruleString) return '';

  const rule = parseRRule(rruleString);
  if (!rule) return '';

  const interval = rule.interval || 1;

  switch (rule.freq) {
    case 'DAILY':
      return interval === 1 ? '毎日' : `${interval}日ごと`;
    case 'WEEKLY':
      if (rule.byDay && rule.byDay.length > 0) {
        const days = rule.byDay.map(d => WEEKDAY_MAP[d]?.replace('曜日', '') || d).join('・');
        return interval === 1 ? `毎週 ${days}` : `${interval}週ごと ${days}`;
      }
      return interval === 1 ? '毎週' : `${interval}週間ごと`;
    case 'MONTHLY':
      if (rule.byDay && rule.byDay.length > 0) {
        const dayMatch = rule.byDay[0].match(/^(-?\d+)?([A-Z]{2})$/);
        if (dayMatch && dayMatch[1]) {
          const ordinal = parseInt(dayMatch[1], 10);
          const day = WEEKDAY_MAP[dayMatch[2]] || dayMatch[2];
          const ordinalText = ordinal === -1 ? '最終' : `第${ordinal}`;
          return interval === 1 ? `毎月${ordinalText}${day}` : `${interval}か月ごと${ordinalText}${day}`;
        }
      }
      if (rule.byMonthDay && rule.byMonthDay.length > 0) {
        const day = rule.byMonthDay[0];
        return interval === 1 ? `毎月${day}日` : `${interval}か月ごと${day}日`;
      }
      return interval === 1 ? '毎月' : `${interval}か月ごと`;
    case 'YEARLY':
      return interval === 1 ? '毎年' : `${interval}年ごと`;
    default:
      return rruleToJapanese(rruleString);
  }
}
