/* global process */

export default function handler(_request, response) {
  const apiKey = process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: "Missing GOOGLE_MAPS_API_KEY" });
    return;
  }
  response.status(200).json({ key: apiKey });
}
