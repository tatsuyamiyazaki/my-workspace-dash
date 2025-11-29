'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Inbox, Mail, Star, Archive, ArrowLeft, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  EmailMessage,
  fetchInboxEmails,
  fetchUnreadEmails,
  fetchStarredEmails,
  fetchAllEmails,
} from '@/lib/gmailApi';
import MailListView from './_components/MailListView';

type MailCategory = 'inbox' | 'unread' | 'starred' | 'all';

interface CategoryConfig {
  id: MailCategory;
  label: string;
  icon: React.ReactNode;
  fetchFn: (token: string, maxResults?: number) => Promise<{ count: number; emails: EmailMessage[]; unreadCount?: number }>;
}

const CATEGORIES: CategoryConfig[] = [
  {
    id: 'inbox',
    label: '受信トレイ',
    icon: <Inbox className="w-5 h-5" />,
    fetchFn: fetchInboxEmails,
  },
  {
    id: 'unread',
    label: '未読メール',
    icon: <Mail className="w-5 h-5" />,
    fetchFn: fetchUnreadEmails,
  },
  {
    id: 'starred',
    label: 'スター付き',
    icon: <Star className="w-5 h-5" />,
    fetchFn: fetchStarredEmails,
  },
  {
    id: 'all',
    label: 'すべてのメール',
    icon: <Archive className="w-5 h-5" />,
    fetchFn: fetchAllEmails,
  },
];

export default function MailPage() {
  const router = useRouter();
  const { accessToken, getValidAccessToken, setAccessToken } = useAuth();
  const [activeCategory, setActiveCategory] = useState<MailCategory>('inbox');
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<MailCategory, number>>({
    inbox: 0,
    unread: 0,
    starred: 0,
    all: 0,
  });

  const loadEmails = useCallback(async (category: MailCategory) => {
    if (!accessToken) return;

    setLoading(true);
    try {
      const validToken = await getValidAccessToken();
      if (!validToken) {
        setAccessToken(null);
        return;
      }

      const categoryConfig = CATEGORIES.find((c) => c.id === category);
      if (!categoryConfig) return;

      const result = await categoryConfig.fetchFn(validToken, 50);
      setEmails(result.emails);
      setCounts((prev) => ({ ...prev, [category]: result.count }));
    } catch (error) {
      console.error('Failed to load emails:', error);
      if (error instanceof Error && error.message.includes('401')) {
        setAccessToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, getValidAccessToken, setAccessToken]);

  // 初回ロードとカテゴリ変更時
  useEffect(() => {
    loadEmails(activeCategory);
  }, [activeCategory, loadEmails]);

  // 全カテゴリのカウントを取得
  useEffect(() => {
    const loadCounts = async () => {
      if (!accessToken) return;

      try {
        const validToken = await getValidAccessToken();
        if (!validToken) return;

        const [inboxResult, unreadResult, starredResult, allResult] = await Promise.all([
          fetchInboxEmails(validToken, 1),
          fetchUnreadEmails(validToken, 1),
          fetchStarredEmails(validToken, 1),
          fetchAllEmails(validToken, 1),
        ]);

        setCounts({
          inbox: inboxResult.count,
          unread: unreadResult.count,
          starred: starredResult.count,
          all: allResult.count,
        });
      } catch (error) {
        console.error('Failed to load counts:', error);
      }
    };

    loadCounts();
  }, [accessToken, getValidAccessToken]);

  const handleCategoryChange = (category: MailCategory) => {
    setActiveCategory(category);
  };

  const handleRefresh = () => {
    loadEmails(activeCategory);
  };

  const handleBack = () => {
    router.push('/dashboard');
  };

  if (!accessToken) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            メールを表示するにはログインが必要です
          </p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">ダッシュボードに戻る</span>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {CATEGORIES.map((category) => {
            const isActive = activeCategory === category.id;
            const count = counts[category.id];

            return (
              <button
                key={category.id}
                onClick={() => handleCategoryChange(category.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  {category.icon}
                  <span className="text-sm font-medium">{category.label}</span>
                </div>
                {count > 0 && (
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-300'
                        : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            {CATEGORIES.find((c) => c.id === activeCategory)?.label}
          </h1>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>更新</span>
          </button>
        </header>

        {/* Email List */}
        <div className="flex-1 overflow-auto p-6">
          <MailListView
            emails={emails}
            loading={loading}
            accessToken={accessToken}
            onRefresh={handleRefresh}
          />
        </div>
      </main>
    </div>
  );
}
