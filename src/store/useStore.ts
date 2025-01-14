import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { OutOfOfficeEvent } from '../lib/graph';
import { startOfDay } from 'date-fns';

interface TeamSettings {
  officeHours: {
    start: string;
    end: string;
  };
  lunchBreak: {
    start: string;
    end: string;
  };
}

interface AppState {
  emails: string[];
  visibleEmails: string[];
  employeeTags: Record<string, string[]>;
  selectedTags: string[];
  displayNames: Record<string, string>;
  addEmail: (email: string) => void;
  removeEmail: (email: string) => void;
  setEmails: (emails: string[]) => void;
  toggleEmailVisibility: (email: string) => void;
  addTagToEmployee: (email: string, tag: string) => void;
  removeTagFromEmployee: (email: string, tag: string) => void;
  toggleTagSelection: (tag: string) => void;
  setDisplayName: (email: string, name: string) => void;
  events: OutOfOfficeEvent[];
  setEvents: (events: OutOfOfficeEvent[]) => void;
  prependEvents: (events: OutOfOfficeEvent[]) => void;
  appendEvents: (events: OutOfOfficeEvent[]) => void;
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  startDate: Date;
  setStartDate: (date: Date) => void;
  endDate: Date;
  setEndDate: (date: Date) => void;
  teamSettings: TeamSettings;
  updateTeamSettings: (settings: Partial<TeamSettings>) => void;
  hiddenEventTypes: string[];
  minDuration: number;
  setMinDuration: (duration: number) => void;
  toggleEventTypeVisibility: (eventType: string) => void;
  language: 'en-US' | 'nl-NL';
  setLanguage: (language: 'en-US' | 'nl-NL') => void;
  isInfoOpen: boolean;
  setInfoOpen: (open: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      emails: [],
      visibleEmails: [],
      employeeTags: {},
      selectedTags: [],
      displayNames: {},
      addEmail: (email) =>
        set((state) => ({
          emails: [...new Set([...state.emails, email])],
          visibleEmails: [...new Set([...state.visibleEmails, email])],
          employeeTags: { ...state.employeeTags, [email]: [] },
        })),
      removeEmail: (email) =>
        set((state) => ({
          emails: state.emails.filter((e) => e !== email),
          visibleEmails: state.visibleEmails.filter((e) => e !== email),
          employeeTags: Object.fromEntries(
            Object.entries(state.employeeTags).filter(([key]) => key !== email)
          ),
          displayNames: Object.fromEntries(
            Object.entries(state.displayNames).filter(([key]) => key !== email)
          ),
        })),
      addTagToEmployee: (email, tag) =>
        set((state) => ({
          employeeTags: {
            ...state.employeeTags,
            [email]: [...new Set([...(state.employeeTags[email] || []), tag])]
          }
        })),
      removeTagFromEmployee: (email, tag) =>
        set((state) => ({
          employeeTags: {
            ...state.employeeTags,
            [email]: (state.employeeTags[email] || []).filter(t => t !== tag)
          }
        })),
      toggleTagSelection: (tag) =>
        set((state) => {
          const newSelectedTags = state.selectedTags.includes(tag)
            ? state.selectedTags.filter(t => t !== tag)
            : [...state.selectedTags, tag];
          
          // Update visible emails based on selected tags
          const newVisibleEmails = newSelectedTags.length === 0
            ? [...state.emails] // Show all if no tags selected
            : state.emails.filter(email => 
                state.employeeTags[email]?.some(tag => newSelectedTags.includes(tag))
              );
          
          return {
            selectedTags: newSelectedTags,
            visibleEmails: newVisibleEmails
          };
        }),
      setEmails: (emails) => set({ emails }),
      toggleEmailVisibility: (email) =>
        set((state) => ({
          visibleEmails: state.visibleEmails.includes(email)
            ? state.visibleEmails.filter((e) => e !== email)
            : [...state.visibleEmails, email],
        })),
      setDisplayName: (email, name) =>
        set((state) => ({ displayNames: { ...state.displayNames, [email]: name } })),
      events: [],
      setEvents: (events) => set({ events }),
      prependEvents: (newEvents) =>
        set((state) => ({
          events: [...newEvents, ...state.events]
            .reduce((acc, current) => {
              const exists = acc.find(event => 
                event.id === current.id && 
                event.userEmail === current.userEmail
              );
              if (!exists) {
                acc.push(current);
              }
              return acc;
            }, [] as OutOfOfficeEvent[])
            .sort((a, b) => startOfDay(a.start).getTime() - startOfDay(b.start).getTime()),
        })),
      appendEvents: (newEvents) =>
        set((state) => ({
          events: [...state.events, ...newEvents]
            .reduce((acc, current) => {
              const exists = acc.find(event => 
                event.id === current.id && 
                event.userEmail === current.userEmail
              );
              if (!exists) {
                acc.push(current);
              }
              return acc;
            }, [] as OutOfOfficeEvent[])
            .sort((a, b) => startOfDay(a.start).getTime() - startOfDay(b.start).getTime()),
        })),
      isSettingsOpen: false,
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),
      startDate: startOfDay(new Date()),
      setStartDate: (date) => set({ startDate: date }),
      endDate: startOfDay(new Date()),
      setEndDate: (date) => set({ endDate: date }),
      teamSettings: {
        officeHours: {
          start: '09:00',
          end: '17:00',
        },
        lunchBreak: {
          start: '12:30',
          end: '13:00',
        },
      },
      language: 'en-US',
      setLanguage: (language) => set({ language }),
      isInfoOpen: false,
      setInfoOpen: (open) => set({ isInfoOpen: open }),
      minDuration: 30,
      setMinDuration: (duration) => set({ minDuration: duration }),
      hiddenEventTypes: ['busy'],
      toggleEventTypeVisibility: (eventType) =>
        set((state) => ({
          hiddenEventTypes: state.hiddenEventTypes.includes(eventType)
            ? state.hiddenEventTypes.filter((type) => type !== eventType)
            : [...state.hiddenEventTypes, eventType],
        })),
      updateTeamSettings: (settings) =>
        set((state) => ({
          teamSettings: { ...state.teamSettings, ...settings },
        })),
    }),
    {
      name: 'ooo-calendar-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Convert date strings back to Date objects for events
          if (state.events) {
            state.events = state.events.map(event => ({
              id: event.id,
              subject: event.subject,
              start: new Date(event.start), // Convert string to Date
              end: new Date(event.end), // Convert string to Date
              userEmail: event.userEmail,
              userName: event.userName,
              status: event.status
            }));
          }

          state.startDate = startOfDay(new Date());
          state.events = state.events || [];
          
          // Ensure visibleEmails is initialized for existing users
          if (!state.visibleEmails) {
            state.visibleEmails = [...state.emails];
          }
        }
      },
    }
  )
);