import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Settings, ChevronUp, Eye, EyeOff, Calendar, Clock, Tag, Info } from 'lucide-react';
import { MsalProvider, useMsal, useIsAuthenticated } from '@azure/msal-react';
import { msalInstance, scopes } from './lib/auth';
import { getCurrentUser, getOutOfOfficeEvents } from './lib/graph';
import { useStore } from './store/useStore';
import { EventList } from './components/EventList';
import { SettingsModal } from './components/SettingsModal';
import { InfoModal } from './components/InfoModal';
import { addDays } from 'date-fns';
import { handleImportSettings } from './lib/importSettings';

function checkAuthConfig() {
  const tenantId = localStorage.getItem('tenantId');
  const clientId = localStorage.getItem('clientId');
  
  if (!tenantId || !clientId) {
    return false;
  }
  
  return true;
}

function AppContent() {
  const { instance } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const { 
    emails, 
    setEmails, 
    language,
    addEmail,
    employeeTags,
    selectedTags,
    toggleTagSelection,
    events, 
    setEvents, 
    setInfoOpen,
    startDate, 
    setStartDate,
    endDate,
    setEndDate,
    prependEvents,
    appendEvents,
    setSettingsOpen,
    hiddenEventTypes,
    toggleEventTypeVisibility
  } = useStore();
  const [isDragging, setIsDragging] = useState(false);

  const loadingRef = useRef(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file?.type === 'application/json') {
      await handleImportSettings(file);
    }
  };

  // Update document title based on language
  useEffect(() => {
    document.title = language === 'nl-NL' ? 'Team-beschikbaarheid' : 'Team Availability';
  }, [language]);

  useEffect(() => {
    if (isAuthenticated && emails.length === 0) {
      getCurrentUser().then((user) => {
        if (user && user.userPrincipalName) {
          const email = user.userPrincipalName;
          addEmail(email);
        }
      });
    }
  }, [isAuthenticated, emails, addEmail]);

  // Initial load
  useEffect(() => {
    if (isAuthenticated && emails.length > 0) {
      const loadInitialEvents = async () => {
        const endDate = addDays(startDate, 13);
        setEndDate(endDate);
        const events = await getOutOfOfficeEvents(emails, startDate, endDate);
        setEvents(events);
      };
      loadInitialEvents();
    }
  }, [isAuthenticated, emails, startDate]);

  const handleLogin = () => {
    instance.loginPopup({ scopes });
  };

  const loadPastDays = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const newStartDate = addDays(startDate, -7);
      const newEvents = await getOutOfOfficeEvents(emails, newStartDate, startDate);
      prependEvents(newEvents);
      setStartDate(newStartDate);
    } finally {
      loadingRef.current = false;
    }
  }, [emails, startDate, prependEvents, setStartDate]);

  const loadMoreDays = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;

    try {
      const newEndDate = addDays(endDate, 14);
      const newEvents = await getOutOfOfficeEvents(emails, endDate, newEndDate);
      appendEvents(newEvents);
      setEndDate(newEndDate);
    } finally {
      loadingRef.current = false;
    }
  }, [emails, endDate, appendEvents, setEndDate]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const scrollPosition = element.scrollTop + element.clientHeight;
    const scrollThreshold = element.scrollHeight - 200; // Load more when within 200px of bottom

    if (scrollPosition >= scrollThreshold) {
      loadMoreDays();
    }
  }, [loadMoreDays]);

  const mainContentStyle = {
    maxHeight: 'calc(100vh - 80px)', // Adjust based on header height
    overflowY: 'auto' as const,
  };

  if (!checkAuthConfig()) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Team Availability</h1>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 font-medium mb-2">
                Configuration Required
              </p>
              <p className="text-red-600 text-sm">
                The application needs to be configured with the correct app registration settings on Entra ID. The app registration should have these API permissions from MS Graph: Calendars.Read, Calendars.Read.Shared, User.Read, User.Read.All.
              </p>
            </div>
            
            <div className="text-left space-y-4">
              <h2 className="font-medium text-gray-900">How to configure:</h2>
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>
                  Use the following URL structure to configure the app:
                  <code className="block mt-2 p-3 bg-gray-50 rounded-lg text-sm font-mono break-all">
                    https://teamavailability.netlify.app/?tenantId=YOUR_TENANT_ID&clientId=YOUR_CLIENT_ID
                  </code>
                </li>
                <li>
                  Replace <span className="font-mono text-sm">YOUR_TENANT_ID</span> with your Azure AD tenant ID
                </li>
                <li>
                  Replace <span className="font-mono text-sm">YOUR_CLIENT_ID</span> with your Azure AD application ID
                </li>
              </ol>
              
              <p className="text-sm text-gray-500 mt-4">
                After the initial configuration, these settings will be saved and you can access the app directly via the base URL.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-6">Team Availability</h1>
          <button
            onClick={handleLogin}
            className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors"
          >
            Sign in with Microsoft
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`min-h-screen bg-gray-100 relative ${isDragging ? 'cursor-copy' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-blue-500 bg-opacity-10 border-2 border-blue-500 border-dashed rounded-lg z-50 pointer-events-none flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg">
            <p className="text-lg font-medium text-blue-700">
              {language === 'nl-NL' 
                ? 'Laat los om instellingen te importeren' 
                : 'Drop to import settings'}
            </p>
          </div>
        </div>
      )}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img 
                src="/icon.png" 
                alt="Logo" 
                className="w-8 h-8"
              />
              <h1 className="text-2xl font-bold text-gray-900">
                {language === 'nl-NL' ? 'Team-beschikbaarheid' : 'Team Availability'}
              </h1>
            </div>
            <div className="flex gap-2">
              {/* Tag filters */}
              <div className="flex gap-2 mr-4">
                {Array.from(new Set(Object.values(employeeTags).flatMap(tags => tags))).sort().map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTagSelection(tag)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                      selectedTags.includes(tag)
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={selectedTags.includes(tag) ? `Verberg ${tag}` : `Toon ${tag}`}
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </button>
                ))}
              </div>
              <button
                onClick={() => toggleEventTypeVisibility('oof')}
                className={`p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2 ${
                  !hiddenEventTypes.includes('oof') ? 'bg-gray-100' : ''
                }`}
                title={hiddenEventTypes.includes('oof') ? 'Toon Out of Office' : 'Verberg Out of Office'}
              >
                {hiddenEventTypes.includes('oof') ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
                <Calendar className="w-5 h-5" />
              </button>
              <button
                onClick={() => toggleEventTypeVisibility('busy')}
                className={`p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 flex items-center gap-2 ${
                  !hiddenEventTypes.includes('busy') ? 'bg-gray-100' : ''
                }`}
                title={hiddenEventTypes.includes('busy') ? 'Toon Bezet' : 'Verberg Bezet'}
              >
                {hiddenEventTypes.includes('busy') ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
                <Clock className="w-5 h-5" />
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
              >
                <Settings className="w-6 h-6" />
              </button>
              <button
                onClick={() => setInfoOpen(true)}
                className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                title={language === 'nl-NL' ? 'Informatie' : 'Information'}
              >
                <Info className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6"
        style={mainContentStyle}
        onScroll={handleScroll}
      >
        <button
          onClick={loadPastDays}
          className="w-full mb-6 p-3 flex items-center justify-center text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
          disabled={loadingRef.current}
        >
          <ChevronUp className="w-6 h-6" />
          <span className="ml-2">{language === 'nl-NL' ? 'Vorige week laden' : 'Load previous week'}</span>
        </button>

        <EventList />

        <div className="h-[200px] flex items-center justify-center">
          {loadingRef.current && (
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          )}
        </div>
      </main>

      <SettingsModal />
      <InfoModal />
    </div>
  );
}

function App() {
  if (!msalInstance) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Team Availability</h1>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-700 font-medium mb-2">
                Configuration Required
              </p>
              <p className="text-red-600 text-sm">
                The application needs to be configured with the correct Azure AD settings.
              </p>
            </div>
            
            <div className="text-left space-y-4">
              <h2 className="font-medium text-gray-900">How to configure:</h2>
              <ol className="list-decimal list-inside space-y-3 text-gray-700">
                <li>
                  Use the following URL structure to configure the app:
                  <code className="block mt-2 p-3 bg-gray-50 rounded-lg text-sm font-mono break-all">
                    https://guileless-begonia-7f1e00.netlify.app/?tenantId=YOUR_TENANT_ID&clientId=YOUR_CLIENT_ID
                  </code>
                </li>
                <li>
                  Replace <span className="font-mono text-sm">YOUR_TENANT_ID</span> with your Azure AD tenant ID
                </li>
                <li>
                  Replace <span className="font-mono text-sm">YOUR_CLIENT_ID</span> with your Azure AD application ID
                </li>
              </ol>
              
              <p className="text-sm text-gray-500 mt-4">
                After the initial configuration, these settings will be saved and you can access the app directly via the base URL.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MsalProvider instance={msalInstance}>
      <AppContent />
    </MsalProvider>
  );
}

export default App;
