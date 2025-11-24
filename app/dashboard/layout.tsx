'use client';

import { useAuth } from '@/contexts/AuthContext';
import { LayoutGrid, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ThemeToggle } from '@/components/ThemeToggle';
import SettingsModal from './_components/SettingsModal';

function CurrentDateTime() {
  const [date, setDate] = useState<Date | null>(null);

  useEffect(() => {
    setDate(new Date());
    const timer = setInterval(() => setDate(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!date) return null;

  return (
    <div className="hidden lg:flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 px-3 py-1.5 rounded-md ml-2">
      <span>{date.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
      <span className="w-[5.5em] text-center font-mono">{date.toLocaleTimeString('ja-JP')}</span>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0f172a]">Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      {/* Header */}
      <header className="bg-white dark:bg-[#1e293b] border-b border-gray-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="text-blue-600 dark:text-blue-500">
            <LayoutGrid className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">マイダッシュボード</h1>
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-800 rounded-full transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>
          <CurrentDateTime />
          <div className="flex items-center gap-3 pl-4 border-l border-gray-200 dark:border-slate-700">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{user.displayName || 'User'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{user.email}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || 'User'} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 font-bold">
                  {user.displayName?.[0] || 'U'}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="p-6 w-full">
        {children}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
