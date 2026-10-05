// Vercel serverless entry: vercel.json rewrites /api/* (and /healthz) here, and the same Express app that runs
// locally handles the original URL. Static files (public/) are served by Vercel's CDN.
// Needs TURSO_DATABASE_URL + TURSO_AUTH_TOKEN (see README).
module.exports = require('../server/app');
