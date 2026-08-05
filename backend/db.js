// db.js
// Thin wrapper around the official Neo4j driver, pointed at CognoDB.
// CognoDB speaks openCypher over Bolt, so the standard neo4j-driver
// package works against it with no custom SDK required.

require('dotenv').config();
const neo4j = require('neo4j-driver');

const URI = process.env.COGNODB_URI;
const USER = process.env.COGNODB_USER;
const PASSWORD = process.env.COGNODB_PASSWORD;

let driver = null;
let connectionError = null;

function getDriver() {
  if (driver) return driver;

  if (!URI || !USER || !PASSWORD) {
    connectionError = new Error(
      'Missing COGNODB_URI, COGNODB_USER or COGNODB_PASSWORD. Copy backend/.env.example to backend/.env and fill in your CognoDB Cloud credentials.'
    );
    throw connectionError;
  }

  driver = neo4j.driver(URI, neo4j.auth.basic(USER, PASSWORD), {
    maxConnectionPoolSize: 20,
    connectionAcquisitionTimeout: 10000,
  });

  return driver;
}

// Verifies connectivity once at startup so the server can log a clear
// message instead of failing mysteriously on the first request.
async function verifyConnection() {
  try {
    const d = getDriver();
    await d.verifyConnectivity();
    connectionError = null;
    return { ok: true };
  } catch (err) {
    connectionError = err;
    return { ok: false, error: err.message };
  }
}

// Runs a single Cypher statement inside a managed session and always
// closes the session, even if the query throws.
async function runQuery(cypher, params = {}, mode = 'READ') {
  const d = getDriver();
  const session = d.session({
    defaultAccessMode: mode === 'WRITE' ? neo4j.session.WRITE : neo4j.session.READ,
  });
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

// Converts Neo4j Integer / node / relationship objects into plain JSON
// so Express can serialize them without surprises (Neo4j ints are not
// native JS numbers because Cypher integers can exceed 2^53).
function toNative(value) {
  if (value === null || value === undefined) return value;
  if (neo4j.isInt(value)) {
    return value.inSafeRange() ? value.toNumber() : value.toString();
  }
  if (Array.isArray(value)) return value.map(toNative);
  if (value.properties && value.labels) {
    // Node
    return { id: value.elementId, labels: value.labels, ...toNative(value.properties) };
  }
  if (value.properties && value.type) {
    // Relationship
    return { id: value.elementId, type: value.type, ...toNative(value.properties) };
  }
  if (value.segments) {
    // Path
    return value.segments.map((seg) => ({
      start: toNative(seg.start),
      relationship: toNative(seg.relationship),
      end: toNative(seg.end),
    }));
  }
  if (typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value)) out[key] = toNative(value[key]);
    return out;
  }
  return value;
}

async function closeDriver() {
  if (driver) await driver.close();
}

module.exports = { getDriver, verifyConnection, runQuery, toNative, closeDriver };
