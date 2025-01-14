import { Client } from '@microsoft/microsoft-graph-client';
import { acquireToken } from './auth';
import { startOfDay, endOfDay, eachDayOfInterval, isEqual, differenceInHours } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { useStore } from '../store/useStore';

function generateEventId(event: any, userEmail: string): string {
  // Create a unique ID by combining multiple event properties
  const components = [
    event.start.dateTime,
    event.end.dateTime,
    event.subject || '',
    event.status,
    userEmail
  ];
  return components.join('|');
}

export interface OutOfOfficeEvent {
  id: string;
  subject: string;
  start: Date;
  end: Date;
  userEmail: string;
  userName: string;
}

export async function getGraphClient(): Promise<Client> {
  const token = await acquireToken();
  return Client.init({
    authProvider: (done) => {
      done(null, token);
    },
  });
}

export async function getCurrentUser() {
  const client = await getGraphClient();
  const user = await client.api('/me').select('userPrincipalName,displayName').get();
  return user;
}

export async function getUserDisplayName(email: string): Promise<string> {
  // Check if we have the display name cached
  const store = useStore.getState();
  if (store.displayNames[email]) {
    return store.displayNames[email];
  }

  const client = await getGraphClient();
  try {
    const user = await client.api(`/users/${email}`).select('displayName').get();
    // Cache the display name
    store.setDisplayName(email, user.displayName);
    return user.displayName;
  } catch (error) {
    console.error('Error fetching user display name:', error);
    return email.split('@')[0]; // Fallback to email prefix
  }
}

