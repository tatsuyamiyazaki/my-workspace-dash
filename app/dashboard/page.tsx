'use client';

import SummaryCards from './_components/SummaryCards';
import CalendarView from './_components/CalendarView';
import MailList from './_components/MailList';
import TaskList from './_components/TaskList';
import FixedLinkList from './_components/FixedLinkList';
import CustomLinkList from './_components/CustomLinkList';
import NotesWidget from './_components/NotesWidget';
import EventNotifications from './_components/EventNotifications';
import { useAuth, useSettings } from '@/contexts/AuthContext';
import { useEffect, useState, useRef, useCallback } from 'react';
import { fetchInboxEmails, EmailMessage } from '@/lib/gmailApi';
import { fetchDashboardCalendarData, CalendarEvent } from '@/lib/calendarApi';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

export default function DashboardPage() {
  const { accessToken, setAccessToken } = useAuth();
  const { refreshInterval } = useSettings();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [todayEventCount, setTodayEventCount] = useState(0);
  const [nextEvent, setNextEvent] = useState<CalendarEvent | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    
    try {
      setLoading(true);
      
      // Fetch Emails from Inbox
      const emailPromise = fetchInboxEmails(accessToken);
      
      // Fetch Calendar Summary
      const calendarPromise = fetchDashboardCalendarData(accessToken);

      const [emailData, calendarData] = await Promise.all([emailPromise, calendarPromise]);

      setUnreadCount(emailData.unreadCount);
      setEmails(emailData.emails);
      setTodayEventCount(calendarData.todayEventCount);
      setNextEvent(calendarData.nextEvent);

    } catch (error: unknown) {
      console.error("Failed to fetch dashboard data", error);
      if (error instanceof Error && error.message && error.message.includes('401')) {
        setAccessToken(null);
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, setAccessToken]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-refresh based on settings
  useEffect(() => {
    if (!accessToken) return;
    
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set new interval
    intervalRef.current = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, refreshInterval * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [accessToken, refreshInterval]);

  // Refresh data when refreshKey changes
  useEffect(() => {
    if (refreshKey > 0) {
      loadData();
    }
  }, [refreshKey, loadData]);

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
      {/* Event Notifications Handler */}
      <EventNotifications accessToken={accessToken} />

      {/* Top Row: Summary Cards */}
      <SummaryCards 
        unreadCount={unreadCount} 
        todayEventCount={todayEventCount} 
        nextEvent={nextEvent} 
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Mail List */}
        <div className="lg:col-span-1">
          <MailList 
            emails={emails} 
            loading={loading} 
            accessToken={accessToken} 
            onRefresh={loadData}
          />
        </div>

        {/* Center Column: Calendar */}
        <div className="lg:col-span-2 h-full">
          <CalendarView accessToken={accessToken} refreshTrigger={refreshKey} />
        </div>

        {/* Right Column: Task List */}
        <div className="lg:col-span-1 h-full">
          <TaskList accessToken={accessToken} refreshTrigger={refreshKey} />
        </div>
      </div>

      {/* Bottom Section: Links and Notes */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-1">
          <FixedLinkList />
        </div>
        <div className="lg:col-span-2">
          <CustomLinkList />
        </div>
        <div className="lg:col-span-2">
          <NotesWidget />
        </div>
      </div>
    </div>
  );
}
