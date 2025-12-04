import type { Handler } from "@netlify/functions";
import { dbConnect, json, devErrorPayload, mongoose } from "./_db";

export const handler: Handler = async (event) => {
  try {
    await dbConnect();

    // schema: one doc with an array of trackers
    const DaysSchema =
      mongoose.models.DaysStateMulti ||
      mongoose.model(
        "DaysStateMulti",
        new mongoose.Schema(
          {
            key: { type: String, unique: true }, // always "singleton"
            trackers: [
              {
                key: String, // unique id for tracker
                label: String,
                startTime: Date, // null if not running
                totalRelapses: { type: Number, default: 0 },
                totalElapsedSeconds: { type: Number, default: 0 },
              },
            ],
          },
          { timestamps: true }
        )
      );

    // GET: return all trackers
    if (event.httpMethod === "GET") {
      const doc =
        (await DaysSchema.findOne({ key: "singleton" }).lean()) || null;

      return json(200, {
        trackers: doc?.trackers || [],
      });
    }

    // POST: replace trackers with what frontend sends
    if (event.httpMethod === "POST") {
      let body: any = {};
      try {
        body = event.body ? JSON.parse(event.body) : {};
      } catch (e) {
        return json(400, { error: "Invalid JSON" });
      }

      const trackers = Array.isArray(body.trackers) ? body.trackers : [];

      const updated = await DaysSchema.findOneAndUpdate(
        { key: "singleton" },
        { $set: { trackers } },
        { upsert: true, new: true }
      ).lean();

      return json(200, {
        trackers: updated.trackers || [],
      });
    }

    return json(405, { error: "Method not allowed" });
  } catch (err) {
    console.error("days function error:", err);
    return json(500, devErrorPayload(err));
  }
};