export async function getOutOfOfficeEvents(
  emails: string[],
  startDate: Date,
  endDate: Date
): Promise<OutOfOfficeEvent[]> {
  const client = await getGraphClient();
  const timeZone = 'Europe/Amsterdam';
  
  // Format dates directly in UTC for the API request
  const utcStartDate = startOfDay(startDate);
  const utcEndDate = endOfDay(endDate);
  
  const scheduleRequest = {
    schedules: emails,
    startTime: {
      dateTime: formatInTimeZone(utcStartDate, 'UTC', "yyyy-MM-dd'T'HH:mm:ss"),
      timeZone: 'UTC',
    },
    endTime: {
      dateTime: formatInTimeZone(utcEndDate, 'UTC', "yyyy-MM-dd'T'HH:mm:ss"),
      timeZone: 'UTC',
    },
    availabilityViewInterval: 60,
  };

  const response = await client.api('/me/calendar/getSchedule').post(scheduleRequest);
  
  let events: OutOfOfficeEvent[] = [];
  
  // Fetch all display names first, even if some are cached
  const displayNames = await Promise.all(
    response.value.map(async schedule => ({
      email: schedule.scheduleId,
      displayName: await getUserDisplayName(schedule.scheduleId)
    }))
  );

  // Create a map for quick lookup
  const displayNameMap = Object.fromEntries(
    displayNames.map(({ email, displayName }) => [email, displayName])
  );

  const processEvent = (item: any, scheduleId: string, displayName: string) => {
    // Convert UTC times to Amsterdam timezone
    const eventStart = new Date(item.start.dateTime + 'Z');
    const eventEnd = new Date(item.end.dateTime + 'Z');
    
    const localStart = new Date(formatInTimeZone(eventStart, timeZone, "yyyy-MM-dd'T'HH:mm:ss"));
    const localEnd = new Date(formatInTimeZone(eventEnd, timeZone, "yyyy-MM-dd'T'HH:mm:ss"));
    
    const startDay = startOfDay(localStart);
    const endDay = startOfDay(localEnd);
    const isMultiDay = !isEqual(startDay, endDay);
    const isFullDay = differenceInHours(localEnd, localStart) >= 23 && 
      localStart.getHours() <= 1 && localEnd.getHours() >= 23;
    const isZeroMinuteEvent = localStart.getTime() === localEnd.getTime();
        
    if (!isMultiDay) {
      // Skip zero-minute events
      if (isZeroMinuteEvent) {
        return [];
      }

      // Single day event
      if (isFullDay) {
        const event = {
          id: generateEventId(item, scheduleId),
          subject: item.subject || (item.status === 'oof' ? 'Out of Office' : 'Busy'),
          start: startOfDay(localStart),
          end: endOfDay(localStart),
          userEmail: scheduleId,
          userName: displayName,
          status: item.status,
          isFullDay: true
        };
        return [event];
      }
      // Regular single-day event
      const event = {
        id: generateEventId(item, scheduleId),
        subject: item.subject || (item.status === 'oof' ? 'Out of Office' : 'Busy'),
        start: localStart,
        end: localEnd,
        userEmail: scheduleId,
        userName: displayName,
        status: item.status,
        isFullDay: false
      };
      return [event];
    }
    
    // For multi-day events, create an event for each day
    const daysInRange = eachDayOfInterval({ 
      start: localStart,
      end: endDay // Use endDay instead of localEnd to avoid extra day
    });
    
    return daysInRange.map(day => {
      const isFirstDay = isEqual(startOfDay(day), startOfDay(localStart));
      const isLastDay = isEqual(startOfDay(day), startOfDay(localEnd));
      const dayStart = isFirstDay ? localStart : startOfDay(day);
      const dayEnd = isLastDay ? localEnd : endOfDay(day);
      const isDayFullDay = differenceInHours(dayEnd, dayStart) >= 23 &&
        (!isFirstDay || localStart.getHours() <= 1) &&
        (!isLastDay || localEnd.getHours() >= 23);

      // Skip if this day's portion has zero duration
      if (dayStart.getTime() === dayEnd.getTime()) {
        return null;
      }
      
      return {
        id: generateEventId({
          ...item,
          start: { dateTime: day.toISOString() },
          end: { dateTime: endOfDay(day).toISOString() }
        }, scheduleId),
        subject: item.subject || (item.status === 'oof' ? 'Out of Office' : 'Busy'),
        start: isDayFullDay ? startOfDay(day) : dayStart,
        end: isDayFullDay ? endOfDay(day) : dayEnd,
        userEmail: scheduleId,
        userName: displayName,
        status: item.status,
        isFullDay: isDayFullDay
      };
    }).filter(Boolean);
  };
  
  for (const schedule of response.value) {
    const displayName = displayNameMap[schedule.scheduleId];
    
    const userEvents = schedule.scheduleItems
      .filter((item: any) => {
        // Only process OOF and busy events, ignore free/tentative/workingElsewhere
        return item.status === 'oof' || item.status === 'busy';
      })
      .flatMap(item => processEvent(item, schedule.scheduleId, displayName));
    
    events.push(...userEvents);
  }
  
  // Merge overlapping OOF events for each user
  const mergedEvents = events.reduce((acc: OutOfOfficeEvent[], event) => {
    if (event.status !== 'oof') {
      acc.push(event);
      return acc;
    }

    // Find an existing overlapping event for the same user
    const overlappingEvent = acc.find(e => 
      e.status === 'oof' &&
      e.userEmail === event.userEmail &&
      e.start <= event.end &&
      e.end >= event.start
    );

    if (overlappingEvent) {
      // Merge the events
      overlappingEvent.start = new Date(Math.min(overlappingEvent.start.getTime(), event.start.getTime()));
      overlappingEvent.end = new Date(Math.max(overlappingEvent.end.getTime(), event.end.getTime()));
      overlappingEvent.subject = [overlappingEvent.subject, event.subject]
        .filter((subject, index, array) => array.indexOf(subject) === index) // Remove duplicates
        .join(', ');
      overlappingEvent.id = generateEventId({
        start: { dateTime: overlappingEvent.start.toISOString() },
        end: { dateTime: overlappingEvent.end.toISOString() },
        subject: overlappingEvent.subject,
        status: 'oof'
      }, overlappingEvent.userEmail);
    } else {
      acc.push(event);
    }

    return acc;
  }, []);
  return mergedEvents;
}