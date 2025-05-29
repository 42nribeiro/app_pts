
const { google } = require('googleapis');
const config = require('../config');

// TODO: Configure Google Sheets API client
// This typically involves:
// 1. Setting up a Google Cloud Project.
// 2. Enabling the Google Sheets API.
// 3. Creating credentials (e.g., a service account JSON key).
// 4. Setting the GOOGLE_APPLICATION_CREDENTIALS environment variable
//    or loading the key file explicitly.

const sheets = google.sheets('v4');

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    // Scopes can be adjusted based on the permissions needed
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return await auth.getClient();
}

async functiongetSheetData(spreadsheetId, range) {
  try {
    const authClient = await getAuthClient();
    const request = {
      spreadsheetId: spreadsheetId || config.SPREADSHEET_ID,
      range: range,
      auth: authClient,
    };
    const response = await sheets.spreadsheets.values.get(request);
    return response.data.values;
  } catch (err) {
    console.error('The API returned an error: ' + err);
    throw err;
  }
}

async function writeSheetData(spreadsheetId, range, values) {
  try {
    const authClient = await getAuthClient();
    const request = {
      spreadsheetId: spreadsheetId || config.SPREADSHEET_ID,
      range: range,
      valueInputOption: 'USER_ENTERED', // Or 'RAW'
      resource: {
        values: values,
      },
      auth: authClient,
    };
    const response = await sheets.spreadsheets.values.update(request);
    return response.data;
  } catch (err) {
    console.error('The API returned an error: ' + err);
    throw err;
  }
}

async function appendSheetData(spreadsheetId, range, values) {
    try {
        const authClient = await getAuthClient();
        const request = {
            spreadsheetId: spreadsheetId || config.SPREADSHEET_ID,
            range: range, // e.g., 'Sheet1' to append to the first empty row
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS', // Appends new rows
            resource: {
                values: values,
            },
            auth: authClient,
        };
        const response = await sheets.spreadsheets.values.append(request);
        return response.data;
    } catch (err) {
        console.error('Error appending data to sheet: ' + err);
        throw err;
    }
}

async function clearSheetRange(spreadsheetId, range) {
    try {
        const authClient = await getAuthClient();
        const request = {
            spreadsheetId: spreadsheetId || config.SPREADSHEET_ID,
            range: range,
            auth: authClient,
        };
        const response = await sheets.spreadsheets.values.clear(request);
        return response.data;
    } catch (err) {
        console.error('Error clearing sheet range: ' + err);
        throw err;
    }
}


// Placeholder for getSpreadsheetTimeZone - This is a property of the spreadsheet metadata.
// You might need to use spreadsheets.get to fetch this if required by your logic,
// or assume a default timezone for Node.js operations (e.g. 'Europe/Lisbon' as used in dateUtils).
// The Google Sheets API itself doesn't directly expose a "spreadsheet timezone" setting for date interpretation
// in the same way Apps Script's Session.getScriptTimeZone() or Spreadsheet.getSpreadsheetTimeZone() does.
// Date/time values are often handled as serial numbers or ISO strings.
// For consistent date handling, establish a common timezone (e.g. UTC) for storing and processing dates.
async function getSpreadsheetTimeZone(spreadsheetId) {
    // This is a simplification. Real implementation would require more nuanced handling or a fixed timezone.
    // For example, by fetching spreadsheet properties:
    // const response = await sheets.spreadsheets.get({ spreadsheetId, auth: authClient, fields: 'properties.timeZone' });
    // return response.data.properties.timeZone;
    return 'Europe/Lisbon'; // Placeholder, adjust as needed
}


module.exports = {
  getSheetData,
  writeSheetData,
  appendSheetData,
  clearSheetRange,
  getSpreadsheetTimeZone,
  // Add other sheet interaction functions here
};
