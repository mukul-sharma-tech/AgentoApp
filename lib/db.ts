import mongoose from "mongoose";

// ── Atlas connection (admin user, subscription, rate limits) ──────────────────
export async function connectDB(): Promise<typeof mongoose> {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) throw new Error("MONGO_URI not found in environment variables");

  if (!global.mongooseConn) global.mongooseConn = { conn: null, promise: null };
  if (global.mongooseConn.conn) return global.mongooseConn.conn;
  if (!global.mongooseConn.promise) {
    global.mongooseConn.promise = mongoose.connect(MONGO_URI, { dbName: "Agento" });
  }
  global.mongooseConn.conn = await global.mongooseConn.promise;
  return global.mongooseConn.conn;
}

// ── Admin Atlas connection (subscription requests) ────────────────────────────
export async function connectAdminDB(): Promise<mongoose.Connection> {
  const MONGO_URI_ADMIN = process.env.MONGO_URI_ADMIN;
  if (!MONGO_URI_ADMIN) throw new Error("MONGO_URI_ADMIN not found in environment variables");
  if (!global.mongooseAdminConn) global.mongooseAdminConn = { conn: null, promise: null };
  if (global.mongooseAdminConn.conn) return global.mongooseAdminConn.conn;
  if (!global.mongooseAdminConn.promise) {
    global.mongooseAdminConn.promise = mongoose
      .createConnection(MONGO_URI_ADMIN, { dbName: "AgentoAdmin" })
      .asPromise();
  }
  global.mongooseAdminConn.conn = await global.mongooseAdminConn.promise;
  return global.mongooseAdminConn.conn;
}

// ── Local connection (employees, documents, vectors, chat sessions) ───────────
// Desktop mode: mongodb://127.0.0.1:27017
// Cloud/demo mode: same as MONGO_URI (falls back gracefully)
export async function connectLocalDB(): Promise<mongoose.Connection> {
  const LOCAL_URI = process.env.MONGO_URI_LOCAL ?? process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017";
  if (!global.mongooseLocalConn) global.mongooseLocalConn = { conn: null, promise: null };
  if (global.mongooseLocalConn.conn) return global.mongooseLocalConn.conn;
  if (!global.mongooseLocalConn.promise) {
    global.mongooseLocalConn.promise = mongoose
      .createConnection(LOCAL_URI, { dbName: "Agento" })
      .asPromise();
  }
  global.mongooseLocalConn.conn = await global.mongooseLocalConn.promise;
  return global.mongooseLocalConn.conn;
}

/**
 * connectUserDB — use this for ALL company data routes:
 *   employees, documents, vectors, chat sessions, query genius collections.
 *
 * Desktop mode (DEPLOYMENT_MODE=desktop or MONGO_URI_LOCAL set):
 *   → local MongoDB at 127.0.0.1
 * Cloud/demo mode:
 *   → Atlas MONGO_URI (same DB, different server)
 */
export async function connectUserDB(): Promise<mongoose.Connection> {
  return connectLocalDB();
}
