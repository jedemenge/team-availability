import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, Eye, EyeOff, Clock, Download, Upload, Calendar, Tag, XCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getUserDisplayName } from '../lib/graph';
import { handleImportSettings } from '../lib/importSettings';

export function SettingsModal() {
  const {
    emails,
    visibleEmails,
    addEmail,
    removeEmail,
    toggleEmailVisibility,
    isSettingsOpen,
    setSettingsOpen,
    displayNames,
    teamSettings,
    updateTeamSettings,
    hiddenEventTypes,
    employeeTags,
    addTagToEmployee,
    removeTagFromEmployee,
    language,
    setLanguage,
    selectedTags,
    toggleTagSelection,
    minDuration,
    setMinDuration,
    toggleEventTypeVisibility
  } = useStore();
  const [newEmail, setNewEmail] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'filters' | 'backup'>('users');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [setSettingsOpen]);

  const translations = {
    'en-US': {
      title: 'Team Availability',
      officeHours: 'Office Hours',
      startTime: 'Start Time',
      endTime: 'End Time',
      lunchBreak: 'Lunch Break',
      minimumAvailabilityDuration: 'Minimum Availability Duration',
      hideAvailabilityMessage: 'Hide available time slots shorter than the selected duration',
      appointmentVisibility: 'Appointment Visibility',
      minutes: 'minutes',
      hour: 'hour',
      hours: 'hours',
      busy: 'Busy',
      show: 'Show',
      hide: 'Hide'
    },
    'nl-NL': {
      title: 'Team-beschikbaarheid',
      officeHours: 'Beschikbaarheidsuren',
      startTime: 'Starttijd',
      endTime: 'Eindtijd',
      lunchBreak: 'Lunchpauze',
      minimumAvailabilityDuration: 'Minimale Beschikbaarheidsduur',
      hideAvailabilityMessage: 'Verberg beschikbare tijdslots die korter zijn dan de geselecteerde duur',
      appointmentVisibility: 'Zichtbaarheid Afspraken',
      minutes: 'minuten',
      hour: 'uur',
      hours: 'uur',
      busy: 'Bezet',
      show: 'Toon',
      hide: 'Verberg'
    }
  };

  const t = translations[language];

  const getDurationLabel = (minutes: number) => {
    if (language === 'en-US') {
      if (minutes < 60) return `${minutes} ${t.minutes}`;
      const hours = minutes / 60;
      return `${hours} ${hours === 1 ? t.hour : t.hours}`;
    } else {
      if (minutes < 60) return `${minutes} ${t.minutes}`;
      const hours = minutes / 60;
      return `${hours} ${t.hours}`;
    }
  };

  const handleExportSettings = () => {
    const settings = {
      emails,
      visibleEmails,
      displayNames,
      employeeTags,
      hiddenEventTypes,
      teamSettings,
     language,
    };

    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'team-beschikbaarheid-instellingen.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      await handleImportSettings(file);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      setError(language === 'nl-NL' 
        ? 'Kon instellingen niet importeren: ongeldig bestand'
        : 'Could not import settings: invalid file'
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail) return;
    
    setIsValidating(true);
    setError(null);
    
    try {
      await getUserDisplayName(newEmail);
      addEmail(newEmail);
      setNewEmail('');
      setError(null);
    } catch (err) {
      setError('Could not find user with this email address');
    } finally {
      setIsValidating(false);
    }
  };

  const handleAddTag = (email: string) => {
    const tagValue = tagInputs[email];
    if (!tagValue?.trim()) return;
    addTagToEmployee(email, tagValue.trim());
    setTagInputs(prev => ({ ...prev, [email]: '' }));
  };

  // Get all unique tags across all employees
  const allTags = Array.from(new Set(
    Object.values(employeeTags).flatMap(tags => tags)
  )).sort();

  const handleTimeChange = (
    setting: 'officeHours' | 'lunchBreak',
    field: 'start' | 'end',
    value: string
  ) => {
    updateTeamSettings({
      [setting]: {
        ...teamSettings[setting],
        [field]: value,
      },
    });
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('users')}
              className={`text-sm font-medium px-3 py-1 rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'users'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {language === 'nl-NL' ? 'Gebruikers' : 'Users'}
            </button>
            <button
              onClick={() => setActiveTab('filters')}
              className={`text-sm font-medium px-3 py-1 rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'filters'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {language === 'nl-NL' ? 'Filters' : 'Filters'}
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`text-sm font-medium px-3 py-1 rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'backup'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {language === 'nl-NL' ? 'Back-up' : 'Backup'}
            </button>
            <button
              onClick={() => setActiveTab('language')}
              className={`text-sm font-medium px-3 py-1 rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'language'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              {language === 'nl-NL' ? 'Taal' : 'Language'}
            </button>
          </div>
          <button
            onClick={() => setSettingsOpen(false)}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-4">
          {activeTab === 'users' ? (
            <>
              <h3 className="font-medium mb-2">
                {language === 'nl-NL' ? 'Beheerde Gebruikers' : 'Managed Users'}
              </h3>
              <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder={language === 'nl-NL' ? 'E-mailadres toevoegen' : 'Add email address'}
              disabled={isValidating}
              className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
              disabled={isValidating}
            >
              <Plus className="w-4 h-4" />
              {isValidating 
                ? (language === 'nl-NL' ? 'Valideren...' : 'Validating...') 
                : (language === 'nl-NL' ? 'Toevoegen' : 'Add')}
            </button>
          </form>
          {error && (
            <div className="mt-2 text-sm text-red-600">
              {language === 'nl-NL' 
                ? 'Gebruiker niet gevonden met dit e-mailadres'
                : 'User not found with this email address'}
            </div>
          )}
          
          <div className="space-y-2">
            {emails.map((email) => (
              <div
                key={email}
                className="flex flex-col p-2 bg-gray-50 rounded-lg gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">
                    {displayNames[email] || email}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleEmailVisibility(email)}
                      className={`p-1.5 rounded-md transition-colors ${
                        visibleEmails.includes(email)
                          ? 'text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100'
                          : 'text-gray-400 hover:text-gray-500 bg-gray-100 hover:bg-gray-200'
                      }`}
                      title={visibleEmails.includes(email) ? 'Hide' : 'Show'}
                    >
                      {visibleEmails.includes(email) ? (
                        <Eye className="w-4 h-4" />
                      ) : (
                        <EyeOff className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => removeEmail(email)}
                      className="p-1.5 text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {/* Tags section */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-200">
                  <div className="flex-1 flex flex-wrap gap-1">
                    {(employeeTags[email] || []).map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-sm"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                        <button
                          onClick={() => removeTagFromEmployee(email, tag)}
                          className="hover:text-blue-900"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={tagInputs[email] || ''}
                      onChange={(e) => setTagInputs(prev => ({ ...prev, [email]: e.target.value }))}
                      placeholder={language === 'nl-NL' ? 'Tag toevoegen' : 'Add tag'}
                      className="px-2 py-1 text-sm border rounded-md w-32 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag(email);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAddTag(email)}
                      className="p-1 text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </>
          ) : activeTab === 'filters' ? (
            <>
              {/* Tag filters */}
              {allTags.length > 0 && (
                <div className="mb-6">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-blue-500" />
                    {language === 'nl-NL' ? 'Filter op Tags' : 'Filter by Tags'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {allTags.map(tag => (
                      <button
                        key={tag}
                        onClick={() => toggleTagSelection(tag)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm ${
                          selectedTags.includes(tag)
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-6">
                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    {t.officeHours}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t.startTime}
                      </label>
                      <input
                        type="time"
                        value={teamSettings.officeHours.start}
                        onChange={(e) => handleTimeChange('officeHours', 'start', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t.endTime}
                      </label>
                      <input
                        type="time"
                        value={teamSettings.officeHours.end}
                        onChange={(e) => handleTimeChange('officeHours', 'end', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-blue-500" />
                    {t.lunchBreak}
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t.startTime}
                      </label>
                      <input
                        type="time"
                        value={teamSettings.lunchBreak.start}
                        onChange={(e) => handleTimeChange('lunchBreak', 'start', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t.endTime}
                      </label>
                      <input
                        type="time"
                        value={teamSettings.lunchBreak.end}
                        onChange={(e) => handleTimeChange('lunchBreak', 'end', e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-6">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-500" />
                  {t.minimumAvailabilityDuration}
                </h3>
                <select
                  value={minDuration}
                  onChange={(e) => setMinDuration(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value={15}>{getDurationLabel(15)}</option>
                  <option value={30}>{getDurationLabel(30)}</option>
                  <option value={60}>{getDurationLabel(60)}</option>
                  <option value={120}>{getDurationLabel(120)}</option>
                </select>
                <p className="mt-2 text-sm text-gray-600">
                  {t.hideAvailabilityMessage}
                </p>
              </div>
              <div className="mt-6">
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  {t.appointmentVisibility}
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">Out of Office</span>
                    <button
                      onClick={() => toggleEventTypeVisibility('oof')}
                      className={`p-1.5 rounded-md transition-colors ${
                        !hiddenEventTypes.includes('oof')
                          ? 'text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100'
                          : 'text-gray-400 hover:text-gray-500 bg-gray-100 hover:bg-gray-200'
                      }`}
                      title={hiddenEventTypes.includes('oof') ? t.show : t.hide}
                    >
                      {hiddenEventTypes.includes('oof') ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                    <span className="text-gray-700">{t.busy}</span>
                    <button
                      onClick={() => toggleEventTypeVisibility('busy')}
                      className={`p-1.5 rounded-md transition-colors ${
                        !hiddenEventTypes.includes('busy')
                          ? 'text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100'
                          : 'text-gray-400 hover:text-gray-500 bg-gray-100 hover:bg-gray-200'
                      }`}
                      title={hiddenEventTypes.includes('busy') ? t.show : t.hide}
                    >
                      {hiddenEventTypes.includes('busy') ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'language' ? (
            <>
              <h3 className="font-medium mb-4">
                {language === 'nl-NL' ? 'Taalinstellingen' : 'Language Settings'}
              </h3>
              <div className="space-y-2">
                <button
                  onClick={() => setLanguage('en-US')}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    language === 'en-US'
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  English (US)
                </button>
                <button
                  onClick={() => setLanguage('nl-NL')}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    language === 'nl-NL'
                      ? 'bg-blue-50 text-blue-700'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  Nederlands
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-500" />
                {language === 'nl-NL' ? 'Back-up & Herstel' : 'Backup & Restore'}
              </h3>
              <div className="flex gap-4">
                <button
                  onClick={handleExportSettings}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {language === 'nl-NL' ? 'Instellingen exporteren' : 'Export settings'}
                </button>
                <button
                  onClick={handleImportClick}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  {language === 'nl-NL' ? 'Instellingen importeren' : 'Import settings'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            </>
          )}
          </div>
        </div>
      </div>
  );
}