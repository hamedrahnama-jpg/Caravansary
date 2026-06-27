/* global Buffer, process */

export default async function handler(request, response) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    response.status(500).json({ error: "Missing GOOGLE_MAPS_API_KEY" });
    return;
  }

  const url = new URL(request.url, `https://${request.headers.host || "localhost"}`);
  const points = (url.searchParams.get("points") || "")
    .split("|")
    .map((point) => point.split(",").map(Number))
    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon))
    .slice(0, 80);

  if (points.length === 0) {
    response.status(400).json({ error: "No valid points" });
    return;
  }

  const params = new URLSearchParams({
    size: "640x640",
    scale: "2",
    maptype: "roadmap",
    key: apiKey
  });
  params.append("markers", `color:red|size:small|${points.map(([lat, lon]) => `${lat},${lon}`).join("|")}`);

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
  response.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  response.send(imageBuffer);
}
