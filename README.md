# Team Availability
Inspect team availability via Microsoft Graph, fully created via Bolt.new

![image](https://github.com/user-attachments/assets/26f9457a-629e-4e7e-93da-7d8fcbc9f92c)







## Features

Will show available slots for visible employees within availability hours (excluding lunch). At the moment, these event types are simply being ignored by the app: free, tentative, working elsewhere.

- Team management: add/remove, show/hide individual team members, tag team members and show/hide by (either selected) tag
- Filtering: setting availability and lunch hours, setting a minimum required interval for the app to detect availability, show/hide out-of-office or busy events (but still, always, include them in availability calculation)
- Backup: import/export full configuration json, such that it can easily be shared within teams. Import optionally via drag & drop.
- Languages: English and Dutch

## Setup

The app was created for authenticating via login.microsoftonline.com using Authorization Code flow. As such, an app registration within your Entra ID tenant is required. These are the corresponding required API scopes according to Bolt.new:

> Let me analyze the code to determine which Microsoft Graph scopes are actually being used in the application:
> 
> Looking at the code in src/lib/graph.ts, these are the only API endpoints being called:
> 
> - /me - Requires User.Read
> - /users/${email} - Requires User.Read.All
> - /me/calendar/getSchedule - Requires Calendars.Read and Calendars.Read.Shared (for reading other users' calendars)
>
> So the actively used scopes are:
> 
> - User.Read
> - User.Read.All
> - Calendars.Read
> - Calendars.Read.Shared
