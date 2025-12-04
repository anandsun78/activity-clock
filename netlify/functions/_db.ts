import mongoose from "mongoose";

mongoose.set("strictQuery", true);
mongoose.set("bufferCommands", false);

let cachedPromise: Promise<typeof mongoose> | undefined;

function redact(uri = ""): string {
  try {
    const u = new URL(uri);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return "<invalid-uri>";
  }
}

export async function dbConnect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    const err = new Error("MONGODB_URI is not set") as Error & { code?: string };
    err.code = "NO_MONGO_URI";
    throw err;
  }

  // Reuse a single in-flight connection per function process
  if (!cachedPromise) {
    console.log("[db] connecting to", redact(uri));
    cachedPromise = mongoose
      .connect(uri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 4000,
        connectTimeoutMS: 4000,
        socketTimeoutMS: 20000,
        retryWrites: true,
      })
      .then(() => mongoose.connection.asPromise()) // ensure fully open
      .catch((err) => {
        cachedPromise = undefined; // allow retry next invocation
        throw err;
      });
  }

  // Wait until ready (state === 1)
  await cachedPromise;
  return mongoose;
}

export function json(status: number, obj: unknown) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj ?? null),
  };
}

export function devErrorPayload(err: unknown) {
  const error = err as { message?: string; code?: string; stack?: string };
  const isDev =
    process.env.NODE_ENV !== "production" ||
    process.env.NETLIFY_DEV === "true" ||
    process.env.NETLIFY_LOCAL === "true";
  const base = { error: error?.message || "Server error" };
  return isDev ? { ...base, code: error?.code, stack: error?.stack } : base;
}

export { mongoose };
