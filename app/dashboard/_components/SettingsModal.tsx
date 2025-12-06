'use client';

import { X, Plus, Trash2, Bell, Edit2, Link as LinkIcon, LayoutGrid, Download, Upload } from 'lucide-react';
import { useSettings, FixedLink, CustomLink, LinkFolder } from '@/contexts/AuthContext';
import { useState, useEffect, useRef } from 'react';
import { ICON_OPTIONS } from '@/lib/constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_TIMES = [1, 5, 10, 15, 30, 60];

interface SettingsData {
  refreshInterval: number;
  notificationMinutes: number[];
  notificationsEnabled: boolean;
  fixedLinks: FixedLink[];
  customLinks: CustomLink[];
  folders: LinkFolder[];
  noteGridColumns: number;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const {
    refreshInterval,
    setRefreshInterval,
    notificationMinutes,
    setNotificationMinutes,
    notificationsEnabled,
    setNotificationsEnabled,
    fixedLinks,
    setFixedLinks,
    customLinks,
    setCustomLinks,
    folders,
    setFolders,
    noteGridColumns,
    setNoteGridColumns,
  } = useSettings();
  const [tempInterval, setTempInterval] = useState(() => refreshInterval);
  const [tempNotifications, setTempNotifications] = useState<number[]>(() => notificationMinutes);
  const [tempEnabled, setTempEnabled] = useState(() => notificationsEnabled);
  const [newNotificationTime, setNewNotificationTime] = useState<number>(5);
  const [tempFixedLinks, setTempFixedLinks] = useState<FixedLink[]>(() => fixedLinks);
  const [editingLink, setEditingLink] = useState<FixedLink | null>(null);
  const [tempNoteGridColumns, setTempNoteGridColumns] = useState(() => noteGridColumns);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Defer state updates to avoid synchronous setState in effect
      setTimeout(() => {
        setTempInterval(refreshInterval);
        setTempNotifications(notificationMinutes);
        setTempEnabled(notificationsEnabled);
        setTempFixedLinks(fixedLinks);
        setTempNoteGridColumns(noteGridColumns);
      }, 0);
    }
  }, [refreshInterval, notificationMinutes, notificationsEnabled, fixedLinks, noteGridColumns, isOpen]);

  // Escキー対応
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // ネストされたリンク編集モーダルが開いている場合は閉じる
        if (editingLink) {
          setEditingLink(null);
        } else {
          // メインモーダルを閉じる
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, editingLink, onClose]);

  const handleSave = async () => {
    setRefreshInterval(tempInterval);
    setNotificationMinutes(tempNotifications);
    setNotificationsEnabled(tempEnabled);
    setFixedLinks(tempFixedLinks);
    setNoteGridColumns(tempNoteGridColumns);

    // Request notification permission if enabling
    if (tempEnabled && !notificationsEnabled) {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    }

    onClose();
  };

  const addNotificationTime = () => {
    if (!tempNotifications.includes(newNotificationTime)) {
      setTempNotifications([...tempNotifications, newNotificationTime].sort((a, b) => a - b));
    }
  };

  const removeNotificationTime = (time: number) => {
    setTempNotifications(tempNotifications.filter(t => t !== time));
  };

  // Fixed Links Handlers
  const handleAddFixedLink = () => {
    setEditingLink({
      id: Date.now().toString(),
      name: '',
      url: '',
      icon: 'Folder',
    });
  };

  const handleEditFixedLink = (link: FixedLink) => {
    setEditingLink({ ...link });
  };

  const handleDeleteFixedLink = (id: string) => {
    setTempFixedLinks(tempFixedLinks.filter(link => link.id !== id));
  };

  const handleSaveFixedLink = () => {
    if (!editingLink) return;
    
    // Check if it's an existing link or new one
    const exists = tempFixedLinks.some(link => link.id === editingLink.id);
    if (exists) {
      setTempFixedLinks(tempFixedLinks.map(link => link.id === editingLink.id ? editingLink : link));
    } else {
      setTempFixedLinks([...tempFixedLinks, editingLink]);
    }
    setEditingLink(null);
  };

  const getIconComponent = (iconName: string) => {
    const icon = ICON_OPTIONS.find(opt => opt.name === iconName);
    return icon ? icon.component : LinkIcon;
  };

  // エクスポート機能
  const handleExport = () => {
    const settings: SettingsData = {
      refreshInterval,
      notificationMinutes,
      notificationsEnabled,
      fixedLinks,
      customLinks,
      folders,
      noteGridColumns,
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-settings-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // インポート機能
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as Partial<SettingsData>;

        // 各設定を検証して適用
        if (typeof data.refreshInterval === 'number' && data.refreshInterval >= 1 && data.refreshInterval <= 60) {
          setRefreshInterval(data.refreshInterval);
        }
        if (Array.isArray(data.notificationMinutes) && data.notificationMinutes.every(n => typeof n === 'number')) {
          setNotificationMinutes(data.notificationMinutes);
        }
        if (typeof data.notificationsEnabled === 'boolean') {
          setNotificationsEnabled(data.notificationsEnabled);
        }
        if (Array.isArray(data.fixedLinks)) {
          setFixedLinks(data.fixedLinks);
        }
        if (Array.isArray(data.customLinks)) {
          setCustomLinks(data.customLinks);
        }
        if (Array.isArray(data.folders)) {
          setFolders(data.folders);
        }
        if (typeof data.noteGridColumns === 'number' && data.noteGridColumns >= 1 && data.noteGridColumns <= 4) {
          setNoteGridColumns(data.noteGridColumns);
        }

        // 一時的なstateも更新
        setTempInterval(data.refreshInterval ?? refreshInterval);
        setTempNotifications(data.notificationMinutes ?? notificationMinutes);
        setTempEnabled(data.notificationsEnabled ?? notificationsEnabled);
        setTempFixedLinks(data.fixedLinks ?? fixedLinks);
        setTempNoteGridColumns(data.noteGridColumns ?? noteGridColumns);

        alert('設定をインポートしました');
      } catch {
        alert('設定ファイルの読み込みに失敗しました。正しいJSON形式か確認してください。');
      }
    };
    reader.readAsText(file);

    // ファイル入力をリセット（同じファイルを再度選択できるように）
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">設定</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8">
          {/* Refresh Interval Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              自動更新間隔
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              メール、カレンダー、タスクを自動的に更新する間隔を設定します
            </p>
            <select
              value={tempInterval}
              onChange={(e) => setTempInterval(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={1}>1分</option>
              <option value={2}>2分</option>
              <option value={5}>5分</option>
              <option value={10}>10分</option>
              <option value={15}>15分</option>
              <option value={30}>30分</option>
              <option value={60}>1時間</option>
            </select>
          </div>

          {/* Notifications Section */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  予定の通知
                </label>
              </div>
              <button
                onClick={() => setTempEnabled(!tempEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  tempEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    tempEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {tempEnabled && (
              <>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  予定の開始時間前に通知を表示します
                </p>

                <div className="space-y-2 mb-3">
                  {tempNotifications.map((time) => (
                    <div
                      key={time}
                      className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg"
                    >
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {time}分前
                      </span>
                      <button
                        onClick={() => removeNotificationTime(time)}
                        className="text-red-500 hover:text-red-700 dark:hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <select
                    value={newNotificationTime}
                    onChange={(e) => setNewNotificationTime(Number(e.target.value))}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    {PRESET_TIMES.map((time) => (
                      <option key={time} value={time}>
                        {time}分前
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={addNotificationTime}
                    disabled={tempNotifications.includes(newNotificationTime)}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Fixed Links Section */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  固定リンク設定
                </label>
              </div>
              <button
                onClick={handleAddFixedLink}
                className="p-1 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                title="リンクを追加"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {tempFixedLinks.map((link) => {
                const IconComp = getIconComponent(link.icon);
                return (
                  <div
                    key={link.id}
                    className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <IconComp className="w-4 h-4 text-blue-500 flex-shrink-0" />
                      <div className="truncate">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">{link.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{link.url}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleEditFixedLink(link)}
                        className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteFixedLink(link.id)}
                        className="p-1 text-gray-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {tempFixedLinks.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
                  固定リンクはありません
                </p>
              )}
            </div>
          </div>

          {/* Note Grid Columns Section */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                メモのカード表示列数
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              グリッド表示時のメモカードの列数を設定します
            </p>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((cols) => (
                <button
                  key={cols}
                  onClick={() => setTempNoteGridColumns(cols)}
                  className={`flex-1 py-2 px-3 text-sm font-medium rounded-lg border-2 transition-colors ${
                    tempNoteGridColumns === cols
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'border-gray-200 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {cols}列
                </button>
              ))}
            </div>
          </div>

          {/* Export/Import Section */}
          <div className="border-t border-gray-200 dark:border-slate-700 pt-6">
            <div className="flex items-center gap-2 mb-4">
              <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                設定のバックアップ
              </label>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              設定をJSON形式でエクスポート・インポートできます
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleExport}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors"
              >
                <Download className="w-4 h-4" />
                エクスポート
              </button>
              <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer">
                <Upload className="w-4 h-4" />
                インポート
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-b-lg flex gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            保存
          </button>
        </div>
      </div>

      {/* Edit Fixed Link Modal Overlay */}
      {editingLink && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-sm w-full p-4 border border-gray-200 dark:border-slate-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {tempFixedLinks.some(l => l.id === editingLink.id) ? 'リンクの編集' : 'リンクの追加'}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">名前</label>
                <input
                  type="text"
                  value={editingLink.name}
                  onChange={(e) => setEditingLink({ ...editingLink, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="リンク名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">URL</label>
                <input
                  type="text"
                  value={editingLink.url}
                  onChange={(e) => setEditingLink({ ...editingLink, url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">アイコン</label>
                <div className="grid grid-cols-6 gap-2 max-h-[160px] overflow-y-auto p-1 border border-gray-200 dark:border-slate-700 rounded-lg">
                  {ICON_OPTIONS.map((opt) => {
                    const Icon = opt.component;
                    return (
                      <button
                        key={opt.name}
                        onClick={() => setEditingLink({ ...editingLink, icon: opt.name })}
                        className={`p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-700 flex justify-center ${
                          editingLink.icon === opt.name ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'text-gray-500'
                        }`}
                        title={opt.name}
                      >
                        <Icon className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setEditingLink(null)}
                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveFixedLink}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
