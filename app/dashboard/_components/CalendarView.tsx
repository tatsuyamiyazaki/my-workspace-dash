import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, X, Plus, Maximize2, Minimize2, Video } from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addWeeks, 
  subWeeks, 
  addDays, 
  subDays,
  startOfDay,
  endOfDay,
  isToday
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarEvent, fetchEvents, updateEvent, deleteEvent, createEvent, getEvent, fetchCalendarColors, CalendarColors, DEFAULT_EVENT_COLORS } from '@/lib/calendarApi';
import { useAuth } from '@/contexts/AuthContext';
import RecurrenceEditor from './RecurrenceEditor';

interface CalendarViewProps {
  accessToken?: string | null;
  refreshTrigger?: number;
}

type ViewMode = 'month' | 'week' | 'day';

// 色の名前定義（日本語）
const COLOR_NAMES: Record<string, string> = {
  '1': 'ラベンダー',
  '2': 'セージ',
  '3': 'グレープ',
  '4': 'フラミンゴ',
  '5': 'バナナ',
  '6': 'ミカン',
  '7': 'ピーコック',
  '8': 'グラファイト',
  '9': 'ブルーベリー',
  '10': 'バジル',
  '11': 'トマト',
};


export default function CalendarView({ accessToken, refreshTrigger }: CalendarViewProps) {
  const { setAccessToken, getValidAccessToken } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [now, setNow] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedDateEvents, setSelectedDateEvents] = useState<{ date: Date, events: CalendarEvent[] } | null>(null);
  const [isModalMaximized, setIsModalMaximized] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [hoveredSlot, setHoveredSlot] = useState<{ date: Date, top: number } | null>(null);
  const [dragSelection, setDragSelection] = useState<{ date: Date, startY: number, currentY: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [eventColors, setEventColors] = useState<CalendarColors['event']>(DEFAULT_EVENT_COLORS);
  const timelineRef = useRef<HTMLDivElement>(null);

  // イベントの色を取得するヘルパー関数
  const getEventColor = useCallback((event: CalendarEvent) => {
    // イベント自体にbackgroundColorが設定されている場合はそれを使用
    if (event.backgroundColor) {
      return {
        background: event.backgroundColor,
        foreground: event.foregroundColor || '#1d1d1d'
      };
    }
    // colorIdがある場合は色定義から取得
    if (event.colorId && eventColors[event.colorId]) {
      return eventColors[event.colorId];
    }
    // デフォルト色（ピーコック/colorId=7相当）
    return eventColors['7'] || DEFAULT_EVENT_COLORS['7'];
  }, [eventColors]);

  const extractConferenceLink = (event: CalendarEvent): { url: string, type: 'google_meet' | 'teams' | 'zoom' | 'other', iconUri?: string, name?: string } | null => {
    // 1. Check conferenceData (Structure data from Google/Add-ons)
    if (event.conferenceData && event.conferenceData.entryPoints) {
      const videoEntryPoint = event.conferenceData.entryPoints.find(ep => ep.entryPointType === 'video');
      if (videoEntryPoint) {
        const solution = event.conferenceData.conferenceSolution;
        return {
          url: videoEntryPoint.uri,
          type: 'other', // We can refine this if needed, but iconUri is the key
          iconUri: solution?.iconUri,
          name: solution?.name
        };
      }
    }

    // 2. Fallback to Regex search in location/description
    const textToSearch = `${event.location || ''} ${event.description || ''}`;
    
    const patterns = [
      { regex: /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^>\s"]+/, type: 'teams' as const },
      { regex: /https:\/\/[a-z0-9-]+\.zoom\.us\/j\/[^>\s"]+/, type: 'zoom' as const },
      { regex: /https:\/\/meet\.google\.com\/[a-z-]+/, type: 'google_meet' as const }
    ];

    for (const { regex, type } of patterns) {
      const match = textToSearch.match(regex);
      if (match) {
        return { url: match[0], type };
      }
    }
    
    return null;
  };

  // loadEventsをuseCallbackでメモ化する
  const loadEvents = useCallback(async () => {
    if (!accessToken) return;

    let start: Date, end: Date;

    if (viewMode === 'month') {
      start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
      end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    } else if (viewMode === 'week') {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    } else {
      start = startOfDay(currentDate);
      end = endOfDay(currentDate);
    }

    try {
      setLoading(true);
      // 有効なトークンを取得（期限切れなら自動更新）
      const validToken = await getValidAccessToken();
      if (!validToken) {
        setAccessToken(null);
        return;
      }
      const fetchedEvents = await fetchEvents(validToken, start, end);
      setEvents(fetchedEvents);
    } catch (error: unknown) {
      console.error("Failed to fetch calendar events", error);
      if (error instanceof Error && error.message.includes('401')) {
        setAccessToken(null); // Token expired, force re-login
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, currentDate, viewMode, setAccessToken, getValidAccessToken]);

  // Google Calendar Colors APIから色定義を取得
  useEffect(() => {
    const loadColors = async () => {
      if (!accessToken) return;
      try {
        const validToken = await getValidAccessToken();
        if (!validToken) return;
        const colors = await fetchCalendarColors(validToken);
        if (colors.event) {
          setEventColors(colors.event);
        }
      } catch (error) {
        console.error("Failed to fetch calendar colors", error);
        // エラーの場合はデフォルト色を使用（既に設定済み）
      }
    };
    loadColors();
  }, [accessToken, getValidAccessToken]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Scroll to current time when viewMode is week or day
  useEffect(() => {
    if (timelineRef.current && (viewMode === 'week' || viewMode === 'day')) {
      const currentHour = now.getHours();
      const scrollPosition = (currentHour - 1) * 60; // Scroll to one hour before current hour
      timelineRef.current.scrollTop = scrollPosition;
    }
  }, [viewMode, now]);

  // Fetch events when date or view mode changes
  useEffect(() => {
    loadEvents();
  }, [loadEvents, refreshTrigger]);

  // Escキー対応
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // 予定編集モーダルが開いている場合は閉じる
        if (editingEvent) {
          setEditingEvent(null);
        }
        // 日付イベント詳細モーダルが開いている場合は閉じる
        else if (selectedDateEvents) {
          setSelectedDateEvents(null);
          setIsModalMaximized(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editingEvent, selectedDateEvents]);

  const closeEventsModal = () => {
    setSelectedDateEvents(null);
    setIsModalMaximized(false);
  };

  const handleEventClick = async (event: CalendarEvent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEvent(event);

    // 繰り返し予定のインスタンスの場合、マスターイベントから繰り返し設定を取得する
    if (event.recurringEventId && accessToken) {
      try {
        const masterEvent = await getEvent(accessToken, event.recurringEventId);
        if (masterEvent.recurrence) {
          setEditingEvent(prev => prev ? { ...prev, recurrence: masterEvent.recurrence } : null);
        }
      } catch (error) {
        console.error("Failed to fetch master event for recurrence", error);
      }
    }
  };

  const handleCreateClick = () => {
    const now = new Date();
    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    const end = addDays(start, 0);
    end.setHours(start.getHours() + 1);
    end.setMinutes(0, 0, 0);

    setEditingEvent({
      id: '', // Empty ID marks it as new
      summary: '',
      description: '',
      location: '',
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      htmlLink: '',
      colorId: '7', // Default blue-ish
      recurrence: []
    });
  };

  const handleMouseDown = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left click
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const HOUR_HEIGHT = 60;
    const clickedHourFromStart = y / HOUR_HEIGHT;
    const snappedHoursFromStart = Math.floor(clickedHourFromStart * 2) / 2;
    const top = snappedHoursFromStart * HOUR_HEIGHT;

    setDragSelection({ date: day, startY: top, currentY: top });
  };

  const handleMouseMove = (day: Date, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const HOUR_HEIGHT = 60;
    const clickedHourFromStart = y / HOUR_HEIGHT;
    const snappedHoursFromStart = Math.floor(clickedHourFromStart * 2) / 2;
    const top = snappedHoursFromStart * HOUR_HEIGHT;

    if (dragSelection && isSameDay(day, dragSelection.date)) {
      setDragSelection({ ...dragSelection, currentY: top });
    } else {
      setHoveredSlot({ date: day, top });
    }
  };

  const handleMouseUp = (day: Date) => {
    if (!dragSelection) return;
    
    const { startY, currentY } = dragSelection;
    const minY = Math.min(startY, currentY);
    const maxY = Math.max(startY, currentY);
    
    const HOUR_HEIGHT = 60;
    
    // Calculate start time
    const startHoursFromStart = minY / HOUR_HEIGHT;
    const startHour = 1 + Math.floor(startHoursFromStart);
    const startMinute = (startHoursFromStart % 1) * 60;
    
    const startDate = new Date(day);
    startDate.setHours(startHour, startMinute, 0, 0);
    
    // Calculate end time
    let endDate = new Date(startDate);
    
    if (minY === maxY) {
        // Click (no drag) -> 1 hour default
        endDate.setHours(startDate.getHours() + 1);
    } else {
        // Drag -> Range inclusive of the end slot
        const endHoursFromStart = maxY / HOUR_HEIGHT;
        const endHour = 1 + Math.floor(endHoursFromStart);
        const endMinute = (endHoursFromStart % 1) * 60;
        endDate = new Date(day);
        endDate.setHours(endHour, endMinute + 30, 0, 0);
    }

    setEditingEvent({
      id: '',
      summary: '',
      description: '',
      location: '',
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
      htmlLink: '',
      colorId: '7',
      recurrence: []
    });
    
    setDragSelection(null);
  };

  const handleMouseLeave = () => {
    setHoveredSlot(null);
    // Optional: Cancel drag if leaving the column? 
    // For now, let's keep drag active but maybe reset if they release outside.
    // But to be safe, we can just clear hover.
  };

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !editingEvent) return;

    try {
      setIsSaving(true);
      if (editingEvent.id) {
        await updateEvent(accessToken, editingEvent.id, editingEvent);
      } else {
        await createEvent(accessToken, editingEvent);
      }
      await loadEvents(); // Refresh events
      setEditingEvent(null);
    } catch (error) {
      console.error("Failed to save event", error);
      alert("イベントの保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEvent = async () => {
    if (!accessToken || !editingEvent || !confirm("このイベントを削除してもよろしいですか？")) return;

    try {
      setIsSaving(true);
      await deleteEvent(accessToken, editingEvent.id);
      await loadEvents(); // Refresh events
      setEditingEvent(null);
    } catch (error) {
      console.error("Failed to delete event", error);
      alert("イベントの削除に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const next = () => {
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const prev = () => {
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else setCurrentDate(subDays(currentDate, 1));
  };

  const getEventsForDate = (date: Date) => {
    return events.filter(event => {
      const eventStart = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date!);
      return isSameDay(eventStart, date);
    });
  };

  const handleDateClick = (date: Date) => {
    const daysEvents = getEventsForDate(date);
    setSelectedDateEvents({ date, events: daysEvents });
  };

  const renderHeader = () => {
    const dateFormat = viewMode === 'day' ? 'yyyy年MM月dd日' : 'yyyy年MM月';
    return (
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button onClick={prev} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ChevronLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            {format(currentDate, dateFormat, { locale: ja })}
          </h2>
          <button onClick={next} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
            <ChevronRight className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateClick}
            className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>作成</span>
          </button>
          <div className="flex bg-gray-100 dark:bg-slate-800 rounded-lg p-1">
            <button 
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'day' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              日
            </button>
            <button 
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'week' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              週
            </button>
            <button 
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-all ${viewMode === 'month' ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              月
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

    return (
      <>
        <div className="grid grid-cols-7 mb-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-sm font-medium text-gray-500 dark:text-gray-400 py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-2">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDate(day);
            const hasEvent = dayEvents.length > 0;
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isTodayDate = isToday(day);

            return (
              <div key={idx} className="flex flex-col items-center justify-center py-2 relative group">
                <button
                  onClick={() => handleDateClick(day)}
                  className={`
                    w-8 h-8 flex items-center justify-center rounded-full text-sm font-medium transition-colors
                    ${isTodayDate 
                      ? 'bg-blue-600 text-white' 
                      : isCurrentMonth 
                        ? 'text-gray-900 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800' 
                        : 'text-gray-400 dark:text-gray-600'
                    }
                  `}
                >
                  {format(day, 'd')}
                </button>
                {hasEvent && !isTodayDate && (
                  <div className="w-1 h-1 bg-blue-500 rounded-full mt-1"></div>
                )}
              </div>
            );
          })}
        </div>
      </>
    );
  };

  const renderTimelineView = (days: Date[], showHeader: boolean = true) => {
    const hours = Array.from({ length: 24 }, (_, i) => i + 1); // 1..24
    const HOUR_HEIGHT = 60;

    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Header (Dates) */}
        {showHeader && (
          <div className="flex border-b border-gray-200 dark:border-slate-700 flex-shrink-0 pr-2"> {/* pr-2 for scrollbar */}
            <div className="w-14 flex-shrink-0"></div> {/* Time column spacer */}
            <div className={`grid flex-1 ${days.length === 1 ? 'grid-cols-1' : 'grid-cols-7'}`}>
              {days.map((day, i) => (
                <div key={i} className={`text-center py-2 border-l border-gray-100 dark:border-slate-800 ${isToday(day) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{format(day, 'E', { locale: ja })}</div>
                  <div className={`text-sm font-bold ${isToday(day) ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
                    {format(day, 'd')}
                  </div>
                  {/* All day events could go here */}
                  <div className="min-h-[20px]">
                    {getEventsForDate(day).filter(e => e.start.date).map(e => {
                      const eventColor = getEventColor(e);
                      return (
                        <div
                          key={e.id}
                          onClick={(ev) => handleEventClick(e, ev)}
                          className="text-[10px] rounded px-1 mb-0.5 truncate mx-1 cursor-pointer hover:opacity-80"
                          style={{
                            backgroundColor: `${eventColor.background}30`,
                            color: eventColor.background,
                          }}
                        >
                          {e.summary}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Timeline Body */}
        <div className="flex-1 overflow-y-auto relative" ref={timelineRef}>
          <div className="flex" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
            {/* Time Labels */}
            <div className="w-14 flex-shrink-0 border-r border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
              {hours.map((hour) => (
                <div key={hour} className="relative" style={{ height: `${HOUR_HEIGHT}px` }}>
                  <span className="absolute -top-3 right-2 text-xs text-gray-400 dark:text-gray-500">
                    {hour}:00
                  </span>
                  <div className="absolute top-0 right-0 w-2 border-t border-gray-200 dark:border-slate-700"></div>
                </div>
              ))}
            </div>

            {/* Grid & Events */}
            <div className={`grid flex-1 ${days.length === 1 ? 'grid-cols-1' : 'grid-cols-7'} relative`}>
              {/* Horizontal Grid Lines */}
              <div className="absolute inset-0 pointer-events-none z-0">
                {hours.map((hour) => (
                  <div key={hour} className="border-t border-gray-100 dark:border-slate-800/50 w-full" style={{ height: `${HOUR_HEIGHT}px` }}></div>
                ))}
              </div>

              {/* Columns */}
              {days.map((day, colIndex) => {
                const dayEvents = getEventsForDate(day);
                const isDragging = dragSelection && isSameDay(day, dragSelection.date);
                const isHoveredDay = hoveredSlot && isSameDay(day, hoveredSlot.date) && !isDragging;
                const isTodayNow = isSameDay(day, now);

                return (
                  <div 
                    key={colIndex} 
                    className="relative border-l border-gray-100 dark:border-slate-800 first:border-l-0 h-full cursor-pointer select-none"
                    onMouseDown={(e) => handleMouseDown(day, e)}
                    onMouseMove={(e) => handleMouseMove(day, e)}
                    onMouseUp={() => handleMouseUp(day)}
                    onMouseLeave={handleMouseLeave}
                  >
                    {/* Current Time Line */}
                    {isTodayNow && (
                      <div 
                        className="absolute w-full border-t-2 border-red-500 z-20 pointer-events-none"
                        style={{ top: `${((now.getHours() * 60 + now.getMinutes()) - 60)}px` }}
                      >
                        <div className="absolute -left-1.5 -top-1.5 w-3 h-3 bg-red-500 rounded-full"></div>
                      </div>
                    )}

                    {/* Drag Selection or Ghost */}
                    {(isHoveredDay || isDragging) && (
                      <div 
                        className="absolute inset-x-1 bg-blue-500/10 dark:bg-blue-400/10 rounded border border-blue-500/30 pointer-events-none z-0"
                        style={{
                          top: `${isDragging ? Math.min(dragSelection!.startY, dragSelection!.currentY) : hoveredSlot?.top}px`,
                          height: `${isDragging 
                            ? (Math.abs(dragSelection!.currentY - dragSelection!.startY) + (dragSelection!.startY === dragSelection!.currentY ? 60 : 30))
                            : 60}px`
                        }}
                      >
                        <div className="text-[10px] text-blue-600 dark:text-blue-300 px-1 font-medium">
                          {isDragging ? '範囲選択中' : '新規作成'}
                        </div>
                      </div>
                    )}

                    {dayEvents.map((event) => {
                      if (!event.start.dateTime) return null; // Skip all-day events in timeline

                      const start = new Date(event.start.dateTime);
                      const end = event.end.dateTime ? new Date(event.end.dateTime) : addDays(start, 1); // Fallback

                      // Calculate position relative to 1:00
                      const startHour = start.getHours();
                      const startMin = start.getMinutes();

                      // Minutes from 1:00
                      let minutesFromStart = (startHour * 60 + startMin) - 60;
                      if (minutesFromStart < 0) minutesFromStart = 0; // Clip to top

                      const durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);

                      const top = (minutesFromStart / 60) * HOUR_HEIGHT;
                      const height = (durationMinutes / 60) * HOUR_HEIGHT;

                      const conferenceData = extractConferenceLink(event);
                      const eventColor = getEventColor(event);

                      return (
                        <div
                          key={event.id}
                          onClick={(e) => handleEventClick(event, e)}
                          className="absolute inset-x-1 rounded border-l-4 p-1 overflow-hidden cursor-pointer hover:opacity-90 z-10 text-xs shadow-sm group"
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(24, height)}px`,
                            backgroundColor: `${eventColor.background}20`,
                            borderLeftColor: eventColor.background,
                          }}
                          title={`${event.summary} (${format(start, 'HH:mm')} - ${format(end, 'HH:mm')})`}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <div
                              className="font-bold truncate flex-1"
                              style={{ color: eventColor.background }}
                            >
                              {event.summary}
                            </div>
                            {conferenceData && (
                              <div className="flex-shrink-0" title={conferenceData.name || 'Web会議'}>
                                {conferenceData.iconUri ? (
                                  /* eslint-disable-next-line @next/next/no-img-element */
                                  <img src={conferenceData.iconUri} alt="Conference" className="w-3.5 h-3.5" />
                                ) : (
                                  <Video className="w-3.5 h-3.5" style={{ color: eventColor.background }} />
                                )}
                              </div>
                            )}
                          </div>
                          <div
                            className="truncate text-[10px]"
                            style={{ color: eventColor.background, opacity: 0.8 }}
                          >
                            {format(start, 'HH:mm')} - {format(end, 'HH:mm')}
                          </div>
                          {event.location && (
                            <div
                              className="truncate text-[9px] mt-0.5"
                              style={{ color: eventColor.background, opacity: 0.7 }}
                            >
                              {event.location}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentDate, { weekStartsOn: 1 });
    const days = [...Array(7)].map((_, i) => addDays(startDate, i));
    return renderTimelineView(days);
  };

  const renderDayView = () => {
    return renderTimelineView([currentDate]);
  };

  return (
    <>
      <div className="bg-white dark:bg-[#1e293b] p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 h-[480px] flex flex-col">
        {renderHeader()}
        <div className="flex-1 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : (
            <>
              {viewMode === 'month' && renderMonthView()}
              {viewMode === 'week' && renderWeekView()}
              {viewMode === 'day' && renderDayView()}
            </>
          )}
        </div>
      </div>

      {/* Day Events Modal (for Month View) */}
      {selectedDateEvents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col transition-all ${
            isModalMaximized ? 'max-w-none max-h-none h-full m-0' : 'max-w-md h-[70vh]'
          }`}>
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-900/50 flex-shrink-0">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {format(selectedDateEvents.date, 'yyyy年MM月dd日', { locale: ja })} の予定
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsModalMaximized(!isModalMaximized)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                  title={isModalMaximized ? '元のサイズに戻す' : '最大化'}
                >
                  {isModalMaximized ? <Minimize2 className="w-5 h-5 text-gray-500 dark:text-gray-400" /> : <Maximize2 className="w-5 h-5 text-gray-500 dark:text-gray-400" />}
                </button>
                <button
                  onClick={closeEventsModal}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {renderTimelineView([selectedDateEvents.date], false)}
            </div>
            <div className="p-3 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-end flex-shrink-0">
              <button
                onClick={closeEventsModal}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Event Modal */}
      {editingEvent && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <form onSubmit={handleSaveEvent}>
              <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between bg-gray-50 dark:bg-slate-900/50">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  {editingEvent.id ? '予定の編集' : '予定の作成'}
                </h3>
                <button 
                  type="button"
                  onClick={() => setEditingEvent(null)}
                  className="p-2 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                {/* Conference Link Button if exists */}
                {(() => {
                  const conferenceData = extractConferenceLink(editingEvent);
                  if (conferenceData) {
                    return (
                      <a 
                        href={conferenceData.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm mb-4"
                      >
                        {conferenceData.iconUri ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={conferenceData.iconUri} alt="Conference" className="w-5 h-5 bg-white rounded-full p-0.5" />
                        ) : (
                          <Video className="w-5 h-5" />
                        )}
                        <span>{conferenceData.name ? `${conferenceData.name}に参加する` : 'Web会議に参加する'}</span>
                      </a>
                    );
                  }
                  return null;
                })()}

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タイトル</label>
                  <input
                    type="text"
                    value={editingEvent.summary}
                    onChange={(e) => setEditingEvent({ ...editingEvent, summary: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                    placeholder="タイトルを追加"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">開始日時</label>
                    <input
                      type="datetime-local"
                      value={editingEvent.start.dateTime ? format(new Date(editingEvent.start.dateTime), "yyyy-MM-dd'T'HH:mm") : ''}
                      onChange={(e) => setEditingEvent({
                        ...editingEvent,
                        start: { ...editingEvent.start, dateTime: new Date(e.target.value).toISOString() }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      required={!!editingEvent.start.dateTime}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">終了日時</label>
                    <input
                      type="datetime-local"
                      value={editingEvent.end.dateTime ? format(new Date(editingEvent.end.dateTime), "yyyy-MM-dd'T'HH:mm") : ''}
                      onChange={(e) => setEditingEvent({
                        ...editingEvent,
                        end: { ...editingEvent.end, dateTime: new Date(e.target.value).toISOString() }
                      })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      required={!!editingEvent.end.dateTime}
                    />
                  </div>
                </div>

                {/* Recurrence */}
                <RecurrenceEditor
                  value={editingEvent.recurrence || []}
                  onChange={(recurrence) => setEditingEvent({ ...editingEvent, recurrence })}
                />
                
                {/* Location */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">場所</label>
                  <input
                    type="text"
                    value={editingEvent.location || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="場所を追加"
                  />
                </div>

                {/* Color Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">色</label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(eventColors).map(([colorId, colorValue]) => (
                      <button
                        key={colorId}
                        type="button"
                        onClick={() => setEditingEvent({ ...editingEvent, colorId })}
                        className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${editingEvent.colorId === colorId ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-slate-800' : ''}`}
                        style={{ backgroundColor: colorValue.background }}
                        title={COLOR_NAMES[colorId] || `色 ${colorId}`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">詳細</label>
                  <textarea
                    value={editingEvent.description || ''}
                    onChange={(e) => setEditingEvent({ ...editingEvent, description: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                    placeholder="詳細を追加"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 flex justify-between items-center">
                {editingEvent.id ? (
                  <button
                    type="button"
                    onClick={handleDeleteEvent}
                    disabled={isSaving}
                    className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    削除
                  </button>
                ) : (
                  <div></div> // Spacer
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingEvent(null)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
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
