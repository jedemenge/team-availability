import { PublicClientApplication, Configuration, AuthenticationResult, InteractionRequiredAuthError } from '@azure/msal-browser';

function getAuthConfig() {
  // Try to get values from localStorage first
  let tenantId = localStorage.getItem('tenantId');
  let clientId = localStorage.getItem('clientId');
  const params = new URLSearchParams(window.location.search);
  
  // If not in localStorage, check URL parameters
  if (!tenantId || !clientId) {
    tenantId = params.get('tenantId');
    clientId = params.get('clientId');
    
    // If found in URL, store them and remove from URL
    if (tenantId && clientId) {
      localStorage.setItem('tenantId', tenantId);
      localStorage.setItem('clientId', clientId);
    }
  }
  
  // Clean URL if we have parameters
  if (params.has('tenantId') || params.has('clientId')) {
    window.history.replaceState({}, '', window.location.pathname);
  }
  
  if (tenantId && clientId) {
    return { tenantId, clientId };
  }
  
  return null;
}

function getMsalConfig(): Configuration {
  const config = getAuthConfig();
  if (!config) {
    return null;
  }
  
  return {
    auth: {
      clientId: config.clientId,
      authority: `https://login.microsoftonline.com/${config.tenantId}`,
    },
    cache: {
      cacheLocation: 'localStorage',
      storeAuthStateInCookie: false,
    },
  };
}

export const scopes = [
  'Calendars.Read',
  'Calendars.Read.Shared',
  'MailboxSettings.Read',
  'Presence.Read.All',
  'User.Read',
  'User.Read.All'
];

function initializeMsal(): PublicClientApplication | null {
  try {
    const config = getMsalConfig();
    return config ? new PublicClientApplication(config) : null;
  } catch (error) {
    console.error('Failed to initialize MSAL:', error);
    return null;
  }
}

const msalInstance = initializeMsal();
export { msalInstance };

export async function acquireToken(): Promise<string> {
  if (!msalInstance) {
    throw new Error('MSAL not initialized');
  }

  try {
    const account = msalInstance.getAllAccounts()[0];
    if (!account) {
      throw new Error('No account found');
    }

    const response = await msalInstance.acquireTokenSilent({
      scopes,
      account,
    });
    return response.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      const response = await msalInstance.acquireTokenPopup({ scopes });
      return response.accessToken;
    }
    throw error;
  }
}