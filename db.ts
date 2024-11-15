import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

let cached = (global as any).mongoose || { conn: null, promise: null };

export const connect = async () => {
  if (cached.conn) return cached.conn;
  if (!MONGODB_URI) throw new Error("MONGODB_URI is missing");
  //console.log("DATABASE CONNECTION IS SUCCESSFUL");
  cached.promise =
    cached.promise ||
    mongoose.createConnection(MONGODB_URI, {
      dbName: "Sibya",
      bufferCommands: false,
    });

  cached.conn = await cached.promise;

  return cached.conn;
};
