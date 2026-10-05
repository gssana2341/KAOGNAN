// Vercel serverless entry: every /api/* request is handled by the same Express app that runs locally.
// Static files (public/) are served by Vercel's CDN. Needs TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (see README).
module.exports = require('../server/app');
