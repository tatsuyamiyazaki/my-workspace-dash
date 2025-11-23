'use client';

import SummaryCards from './_components/SummaryCards';
import CalendarView from './_components/CalendarView';
import MailList from './_components/MailList';
import TaskList from './_components/TaskList';
import LinkList from './_components/LinkList';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { fetchUnreadEmails, EmailMessage } from '@/lib/gmailApi';
import { fetchDashboardCalendarData, CalendarEvent } from '@/lib/calendarApi';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

export default function DashboardPage() {
  const { accessToken, setAccessToken } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayEventCount, setTodayEventCount] = useState(0);
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    const loadData = async () => {
      if (!accessToken) return;
      
      try {
        setLoading(true);
        
        // Fetch Emails
        const emailPromise = fetchUnreadEmails(accessToken);
        
        // Fetch Calendar Summary
        const calendarPromise = fetchDashboardCalendarData(accessToken);

        const [emailData, calendarData] = await Promise.all([emailPromise, calendarPromise]);

        setUnreadCount(emailData.count);
        setEmails(emailData.emails);
        setTodayEventCount(calendarData.todayEventCount);
        setNextEvent(calendarData.nextEvent);

      } catch (error: any) {
        console.error("Failed to fetch dashboard data", error);
        if (error.message && error.message.includes('401')) {
          setAccessToken(null);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [accessToken]);

  if (!accessToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 p-6">
        <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
          <Lock className="w-8 h-8 text-gray-400" />
        </div>
        <div className="text-center space-y-2 max-w-md">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">再認証が必要です</h2>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
            セキュリティ保護のため、Google APIへのアクセストークンは一時的にのみ保存されます。ページをリロードした場合は、再度ログインしてください。
          </p>
        </div>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          ログイン画面へ戻る
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Row: Summary Cards */}
      <SummaryCards 
        unreadCount={unreadCount} 
        todayEventCount={todayEventCount} 
        nextEvent={nextEvent} 
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Mail List */}
        <div className="lg:col-span-1 h-full">
          <MailList emails={emails} loading={loading} accessToken={accessToken} />
        </div>

        {/* Center Column: Calendar */}
        <div className="lg:col-span-2 h-full">
          <CalendarView accessToken={accessToken} />
        </div>

        {/* Right Column: Task List */}
        <div className="lg:col-span-1 h-full">
          <TaskList accessToken={accessToken} />
        </div>
      </div>

      {/* Bottom Section: Links */}
      <LinkList />
    </div>
  );
}

