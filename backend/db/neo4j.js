const neo4j = require('neo4j-driver');

let driver = null;
let lastError = null;

/**
 * Lazily creates (or returns) the singleton driver instance.
 * Returns null if the required env vars aren't set — callers
 * are expected to handle that gracefully rather than crash.
 */
function getDriver() {
  if (driver) return driver;

  const uri = process.env.COGNODB_URI;
  const user = process.env.COGNODB_USER;
  const password = process.env.COGNODB_PASSWORD;

  if (!uri || !user || !password) {
    lastError = 'Missing COGNODB_URI, COGNODB_USER, or COGNODB_PASSWORD in environment.';
    return null;
  }

  try {
    driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
    lastError = null;
  } catch (err) {
    lastError = err.message;
    driver = null;
  }

  return driver;
}

/**
 * Pings the database. Used by /api/health and at server startup.
 * Never throws — always resolves to a status object.
 */
async function verifyConnection() {
  const d = getDriver();
  if (!d) {
    return { connected: false, error: lastError || 'Driver not initialized' };
  }
  try {
    await d.verifyConnectivity();
    return { connected: true, error: null };
  } catch (err) {
    lastError = err.message;
    return { connected: false, error: err.message };
  }
}

/**
 * Runs a single Cypher statement in its own session and returns the raw records.
 * Throws if the driver isn't configured or the query fails — routes are
 * expected to catch this and turn it into a 500 with a clear message.
 */
async function runQuery(cypher, params = {}) {
  const d = getDriver();
  if (!d) {
    throw new Error(lastError || 'Database driver not initialized');
  }
  const session = d.session();
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

module.exports = { getDriver, verifyConnection, runQuery, closeDriver };
