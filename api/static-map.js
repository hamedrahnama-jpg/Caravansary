/* global Buffer, process */

export default async function handler(request, response) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: "Missing GOOGLE_MAPS_API_KEY" });
    return;
  }

  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const lat = Number(url.searchParams.get("lat"));
  const lon = Number(url.searchParams.get("lon"));
  const zoom = Math.max(1, Math.min(21, Math.round(Number(url.searchParams.get("zoom")) || 18)));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    response.status(400).json({ error: "Invalid lat/lon" });
    return;
  }

  const params = new URLSearchParams({
    center: `${lat},${lon}`,
    zoom: String(zoom),
    size: "640x640",
    scale: "2",
    maptype: "satellite",
    key: apiKey
  });

  const googleResponse = await fetch(`https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`);
  if (!googleResponse.ok) {
    const errorText = await googleResponse.text();
    response
      .status(googleResponse.status)
      .setHeader("Content-Type", "text/plain; charset=utf-8")
      .send(errorText || `Google Static Maps failed with ${googleResponse.status}`);
    return;
  }

  const contentType = googleResponse.headers.get("content-type") || "image/png";
  const imageBuffer = Buffer.from(await googleResponse.arrayBuffer());
  response.setHeader("Content-Type", contentType);
  response.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
  response.send(imageBuffer);
}
