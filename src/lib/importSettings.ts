import { useStore } from '../store/useStore';

export async function handleImportSettings(file: File) {
  const reader = new FileReader();
  
  return new Promise((resolve, reject) => {
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target?.result as string);
        const store = useStore.getState();
        
        // Validate the settings object
        if (!settings.emails || !Array.isArray(settings.emails)) {
          throw new Error('Invalid settings: emails missing');
        }
        
        // Import settings
        settings.emails.forEach(store.addEmail);
        if (settings.employeeTags) {
          Object.entries(settings.employeeTags).forEach(([email, tags]) => {
            tags.forEach(tag => store.addTagToEmployee(email, tag));
          });
        }
        if (settings.teamSettings) {
          store.updateTeamSettings(settings.teamSettings);
        }
        if (settings.language) {
          store.setLanguage(settings.language);
        }
        
        resolve(true);
      } catch (err) {
        reject(new Error('Could not import settings: invalid file'));
      }
    };
    
    reader.onerror = () => reject(new Error('Error reading file'));
    reader.readAsText(file);
  });
}