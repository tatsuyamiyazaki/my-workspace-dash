import { useEffect, useRef } from 'react';
import { CalendarEvent, fetchEvents } from '@/lib/calendarApi';
import { useSettings } from '@/contexts/AuthContext';
import { addMinutes, isAfter, isBefore, parseISO } from 'date-fns';

interface EventNotificationsProps {
  accessToken: string | null;
}

export default function EventNotifications({ accessToken }: EventNotificationsProps) {
  const { notificationMinutes, notificationsEnabled } = useSettings();
  const notifiedEventsRef = useRef<Set<string>>(new Set());
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const showNotification = (event: CalendarEvent, minutesBefore: number) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      const startTime = event.start.dateTime ? parseISO(event.start.dateTime) : null;
      const timeStr = startTime ? startTime.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '';

      new Notification(`📅 ${minutesBefore}分後に予定があります`, {
        body: `${event.summary}\n${timeStr}`,
        icon: '/favicon.ico',
        tag: `event-${event.id}-${minutesBefore}`,
        requireInteraction: false,
        silent: false,
      });
    }
  };

  useEffect(() => {
    if (!accessToken || !notificationsEnabled) {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      return;
    }

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const checkUpcomingEvents = async () => {
      try {
        const now = new Date();
        const soon = addMinutes(now, Math.max(...notificationMinutes) + 5);

        // Fetch upcoming events
        const events = await fetchEvents(accessToken, now, soon);

        events.forEach((event) => {
          const startTime = event.start.dateTime ? parseISO(event.start.dateTime) : null;
          if (!startTime) return; // Skip all-day events

          notificationMinutes.forEach((minutes) => {
            const notificationTime = addMinutes(startTime, -minutes);
            const notificationKey = `${event.id}-${minutes}`;

            // Check if it's time to notify and we haven't notified yet
            if (
              isAfter(now, notificationTime) &&
              isBefore(now, startTime) &&
              !notifiedEventsRef.current.has(notificationKey)
            ) {
              showNotification(event, minutes);
              notifiedEventsRef.current.add(notificationKey);

              // Clean up old notifications after event passes
              setTimeout(() => {
                notifiedEventsRef.current.delete(notificationKey);
              }, (minutes + 10) * 60 * 1000);
            }
          });
        });
      } catch (error) {
        console.error('Failed to check upcoming events:', error);
      }
    };

    // Check immediately
    checkUpcomingEvents();

    // Then check every minute
    checkIntervalRef.current = setInterval(checkUpcomingEvents, 60000);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [accessToken, notificationsEnabled, notificationMinutes]);

  return null; // This component doesn't render anything
}
