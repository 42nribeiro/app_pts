
// It's recommended to use environment variables for sensitive data and configurations
// For example, using the 'dotenv' package and a .env file

module.exports = {
    PORT: process.env.PORT || 3000,
    CALENDAR_ID: process.env.CALENDAR_ID || "protrainingpfstudio@gmail.com",
    PT_KEYWORDS: ["PRO NR", "PRO JM", "PRO JP", "PRO DN", "PRO EL", "GIL"],
    
    SQLITE_DB_PATH: process.env.SQLITE_DB_PATH || './protraining.db',

    // For Google API authentication if using a service account (for Calendar)
    // GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS, // Path to your service account key file

    CACHE_EXPIRATION_SECONDS: 3600, // 1 hour
};