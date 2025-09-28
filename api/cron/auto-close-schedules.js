import { autoClosePastSchedulesCronController } from "../../controller/cron.controller.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await autoClosePastSchedulesCronController(req, res);
  } catch (err) {
    console.error("Cron job failed:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
