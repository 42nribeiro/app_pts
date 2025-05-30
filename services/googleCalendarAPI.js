
const { google } = require('googleapis');
const config = require('../config');

// TODO: Configure Google Calendar API client
// Similar setup to Google Sheets API (GCP Project, API enabled, credentials)

const calendar = google.calendar('v3');

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'], // Adjust scopes as needed
  });
  return await auth.getClient();
}

async function getCalendarEvents(calendarId, timeMin, timeMax) {
  try {
    const authClient = await getAuthClient();
    const request = {
      calendarId: calendarId || config.CALENDAR_ID,
      timeMin: timeMin, // ISO 8601 string, e.g., new Date().toISOString()
      timeMax: timeMax, // ISO 8601 string
      singleEvents: true,
      orderBy: 'startTime',
      auth: authClient,
    };
    const response = await calendar.events.list(request);
    return response.data.items;
  } catch (err) {
    console.error('The API returned an error: ' + err);
    throw err;
  }
}

// Add other calendar interaction functions here (createEvent, updateEvent, etc.)

module.exports = {
  getCalendarEvents,
};
