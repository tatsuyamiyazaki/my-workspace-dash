import { startOfDay, endOfDay, addDays } from 'date-fns';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string; // 終日イベント用
  };
  end: {
    dateTime?: string;
    date?: string;
  };
  htmlLink: string;
  recurrence?: string[];
  recurringEventId?: string;
  colorId?: string;
}

/**
 * 指定された期間のイベントを取得する
 */
export const fetchEvents = async (
  accessToken: string,
  timeMin: Date,
  timeMax: Date
): Promise<CalendarEvent[]> => {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
  });

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Calendar API Error: ${res.status}`, errorBody);
    throw new Error(`Failed to fetch calendar events: ${res.status}`);
  }

  const data = await res.json();
  return data.items || [];
};

export const getEvent = async (accessToken: string, eventId: string): Promise<CalendarEvent> => {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Calendar API Get Error: ${res.status}`, errorBody);
    throw new Error(`Failed to get event: ${res.status}`);
  }

  return await res.json();
};

export const createEvent = async (accessToken: string, event: Partial<CalendarEvent>) => {
  const body: any = {
    summary: event.summary,
    description: event.description,
    start: event.start,
    end: event.end,
    recurrence: event.recurrence,
    colorId: event.colorId,
  };

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Calendar API Create Error: ${res.status}`, errorBody);
    throw new Error(`Failed to create event: ${res.status}`);
  }

  return await res.json();
};

export const deleteEvent = async (accessToken: string, eventId: string) => {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Calendar API Delete Error: ${res.status}`, errorBody);
    throw new Error(`Failed to delete event: ${res.status}`);
  }
};

export const updateEvent = async (accessToken: string, eventId: string, event: Partial<CalendarEvent>) => {
  // API expects specific format for updates, ensure we only send what's needed
  const body: any = {
    summary: event.summary,
    description: event.description,
    colorId: event.colorId,
  };

  // インスタンス（繰り返し予定の1つ）の場合、recurrenceフィールドを送るとエラーになるため除外する
  // ただし、マスターイベント（recurringEventIdがない）の場合は送る
  if (!event.recurringEventId) {
    body.recurrence = event.recurrence;
  }

  if (event.start) body.start = event.start;
  if (event.end) body.end = event.end;

  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errorBody = await res.text();
    console.error(`Calendar API Update Error: ${res.status}`, errorBody);
    throw new Error(`Failed to update event: ${res.status}`);
  }

  return await res.json();
};

/**
 * 今日の予定と次の予定を取得するためのヘルパー関数
 */
export const fetchDashboardCalendarData = async (accessToken: string) => {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  
  // 今日〜明日までのイベントを取得して、次の予定も探せるようにする
  const nextDayEnd = endOfDay(addDays(now, 7)); // 1週間先まで見ておく

  const events = await fetchEvents(accessToken, todayStart, nextDayEnd);

  // 今日のイベント数
  const todayEvents = events.filter(event => {
    const start = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date!);
    return start >= todayStart && start <= todayEnd;
  });

  // 次の予定（現在時刻以降で最も近いもの）
  const nextEvent = events.find(event => {
    const start = event.start.dateTime ? new Date(event.start.dateTime) : new Date(event.start.date!);
    // 終日イベントは「次の予定」として扱うか微妙だが、現在時刻より後なら含める
    // ここでは単純に開始時刻が現在より後のものを探す
    if (event.start.date) {
        // 終日イベントの場合、その日の0時が開始時間。
        // もし今日が終日イベントの日なら、それは「進行中」または「今日」の予定。
        // 「次の予定」としては、明日以降の終日イベントか、今日のこれからの時間指定イベント。
        return start > now;
    }
    return start > now;
  });

  return {
    todayEventCount: todayEvents.length,
    nextEvent: nextEvent || null,
  };
};
