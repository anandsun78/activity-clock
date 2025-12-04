import type { Handler } from "@netlify/functions";
import { dbConnect, json, devErrorPayload, mongoose } from "./_db";

export const handler: Handler = async (event) => {
  try {
    await dbConnect(); // wait until fully connected

    // Define models only after connection is ready
    const ActivityName =
      mongoose.models.ActivityName ||
      mongoose.model(
        "ActivityName",
        new mongoose.Schema({
          name: { type: String, unique: true, index: true },
        })
      );

    if (event.httpMethod === "GET") {
      const names = await ActivityName.find({}).sort({ name: 1 }).lean();
      return json(
        200,
        names.map((n) => n.name)
      );
    }

    if (event.httpMethod === "POST") {
      let parsed: any = {};
      try {
        parsed = event.body ? JSON.parse(event.body) : {};
      } catch {
        return json(400, { error: "Invalid JSON body" });
      }

      const raw = (parsed.name || "").trim();
      if (!raw) return json(400, { error: "Missing name" });

      const name = raw[0].toUpperCase() + raw.slice(1);
      await ActivityName.updateOne(
        { name },
        { $setOnInsert: { name } },
        { upsert: true }
      );
      return json(200, { ok: true });
    }

    return json(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("activityNames error:", err);
    return json(500, devErrorPayload(err));
  }
};
