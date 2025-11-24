import { Mail, Calendar, Clock } from 'lucide-react';
import { CalendarEvent } from '@/lib/calendarApi';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface SummaryCardsProps {
  unreadCount?: number;
  todayEventCount?: number;
  nextEvent?: CalendarEvent | null;
}

export default function SummaryCards({ unreadCount = 0, todayEventCount = 0, nextEvent }: SummaryCardsProps) {
  const formatNextEventTime = (event: CalendarEvent) => {
    if (event.start.date) {
      return format(new Date(event.start.date), 'MM/dd (全日)', { locale: ja });
    }
    if (event.start.dateTime) {
      return format(new Date(event.start.dateTime), 'HH:mm', { locale: ja }) + ' - ' + event.summary;
    }
    return '';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
      {/* Unread Emails */}
      <div className="bg-white dark:bg-[#1e293b] py-2 px-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">未読メール数</h3>
          <div className="text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">
            <Mail className="w-5 h-5" />
          </div>
        </div>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{unreadCount}</p>
      </div>


      {/* Today's Schedule */}
      <div className="bg-white dark:bg-[#1e293b] py-2 px-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">本日の予定</h3>
          <div className="text-blue-500 bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{todayEventCount}</p>
      </div>

      {/* Next Schedule */}
      <div className="bg-white dark:bg-[#1e293b] py-2 px-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">次の予定</h3>
          <div className="text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="mt-1">
          {nextEvent ? (
            <p className="text-lg font-bold text-gray-900 dark:text-white truncate" title={nextEvent.summary}>
              {formatNextEventTime(nextEvent)}
            </p>
          ) : (
            <p className="text-lg font-bold text-gray-400 dark:text-gray-500">予定なし</p>
          )}
        </div>
      </div>
    </div>
  );
}
