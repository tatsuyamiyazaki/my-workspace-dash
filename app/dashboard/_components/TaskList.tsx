import { useState, useEffect, useCallback } from 'react';
import { Loader2, Plus, X, Trash2, Filter, ExternalLink, Repeat } from 'lucide-react';
import { fetchTasks, fetchTaskLists, createTask, updateTask, deleteTask, Task, TaskList as ITaskList } from '@/lib/tasksApi';
import { useAuth } from '@/contexts/AuthContext';
import { isToday, parseISO, isPast, addDays, addWeeks, addMonths, addYears } from 'date-fns';
import Link from 'next/link';

type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface RecurrenceSettings {
  enabled: boolean;
  type: RecurrenceType;
  count: number;
}

interface EditingTask extends Partial<Task> {
  originalTaskListId?: string;
  recurrence?: RecurrenceSettings;
}

interface TaskListProps {
  accessToken?: string | null;
  refreshTrigger?: number;
}

export default function TaskList({ accessToken, refreshTrigger }: TaskListProps) {
  const { setAccessToken, getValidAccessToken } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLists, setTaskLists] = useState<ITaskList[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showTodayOnly, setShowTodayOnly] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      // 有効なトークンを取得（期限切れなら自動更新）
      const validToken = await getValidAccessToken();
      if (!validToken) {
        setAccessToken(null);
        return;
      }

      // 1. Fetch all task lists
      const lists = await fetchTaskLists(validToken);
      setTaskLists(lists);

      // 2. Fetch tasks from all lists
      const allTasksPromises = lists.map(async (list) => {
        const listTasks = await fetchTasks(validToken, list.id);
        return listTasks.map(t => ({ ...t, taskListId: list.id }));
      });

      const results = await Promise.all(allTasksPromises);
      const allTasks = results.flat();

      // Sort by due date (optional but good)
      allTasks.sort((a, b) => {
        if (!a.due) return 1;
        if (!b.due) return -1;
        return new Date(a.due).getTime() - new Date(b.due).getTime();
      });

      setTasks(allTasks);
    } catch (error: unknown) {
      console.error("Failed to fetch tasks", error);
      if (error instanceof Error && error.message?.includes('401')) {
        setAccessToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, setAccessToken, getValidAccessToken]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks, refreshTrigger]);

  // Escキー対応
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && editingTask) {
        setEditingTask(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingTask]);

  const handleCreateClick = () => {
    setEditingTask({
      title: '',
      notes: '',
      taskListId: taskLists.length > 0 ? taskLists[0].id : '@default',
    });
  };

  const handleTaskClick = (task: Task) => {
    setEditingTask({ ...task, originalTaskListId: task.taskListId });
  };

  // 繰り返し日付を計算するヘルパー関数
  const getNextDate = (baseDate: Date, type: RecurrenceType, index: number): Date => {
    switch (type) {
      case 'daily':
        return addDays(baseDate, index);
      case 'weekly':
        return addWeeks(baseDate, index);
      case 'monthly':
        return addMonths(baseDate, index);
      case 'yearly':
        return addYears(baseDate, index);
      default:
        return addDays(baseDate, index);
    }
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !editingTask) return;

    const targetListId = editingTask.taskListId || '@default';

    try {
      setIsSaving(true);

      if (editingTask.id) {
        // Update existing task
        if (editingTask.originalTaskListId && editingTask.originalTaskListId !== targetListId) {
            // List changed: Delete from old list, Create in new list
            await deleteTask(accessToken, editingTask.originalTaskListId, editingTask.id);
            const { id: _id, originalTaskListId: _originalTaskListId, recurrence: _recurrence, ...taskData } = editingTask;
            await createTask(accessToken, targetListId, taskData);
        } else {
            // Normal update
            const { recurrence: _recurrence, ...taskData } = editingTask;
            await updateTask(accessToken, targetListId, editingTask.id, taskData);
        }
      } else {
        // Create new task
        const { recurrence, ...taskData } = editingTask;

        if (recurrence?.enabled && recurrence.count > 1 && editingTask.due) {
          // 繰り返しタスクを複数生成
          const baseDate = new Date(editingTask.due);
          const tasksToCreate: Promise<Task>[] = [];

          for (let i = 0; i < recurrence.count; i++) {
            const newDueDate = getNextDate(baseDate, recurrence.type, i);
            tasksToCreate.push(
              createTask(accessToken, targetListId, {
                ...taskData,
                due: newDueDate.toISOString(),
              })
            );
          }

          await Promise.all(tasksToCreate);
        } else {
          // 通常の単一タスク作成
          await createTask(accessToken, targetListId, taskData);
        }
      }
      await loadTasks();
      setEditingTask(null);
    } catch (error) {
      console.error("Failed to save task", error);
      alert("タスクの保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!accessToken || !editingTask?.id || !confirm("このタスクを削除してもよろしいですか？")) return;

    try {
      setIsSaving(true);
      const listId = editingTask.taskListId || '@default';
      await deleteTask(accessToken, listId, editingTask.id);
      await loadTasks();
      setEditingTask(null);
    } catch (error) {
      console.error("Failed to delete task", error);
      alert("タスクの削除に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleComplete = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken) return;

    try {
      // Optimistic update
      setTasks(tasks.filter(t => t.id !== task.id));
      
      const listId = task.taskListId || '@default';
      await updateTask(accessToken, listId, task.id, {
        status: 'completed'
      });
      await loadTasks();
    } catch (error) {
      console.error("Failed to complete task", error);
      loadTasks(); // Revert on error
    }
  };

  const filteredTasks = showTodayOnly 
    ? tasks.filter(task => task.due && isToday(parseISO(task.due)))
    : tasks;

  return (
    <>
      <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-[480px] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/dashboard/tasks"
            className="text-lg font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-2 group"
          >
            未完了タスク
            <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTodayOnly(!showTodayOnly)}
              className={`p-1.5 rounded-full transition-colors ${showTodayOnly ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400'}`}
              title={showTodayOnly ? "すべてのタスクを表示" : "今日のタスクのみ表示"}
            >
              <Filter className="w-5 h-5" />
            </button>
            <button
              onClick={handleCreateClick}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full transition-colors text-blue-600 dark:text-blue-400"
              title="タスクを作成"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {loading && tasks.length === 0 ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-500 dark:text-gray-400 text-sm">
            <p>{showTodayOnly ? "今日のタスクはありません" : "タスクはありません"}</p>
          </div>
        ) : (
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {filteredTasks.map((task) => (
              <div 
                key={task.id} 
                onClick={() => handleTaskClick(task)}
                className="flex items-start gap-3 group cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 p-2 rounded-lg -mx-2 transition-colors"
              >
                <button
                  onClick={(e) => handleToggleComplete(task, e)}
                  className={`
                    mt-0.5 w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors
                    border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20
                  `}
                >
                </button>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm text-gray-700 dark:text-gray-200 break-words font-medium">
                    {task.title}
                  </span>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.due && (
                      <span className={`text-xs ${task.due && isPast(parseISO(task.due)) ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
                        {new Date(task.due).toLocaleDateString()}
                      </span>
                    )}
                    {/* Show list name if multiple lists exist */}
                    {taskLists.length > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 rounded-full">
                            {taskLists.find(l => l.id === task.taskListId)?.title || 'Unknown'}
                        </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit/Create Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <form onSubmit={handleSaveTask}>
              <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-900/50">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingTask.id ? 'タスクの編集' : 'タスクの作成'}
                </h3>
                <button 
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タイトル</label>
                  <input
                    type="text"
                    value={editingTask.title || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                    placeholder="タスクを入力"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">リスト</label>
                  <select
                    value={editingTask.taskListId || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, taskListId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  >
                    {taskLists.map(list => (
                        <option key={list.id} value={list.id}>{list.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">期限</label>
                  <input
                    type="datetime-local"
                    value={editingTask.due ? new Date(editingTask.due).toISOString().slice(0, 16) : ''}
                    onChange={(e) => setEditingTask({ ...editingTask, due: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>

                {/* 繰り返し設定 - 新規タスク作成時のみ表示 */}
                {!editingTask.id && (
                  <div className="space-y-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="recurrence-enabled-widget"
                        checked={editingTask.recurrence?.enabled || false}
                        onChange={(e) =>
                          setEditingTask({
                            ...editingTask,
                            recurrence: {
                              enabled: e.target.checked,
                              type: editingTask.recurrence?.type || 'daily',
                              count: editingTask.recurrence?.count || 5,
                            },
                          })
                        }
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label
                        htmlFor="recurrence-enabled-widget"
                        className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        <Repeat className="w-4 h-4" />
                        繰り返しタスクを作成
                      </label>
                    </div>

                    {editingTask.recurrence?.enabled && (
                      <div className="space-y-3 pl-6">
                        <div className="flex items-center gap-3">
                          <select
                            value={editingTask.recurrence?.type || 'daily'}
                            onChange={(e) =>
                              setEditingTask({
                                ...editingTask,
                                recurrence: {
                                  ...editingTask.recurrence!,
                                  type: e.target.value as RecurrenceType,
                                },
                              })
                            }
                            className="px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          >
                            <option value="daily">毎日</option>
                            <option value="weekly">毎週</option>
                            <option value="monthly">毎月</option>
                            <option value="yearly">毎年</option>
                          </select>
                          <span className="text-sm text-gray-600 dark:text-gray-400">×</span>
                          <input
                            type="number"
                            min="2"
                            max="52"
                            value={editingTask.recurrence?.count || 5}
                            onChange={(e) =>
                              setEditingTask({
                                ...editingTask,
                                recurrence: {
                                  ...editingTask.recurrence!,
                                  count: Math.max(2, Math.min(52, parseInt(e.target.value) || 2)),
                                },
                              })
                            }
                            className="w-20 px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                          />
                          <span className="text-sm text-gray-600 dark:text-gray-400">回</span>
                        </div>
                        {!editingTask.due && (
                          <p className="text-xs text-amber-600 dark:text-amber-400">
                            ※ 繰り返しタスクを作成するには期限を設定してください
                          </p>
                        )}
                        {editingTask.due && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {editingTask.recurrence?.count || 5}件のタスクが作成されます
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">詳細</label>
                  <textarea
                    value={editingTask.notes || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="詳細を追加"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
                {editingTask.id ? (
                  <button
                    type="button"
                    onClick={handleDeleteTask}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    削除
                  </button>
                ) : (
                  <div></div>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingTask(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !editingTask.title}
                    className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
