/**
 * 繰り返し設定エディタコンポーネント
 *
 * RRULE形式を日本語UIで編集できるようにする
 */

import { useState, useMemo } from 'react';
import {
  RecurrenceUIState,
  getDefaultRecurrenceUIState,
  rruleToUIState,
  uiStateToRRule,
  getRecurrenceLabel,
} from '@/lib/rruleUtils';

interface RecurrenceEditorProps {
  value: string[]; // RRULE配列
  onChange: (value: string[]) => void;
}

const WEEKDAYS = [
  { value: 'MO', label: '月' },
  { value: 'TU', label: '火' },
  { value: 'WE', label: '水' },
  { value: 'TH', label: '木' },
  { value: 'FR', label: '金' },
  { value: 'SA', label: '土' },
  { value: 'SU', label: '日' },
];

const WEEK_ORDINALS = [
  { value: 1, label: '第1' },
  { value: 2, label: '第2' },
  { value: 3, label: '第3' },
  { value: 4, label: '第4' },
  { value: -1, label: '最終' },
];

export default function RecurrenceEditor({ value, onChange }: RecurrenceEditorProps) {
  const [showCustom, setShowCustom] = useState(false);

  // propsから状態を派生させる（制御されたコンポーネント）
  const state = useMemo((): RecurrenceUIState => {
    const rrule = value?.[0] || '';
    if (rrule) {
      return rruleToUIState(rrule);
    }
    return getDefaultRecurrenceUIState();
  }, [value]);

  // 状態変更時にRRULEを生成して親に通知
  const updateState = (updates: Partial<RecurrenceUIState>) => {
    const newState = { ...state, ...updates };

    if (newState.enabled) {
      const rrule = uiStateToRRule(newState);
      onChange(rrule ? [rrule] : []);
    } else {
      onChange([]);
    }
  };

  // 現在のRRULE表示用ラベル
  const currentLabel = value?.[0] ? getRecurrenceLabel(value[0]) : '';

  return (
    <div className="space-y-3">
      {/* 繰り返し有効/無効 */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={state.enabled}
            onChange={(e) => updateState({ enabled: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            繰り返し
          </span>
        </label>
        {state.enabled && currentLabel && (
          <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2 py-1 rounded">
            {currentLabel}
          </span>
        )}
      </div>

      {state.enabled && (
        <div className="pl-6 space-y-3 border-l-2 border-blue-200 dark:border-blue-800">
          {/* 頻度選択 */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={state.interval}
              onChange={(e) => updateState({ interval: parseInt(e.target.value, 10) })}
              className="px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {[...Array(30)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  {i + 1}
                </option>
              ))}
            </select>

            <select
              value={state.freq}
              onChange={(e) => {
                const freq = e.target.value as RecurrenceUIState['freq'];
                updateState({ freq });
              }}
              className="px-2 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="DAILY">日ごと</option>
              <option value="WEEKLY">週間ごと</option>
              <option value="MONTHLY">か月ごと</option>
              <option value="YEARLY">年ごと</option>
            </select>
          </div>

          {/* 週次: 曜日選択 */}
          {state.freq === 'WEEKLY' && (
            <div className="space-y-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">繰り返す曜日:</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => {
                      const newDays = state.weeklyDays.includes(day.value)
                        ? state.weeklyDays.filter((d) => d !== day.value)
                        : [...state.weeklyDays, day.value];
                      updateState({ weeklyDays: newDays });
                    }}
                    className={`w-9 h-9 text-sm font-medium rounded-full transition-colors ${
                      state.weeklyDays.includes(day.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 月次: 日付/曜日選択 */}
          {state.freq === 'MONTHLY' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="monthlyType"
                    checked={state.monthlyType === 'dayOfMonth'}
                    onChange={() => updateState({ monthlyType: 'dayOfMonth' })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">毎月</span>
                </label>
                <select
                  value={state.monthlyDayOfMonth}
                  onChange={(e) => updateState({ monthlyDayOfMonth: parseInt(e.target.value, 10) })}
                  disabled={state.monthlyType !== 'dayOfMonth'}
                  className="px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                >
                  {[...Array(31)].map((_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {i + 1}日
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="monthlyType"
                    checked={state.monthlyType === 'dayOfWeek'}
                    onChange={() => updateState({ monthlyType: 'dayOfWeek' })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">毎月</span>
                </label>
                <select
                  value={state.monthlyWeekOrdinal}
                  onChange={(e) => updateState({ monthlyWeekOrdinal: parseInt(e.target.value, 10) })}
                  disabled={state.monthlyType !== 'dayOfWeek'}
                  className="px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                >
                  {WEEK_ORDINALS.map((ordinal) => (
                    <option key={ordinal.value} value={ordinal.value}>
                      {ordinal.label}
                    </option>
                  ))}
                </select>
                <select
                  value={state.monthlyWeekDay}
                  onChange={(e) => updateState({ monthlyWeekDay: e.target.value })}
                  disabled={state.monthlyType !== 'dayOfWeek'}
                  className="px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                >
                  {WEEKDAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}曜日
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* 終了条件 */}
          <div className="space-y-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">終了:</span>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="endType"
                  checked={state.endType === 'never'}
                  onChange={() => updateState({ endType: 'never' })}
                  className="text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">終了しない</span>
              </label>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="endType"
                    checked={state.endType === 'count'}
                    onChange={() => updateState({ endType: 'count' })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">回数:</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={state.endCount}
                  onChange={(e) => updateState({ endCount: parseInt(e.target.value, 10) || 1 })}
                  disabled={state.endType !== 'count'}
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">回</span>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="endType"
                    checked={state.endType === 'until'}
                    onChange={() => updateState({ endType: 'until' })}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">日付:</span>
                </label>
                <input
                  type="date"
                  value={state.endUntil}
                  onChange={(e) => updateState({ endUntil: e.target.value })}
                  disabled={state.endType !== 'until'}
                  className="px-2 py-1 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                />
              </div>
            </div>
          </div>

          {/* 詳細オプション (RRULE直接編集) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowCustom(!showCustom)}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              {showCustom ? '詳細を閉じる' : 'RRULEを直接編集'}
            </button>
            {showCustom && (
              <div className="mt-2 space-y-1">
                <input
                  type="text"
                  value={value?.[0] || ''}
                  onChange={(e) => {
                    onChange(e.target.value ? [e.target.value] : []);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="例: RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE,FR"
                />
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  RFC 5545 RRULE形式で入力してください
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
