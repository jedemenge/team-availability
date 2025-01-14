import React, { useEffect, useRef } from 'react';
import { format, isEqual, startOfDay, endOfDay, isWeekend, eachDayOfInterval, differenceInMinutes, differenceInHours, parse, addMinutes } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { useStore } from '../store/useStore';
import { Calendar } from 'lucide-react';

interface DayGroup {
  date: Date;
  events: typeof events;
  hasOOFEvents: boolean;
}

export function EventList() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastFirstVisibleDate = useRef<Date | null>(null);
  const { events, startDate, endDate, visibleEmails, teamSettings, hiddenEventTypes, minDuration, language } = useStore();
  const safeEvents = events || [];

  const translations = {
    'en-US': {
      loadPreviousWeek: 'Load previous week',
      available: 'Available',
      lunch: 'Lunch',
      allDay: 'All day',
      outOfOffice: 'Out of Office',
      busy: 'Busy'
    },
    'nl-NL': {
      loadPreviousWeek: 'Vorige week laden',
      available: 'Beschikbaar',
      lunch: 'Lunch',
      allDay: 'Hele dag',
      outOfOffice: 'Out of Office',
      busy: 'Bezet'
    }
  };

  const t = translations[language];
  const locale = language === 'nl-NL' ? nl : enUS;

  const createLunchEvent = (date: Date) => {
    const lunchStart = parse(teamSettings.lunchBreak.start, 'HH:mm', date);
    const lunchEnd = parse(teamSettings.lunchBreak.end, 'HH:mm', date);
    return {
      id: 'lunch',
      type: 'lunch',
      start: lunchStart,
      end: lunchEnd
    };
  };

  const sortDayEvents = (date: Date, dayEvents: typeof events) => {
    // Filter visible events for display
    const visibleEvents = dayEvents ? dayEvents.filter(event => 
      !hiddenEventTypes.includes(event.status)
    ) : [];

    // Use all events for availability calculation
    const availableIntervals = getAvailableIntervals(date, dayEvents);
    const lunch = createLunchEvent(date);
    
    // Combine all events and intervals
    const allEvents = [
      ...visibleEvents
        .map(event => ({ ...event, type: event.status })),
      ...availableIntervals.map((interval, index) => ({
        id: `available-${index}`,
        type: 'available',
        start: interval.start,
        end: interval.end
      })),
      lunch
    ];

    // Sort events considering lunch break position
    return allEvents.sort((a, b) => {
      // If one event ends before or at lunch end and the other starts after
      const aMainlyBeforeLunch = a.end <= lunch.end || 
        (a.start < lunch.end && (a.end.getTime() - lunch.end.getTime()) < (lunch.end.getTime() - a.start.getTime()));
      const bMainlyBeforeLunch = b.end <= lunch.end || 
        (b.start < lunch.end && (b.end.getTime() - lunch.end.getTime()) < (lunch.end.getTime() - b.start.getTime()));
      
      // If one event is mainly before lunch and the other isn't
      if (aMainlyBeforeLunch && !bMainlyBeforeLunch) return -1;
      if (!aMainlyBeforeLunch && bMainlyBeforeLunch) return 1;
      
      // Otherwise sort by start time
      return a.start.getTime() - b.start.getTime();
    });
  };


  const getAvailableIntervals = (date: Date, dayEvents: typeof events) => {
    const intervals: { start: Date; end: Date }[] = [];
    
    // Check for all-day OOF or busy events first
    if (dayEvents && dayEvents.some(event => {
      const isOOFOrBusy = event.status === 'oof' || event.status === 'busy'; // Keep checking both types for availability
      const isFullDay = (event as any).isFullDay;
      return isOOFOrBusy && isFullDay;
    })) {
      return intervals; // Return empty intervals if there's an all-day event
    }
    
    const officeStart = parse(teamSettings.officeHours.start, 'HH:mm', date);
    const officeEnd = parse(teamSettings.officeHours.end, 'HH:mm', date);
    const lunchStart = parse(teamSettings.lunchBreak.start, 'HH:mm', date);
    const lunchEnd = parse(teamSettings.lunchBreak.end, 'HH:mm', date);
    
    if (!dayEvents || dayEvents.length === 0) {
      if (lunchStart > officeStart) {
        intervals.push({
          start: officeStart,
          end: lunchStart
        });
      }
      if (officeEnd > lunchEnd) {
        intervals.push({
          start: lunchEnd,
          end: officeEnd
        });
      }
      return intervals;
    }
    
    // Helper function to merge overlapping intervals
    const mergeIntervals = (intervals: { start: Date; end: Date }[]) => {
      if (intervals.length <= 1) return intervals;
      
      const sortedIntervals = [...intervals].sort((a, b) => a.start.getTime() - b.start.getTime());
      
      const result: { start: Date; end: Date }[] = [sortedIntervals[0]];
      
      for (let i = 1; i < sortedIntervals.length; i++) {
        const current = sortedIntervals[i];
        const last = result[result.length - 1];
        
        if (current.start <= last.end) {
          last.end = new Date(Math.max(last.end.getTime(), current.end.getTime()));
        } else {
          result.push(current);
        }
      }
      
      return result;
    };
    
    // Get all busy periods from events
    const busyPeriods = dayEvents
      .filter(event => {
        const isFullDay = (event as any).isFullDay;
        if (isFullDay) return true;
        return !(event.end <= officeStart || event.start >= officeEnd);
      })
      .map(event => ({
        start: event.start,
        end: event.end
      }));

    // Merge overlapping busy periods
    const mergedBusyPeriods = mergeIntervals(busyPeriods);

    // Start with full office hours split by lunch
    const availablePeriods: { start: Date; end: Date }[] = [];
    
    // Add morning period if it exists
    if (officeStart < lunchStart) {
      availablePeriods.push({
        start: officeStart,
        end: lunchStart
      });
    }
    
    // Add afternoon period if it exists
    if (lunchEnd < officeEnd) {
      availablePeriods.push({
        start: lunchEnd,
        end: officeEnd
      });
    }

    // No available periods if there are no office hours
    if (availablePeriods.length === 0) {
      return [];
    }

    // Split available periods by busy periods
    const result: { start: Date; end: Date }[] = [];
    
    for (const period of availablePeriods) {
      let currentStart = period.start;
      
      for (const busy of mergedBusyPeriods) {
        // If busy period starts after current period ends, skip it
        if (busy.start >= period.end) continue;
        
        // If busy period ends before current start, skip it
        if (busy.end <= currentStart) continue;
        
        // If there's a gap before busy period, add it
        if (busy.start > currentStart) {
          result.push({
            start: currentStart,
            end: busy.start
          });
        }
        
        // Move current start to end of busy period
        currentStart = busy.end;
        
        // If we've moved past period end, break
        if (currentStart >= period.end) break;
      }
      
      // Add remaining time if any
      if (currentStart < period.end) {
        result.push({
          start: currentStart,
          end: period.end
        });
      }
    }

    // Filter out zero-duration intervals and return
    return result.filter(interval => 
      interval.start.getTime() !== interval.end.getTime() &&
      differenceInMinutes(interval.end, interval.start) >= minDuration
    );
  };

  const isIntervalAvailable = (start: Date, end: Date, dayEvents: typeof events) => {
    // This function is no longer needed as we handle availability directly in getAvailableIntervals
    return true;
  };

  // Store the first visible date before view changes
  const storeFirstVisibleDate = () => {
    if (!containerRef.current) return;
    
    const container = containerRef.current;
    const dayElements = container.querySelectorAll('[data-date]');
    
    for (const element of dayElements) {
      const rect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      if (rect.top >= containerRect.top) {
        lastFirstVisibleDate.current = new Date(element.getAttribute('data-date')!);
        break;
      }
    }
  };

  // Restore scroll position when view changes
  useEffect(() => {
    if (!containerRef.current || !lastFirstVisibleDate.current) return;
    const container = containerRef.current;
    const targetElement = container.querySelector(
      `[data-date="${lastFirstVisibleDate.current.toISOString()}"]`
    );
    if (targetElement) {
      targetElement.scrollIntoView({ block: 'start', behavior: 'auto' });
    }
  }, []);

  const formatDuration = (totalMinutes: number) => {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (hours >= 24) {
      return 'Hele dag';
    }
    
    if (hours === 0) {
      return `${minutes}m`;
    } else if (minutes === 0) {
      return `${hours}u`;
    }
    return `${hours}u ${minutes}m`;
  };
  
  // Create array of all days in the date range
  const allDays = eachDayOfInterval({ start: startDate, end: endDate })
    .filter(date => !isWeekend(date))
    .map(date => {
      // Filter events for display only
      const visibleEvents = safeEvents.filter(event => 
        visibleEmails.includes(event.userEmail) &&
        ((event.status === 'oof') || 
         (event.status === 'busy' && !hiddenEventTypes.includes('busy'))) &&
        isEqual(startOfDay(event.start), startOfDay(date))
      );

      // Get all events that affect availability (including ALL busy events)
      const allDayEvents = safeEvents.filter(event => 
        visibleEmails.includes(event.userEmail) && 
        (event.status === 'oof' || event.status === 'busy') &&
        isEqual(startOfDay(event.start), startOfDay(date))
      );
      
      return {
        date,
        events: visibleEvents,
        allEvents: allDayEvents,
        hasEvents: visibleEvents.length > 0
      };
    });

  return (
    <div className="space-y-6" ref={containerRef} onScroll={storeFirstVisibleDate}>
      {allDays.map((day) => (
        <div 
          key={day.date.toISOString()} 
          className="bg-white rounded-lg shadow-sm p-4"
          data-date={day.date.toISOString()}
        >
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-500" />
            {format(day.date, 'EEEE d MMMM yyyy', { locale })}
          </h2>
          <div className="space-y-3">
          {day.hasEvents ? (
            sortDayEvents(day.date, day.allEvents).map((event) => {
                if (event.type === 'lunch') {
                  return (
                    <div
                      key="lunch"
                      className="flex items-center justify-between py-0 px-3 bg-gray-100 rounded-lg"
                    >
                      <p className="font-medium text-gray-700">{t.lunch}</p>
                      <p className="text-sm text-gray-600">
                        {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                      </p>
                    </div>
                  );
                }
                
                if (event.type === 'available') {
                  return (
                    <div 
                      key={event.id}
                      className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                    >
                      <p className="font-medium text-green-800">{t.available}</p>
                      <p className="text-sm text-green-700">
                        {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                      </p>
                    </div>
                  );
                }
                
                if (event.type === 'oof') {
                  return (
                <div
                  key={event.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-purple-50 rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium text-purple-900">{(event as any).userName}</p>
                    <p className="text-sm text-purple-700">{(event as any).subject}</p>
                  </div>
                  <div className="mt-2 sm:mt-0 text-sm text-purple-800">
                    {(event as any).isFullDay ? (
                      <span>{t.allDay}</span>
                    ) : (
                      <span>{format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}</span>
                    )}
                  </div>
                </div>
                  );
                }
                
                if (event.type === 'busy') {
                  return (
                    <div
                      key={event.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-orange-50 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-orange-900">{(event as any).userName}</p>
                        <p className="text-sm text-orange-700">{(event as any).subject}</p>
                      </div>
                      <div className="mt-2 sm:mt-0 text-sm text-orange-800">
                        {(event as any).isFullDay ? (
                          <span>{t.allDay}</span>
                        ) : (
                          <span>{format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}</span>
                        )}
                      </div>
                    </div>
                  );
                }
                
                return null;
              })
            ) : (
              // Show available times and lunch for days without events
              sortDayEvents(day.date, day.allEvents).map((event) => {
                if (event.type === 'lunch') {
                  return (
                    <div
                      key="lunch"
                      className="flex items-center justify-between py-0 px-3 bg-gray-100 rounded-lg"
                    >
                      <p className="font-medium text-gray-700">{t.lunch}</p>
                      <p className="text-sm text-gray-600">
                        {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                      </p>
                    </div>
                  );
                }
                
                if (event.type === 'available') {
                  return (
                    <div 
                      key={event.id}
                      className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                    >
                      <p className="font-medium text-green-800">{t.available}</p>
                      <p className="text-sm text-green-700">
                        {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                      </p>
                    </div>
                  );
                }
                
                return null;
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}