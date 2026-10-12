import mongoose from "mongoose";

// One-time disabled Coolify task. No credentials or user data are logged.
if (!process.env.BOOTSTRAP_DATABASE_PASSWORD) throw new Error("Bootstrap password is not configured");
await mongoose.connect(process.env.MONGODB_URI);
try {
 const db = mongoose.connection.db;
 const existing = await db.command({ usersInfo: "mailcheap" });
 if (existing.users.length) throw new Error("Runtime database user already exists; do not overwrite it");
 await db.command({ createUser: "mailcheap", pwd: process.env.BOOTSTRAP_DATABASE_PASSWORD, roles: [{ role: "readWrite", db: "mailcheap" }] });
 console.log("Runtime database user created");
} finally { await mongoose.disconnect(); }
