'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import {
  fetchAllTasks,
  createTask,
  updateTask,
  deleteTask,
  createTaskList,
  updateTaskList,
  deleteTaskList,
  Task,
  TaskList as ITaskList,
} from '@/lib/tasksApi';
import {
  Loader2,
  Plus,
  X,
  Trash2,
  Calendar,
  CalendarClock,
  CalendarX,
  CalendarDays,
  CalendarRange,
  Inbox,
  CheckCircle2,
  FolderKanban,
  ArrowLeft,
  Check,
  Pencil,
  MoreVertical,
  FolderPlus,
  Repeat,
} from 'lucide-react';
import {
  isToday,
  isTomorrow,
  isPast,
  isFuture,
  isWithinInterval,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  startOfDay,
  parseISO,
} from 'date-fns';
import Link from 'next/link';

type FilterType = 'today' | 'overdue' | 'tomorrow' | 'week' | 'planned' | 'no-due' | 'completed' | string;

type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly';

interface RecurrenceSettings {
  enabled: boolean;
  type: RecurrenceType;
  count: number; // 生成するタスクの数
}

interface EditingTask extends Partial<Task> {
  originalTaskListId?: string;
  recurrence?: RecurrenceSettings;
}

interface SidebarItem {
  id: FilterType;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

export default function TasksPage() {
  const { accessToken, setAccessToken, getValidAccessToken } = useAuth();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskLists, setTaskLists] = useState<ITaskList[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('today');
  const [editingTask, setEditingTask] = useState<EditingTask | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Project (TaskList) management
  const [editingProject, setEditingProject] = useState<{ id?: string; title: string } | null>(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);
      const validToken = await getValidAccessToken();
      if (!validToken) {
        setAccessToken(null);
        return;
      }

      const { tasks: allTasks, taskLists: lists } = await fetchAllTasks(validToken, true);
      setTasks(allTasks);
      setTaskLists(lists);
    } catch (error: unknown) {
      console.error('Failed to fetch tasks', error);
      if (error instanceof Error && error.message?.includes('401')) {
        setAccessToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, setAccessToken, getValidAccessToken]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Filter tasks based on selected filter
  const filteredTasks = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = startOfDay(addDays(now, 1));
    const weekEnd = addDays(todayStart, 7);

    return tasks.filter((task) => {
      const dueDate = task.due ? parseISO(task.due) : null;

      // Handle project filters (task list IDs)
      if (taskLists.some((list) => list.id === selectedFilter)) {
        return task.taskListId === selectedFilter;
      }

      switch (selectedFilter) {
        case 'today':
          return dueDate && isToday(dueDate);
        case 'overdue':
          return dueDate && isPast(startOfDay(dueDate)) && !isToday(dueDate) && task.status !== 'completed';
        case 'tomorrow':
          return dueDate && isTomorrow(dueDate);
        case 'week':
          return dueDate && isWithinInterval(dueDate, { start: todayStart, end: weekEnd });
        case 'planned':
          return dueDate && isFuture(startOfDay(dueDate));
        case 'no-due':
          return !dueDate;
        case 'completed':
          return task.status === 'completed';
        default:
          return true;
      }
    });
  }, [tasks, selectedFilter, taskLists]);

  // Calculate counts for sidebar
  const counts = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const weekEnd = addDays(todayStart, 7);

    const incompleteTasks = tasks.filter((t) => t.status !== 'completed');
    const completedTasks = tasks.filter((t) => t.status === 'completed');

    return {
      today: incompleteTasks.filter((t) => t.due && isToday(parseISO(t.due))).length,
      overdue: incompleteTasks.filter(
        (t) => t.due && isPast(startOfDay(parseISO(t.due))) && !isToday(parseISO(t.due))
      ).length,
      tomorrow: incompleteTasks.filter((t) => t.due && isTomorrow(parseISO(t.due))).length,
      week: incompleteTasks.filter(
        (t) => t.due && isWithinInterval(parseISO(t.due), { start: todayStart, end: weekEnd })
      ).length,
      planned: incompleteTasks.filter((t) => t.due && isFuture(startOfDay(parseISO(t.due)))).length,
      noDue: incompleteTasks.filter((t) => !t.due).length,
      completed: completedTasks.length,
      total: incompleteTasks.length,
    };
  }, [tasks]);

  // Get project counts
  const projectCounts = useMemo(() => {
    const countMap: Record<string, number> = {};
    const incompleteTasks = tasks.filter((t) => t.status !== 'completed');
    taskLists.forEach((list) => {
      countMap[list.id] = incompleteTasks.filter((t) => t.taskListId === list.id).length;
    });
    return countMap;
  }, [tasks, taskLists]);

  const sidebarItems: SidebarItem[] = [
    { id: 'today', label: '今日', icon: <Calendar className="w-5 h-5" />, count: counts.today },
    { id: 'overdue', label: '期限切れ', icon: <CalendarX className="w-5 h-5" />, count: counts.overdue },
    { id: 'tomorrow', label: '明日', icon: <CalendarClock className="w-5 h-5" />, count: counts.tomorrow },
    { id: 'week', label: '次の7日間', icon: <CalendarDays className="w-5 h-5" />, count: counts.week },
    { id: 'planned', label: '計画', icon: <CalendarRange className="w-5 h-5" />, count: counts.planned },
    { id: 'no-due', label: '期限なし', icon: <Inbox className="w-5 h-5" />, count: counts.noDue },
    { id: 'completed', label: '完了済', icon: <CheckCircle2 className="w-5 h-5" />, count: counts.completed },
  ];

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
        // 既存タスクの編集
        if (editingTask.originalTaskListId && editingTask.originalTaskListId !== targetListId) {
          await deleteTask(accessToken, editingTask.originalTaskListId, editingTask.id);
          const { id: _id, originalTaskListId: _originalTaskListId, recurrence: _recurrence, ...taskData } = editingTask;
          await createTask(accessToken, targetListId, taskData);
        } else {
          const { recurrence: _recurrence, ...taskData } = editingTask;
          await updateTask(accessToken, targetListId, editingTask.id, taskData);
        }
      } else {
        // 新規タスク作成
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
      console.error('Failed to save task', error);
      alert('タスクの保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!accessToken || !editingTask?.id || !confirm('このタスクを削除してもよろしいですか？')) return;

    try {
      setIsSaving(true);
      const listId = editingTask.taskListId || '@default';
      await deleteTask(accessToken, listId, editingTask.id);
      await loadTasks();
      setEditingTask(null);
    } catch (error) {
      console.error('Failed to delete task', error);
      alert('タスクの削除に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleComplete = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!accessToken) return;

    try {
      const listId = task.taskListId || '@default';
      const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
      );

      await updateTask(accessToken, listId, task.id, { status: newStatus });
      await loadTasks();
    } catch (error) {
      console.error('Failed to update task', error);
      loadTasks();
    }
  };

  // Project (TaskList) management handlers
  const handleCreateProject = () => {
    setEditingProject({ title: '' });
    setProjectMenuOpen(null);
  };

  const handleEditProject = (list: ITaskList) => {
    setEditingProject({ id: list.id, title: list.title });
    setProjectMenuOpen(null);
  };

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !editingProject || !editingProject.title.trim()) return;

    try {
      setIsSaving(true);
      if (editingProject.id) {
        await updateTaskList(accessToken, editingProject.id, editingProject.title.trim());
      } else {
        await createTaskList(accessToken, editingProject.title.trim());
      }
      await loadTasks();
      setEditingProject(null);
    } catch (error) {
      console.error('Failed to save project', error);
      alert('プロジェクトの保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProject = async (listId: string) => {
    if (!accessToken) return;

    const list = taskLists.find((l) => l.id === listId);
    const taskCount = tasks.filter((t) => t.taskListId === listId).length;

    if (!confirm(`「${list?.title}」を削除しますか？\n${taskCount > 0 ? `このプロジェクトには${taskCount}件のタスクがあります。すべて削除されます。` : ''}`)) {
      return;
    }

    try {
      setIsSaving(true);
      await deleteTaskList(accessToken, listId);
      if (selectedFilter === listId) {
        setSelectedFilter('today');
      }
      await loadTasks();
      setProjectMenuOpen(null);
    } catch (error) {
      console.error('Failed to delete project', error);
      alert('プロジェクトの削除に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut for Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingTask) setEditingTask(null);
        if (editingProject) setEditingProject(null);
        if (projectMenuOpen) setProjectMenuOpen(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingTask, editingProject, projectMenuOpen]);

  // Close project menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (projectMenuOpen) setProjectMenuOpen(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [projectMenuOpen]);

  if (!accessToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 p-6">
        <p className="text-gray-500 dark:text-gray-400">再認証が必要です</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          ログイン画面へ戻る
        </button>
      </div>
    );
  }

  const getFilterLabel = () => {
    const project = taskLists.find((l) => l.id === selectedFilter);
    if (project) return project.title;
    return sidebarItems.find((item) => item.id === selectedFilter)?.label || 'タスク';
  };

  // Split tasks for display
  const incompleteTasks = filteredTasks.filter((t) => t.status !== 'completed');
  const completedTasks = filteredTasks.filter((t) => t.status === 'completed');

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      {/* Left Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-4 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <Link
            href="/dashboard"
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-gray-500 dark:text-gray-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">タスク</h2>
        </div>

        <nav className="space-y-1 flex-1 overflow-y-auto">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedFilter(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left ${
                selectedFilter === item.id
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <span className="flex items-center gap-3">
                {item.icon}
                <span className="text-sm font-medium">{item.label}</span>
              </span>
              {item.count !== undefined && item.count > 0 && (
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    selectedFilter === item.id
                      ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}

          {/* Projects section */}
          <div className="pt-4 mt-4 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-2 px-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                プロジェクト
              </h3>
              <button
                onClick={handleCreateProject}
                className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors text-gray-500 dark:text-gray-400 hover:text-blue-500"
                title="新規プロジェクト"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>
            {taskLists.map((list) => (
              <div
                key={list.id}
                className={`relative group flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  selectedFilter === list.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300'
                }`}
              >
                <button
                  onClick={() => setSelectedFilter(list.id)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <FolderKanban className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium truncate">{list.title}</span>
                </button>
                <div className="flex items-center gap-1">
                  {projectCounts[list.id] > 0 && (
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        selectedFilter === list.id
                          ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-slate-600 text-gray-600 dark:text-gray-300'
                      }`}
                    >
                      {projectCounts[list.id]}
                    </span>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProjectMenuOpen(projectMenuOpen === list.id ? null : list.id);
                    }}
                    className="p-1 opacity-0 group-hover:opacity-100 hover:bg-gray-200 dark:hover:bg-slate-600 rounded transition-all text-gray-400 dark:text-gray-500"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>

                {/* Dropdown menu */}
                {projectMenuOpen === list.id && (
                  <div
                    className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 py-1 min-w-[120px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleEditProject(list)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700"
                    >
                      <Pencil className="w-4 h-4" />
                      編集
                    </button>
                    <button
                      onClick={() => handleDeleteProject(list.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                      削除
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{getFilterLabel()}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              未完了: {incompleteTasks.length}件 / 完了済: {completedTasks.length}件
            </p>
          </div>
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
          >
            <Plus className="w-5 h-5" />
            新規タスク
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center flex-1">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Incomplete Tasks */}
            {selectedFilter !== 'completed' && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  未完了のタスク ({incompleteTasks.length})
                </h2>
                {incompleteTasks.length === 0 ? (
                  <p className="text-gray-400 dark:text-gray-500 text-sm py-4">タスクはありません</p>
                ) : (
                  <div className="space-y-2">
                    {incompleteTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        taskLists={taskLists}
                        onToggle={handleToggleComplete}
                        onClick={handleTaskClick}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Completed Tasks */}
            {(selectedFilter === 'completed' || completedTasks.length > 0) && (
              <section>
                <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  完了済のタスク ({completedTasks.length})
                </h2>
                {completedTasks.length === 0 ? (
                  <p className="text-gray-400 dark:text-gray-500 text-sm py-4">完了済のタスクはありません</p>
                ) : (
                  <div className="space-y-2">
                    {completedTasks.map((task) => (
                      <TaskItem
                        key={task.id}
                        task={task}
                        taskLists={taskLists}
                        onToggle={handleToggleComplete}
                        onClick={handleTaskClick}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        )}
      </main>

      {/* Task Modal */}
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    タイトル
                  </label>
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    リスト（プロジェクト）
                  </label>
                  <select
                    value={editingTask.taskListId || ''}
                    onChange={(e) => setEditingTask({ ...editingTask, taskListId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  >
                    {taskLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    期限
                  </label>
                  <input
                    type="datetime-local"
                    value={editingTask.due ? new Date(editingTask.due).toISOString().slice(0, 16) : ''}
                    onChange={(e) =>
                      setEditingTask({
                        ...editingTask,
                        due: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  />
                </div>

                {/* 繰り返し設定 - 新規タスク作成時のみ表示 */}
                {!editingTask.id && (
                  <div className="space-y-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg border border-gray-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="recurrence-enabled"
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
                        htmlFor="recurrence-enabled"
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    詳細
                  </label>
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

      {/* Project Modal */}
      {editingProject && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <form onSubmit={handleSaveProject}>
              <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-900/50">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingProject.id ? 'プロジェクトの編集' : '新規プロジェクト'}
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>

              <div className="p-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    プロジェクト名
                  </label>
                  <input
                    type="text"
                    value={editingProject.title}
                    onChange={(e) => setEditingProject({ ...editingProject, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                    placeholder="プロジェクト名を入力"
                    autoFocus
                  />
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingProject(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSaving || !editingProject.title.trim()}
                  className="px-4 py-2 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                >
                  {isSaving ? '保存中...' : '保存'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Task Item Component
function TaskItem({
  task,
  taskLists,
  onToggle,
  onClick,
}: {
  task: Task;
  taskLists: ITaskList[];
  onToggle: (task: Task, e: React.MouseEvent) => void;
  onClick: (task: Task) => void;
}) {
  const isCompleted = task.status === 'completed';
  const dueDate = task.due ? parseISO(task.due) : null;
  const isOverdue = dueDate && isPast(startOfDay(dueDate)) && !isToday(dueDate) && !isCompleted;

  return (
    <div
      onClick={() => onClick(task)}
      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 cursor-pointer group transition-colors border border-transparent hover:border-gray-200 dark:hover:border-slate-700"
    >
      <button
        onClick={(e) => onToggle(task, e)}
        className={`mt-0.5 w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-colors ${
          isCompleted
            ? 'bg-green-500 border-green-500 text-white'
            : 'border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
        }`}
      >
        {isCompleted && <Check className="w-3 h-3" />}
      </button>

      <div className="flex-1 min-w-0">
        <span
          className={`text-sm font-medium block ${
            isCompleted
              ? 'text-gray-400 dark:text-gray-500 line-through'
              : 'text-gray-800 dark:text-gray-200'
          }`}
        >
          {task.title}
        </span>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {dueDate && (
            <span
              className={`text-xs ${
                isOverdue
                  ? 'text-red-500 font-medium'
                  : isToday(dueDate)
                  ? 'text-orange-500 font-medium'
                  : 'text-gray-400 dark:text-gray-500'
              }`}
            >
              {isOverdue && '期限切れ: '}
              {dueDate.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
            </span>
          )}

          {taskLists.length > 1 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-gray-400 rounded-full">
              {taskLists.find((l) => l.id === task.taskListId)?.title || 'Unknown'}
            </span>
          )}

          {task.notes && (
            <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[200px]">
              {task.notes}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick(task);
        }}
        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-all text-gray-400 dark:text-gray-500"
      >
        <Pencil className="w-4 h-4" />
      </button>
    </div>
  );
}
