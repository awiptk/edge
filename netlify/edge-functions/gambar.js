// netlify/edge-functions/gambar.js
export default async function (request, context) {
  // Preflight / CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS,POST",
        "Access-Control-Allow-Headers": "Range,Accept,Content-Type",
      },
    });
  }

  const urlObj = new URL(request.url);
  let imageUrl, width, quality;

  // Cek apakah request POST dengan JSON body
  if (request.method === "POST") {
    try {
      const body = await request.json();
      imageUrl = body.url;
      width = body.w ? parseInt(body.w, 10) : null;
      quality = body.q ? parseInt(body.q, 10) : null;
    } catch (err) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  } else {
    // GET request dengan query params
    imageUrl = urlObj.searchParams.get("url");
    width = urlObj.searchParams.get("w") ? parseInt(urlObj.searchParams.get("w"), 10) : null;
    quality = urlObj.searchParams.get("q") ? parseInt(urlObj.searchParams.get("q"), 10) : null;
  }

  if (!imageUrl) {
    return new Response("Parameter url wajib ada", { status: 400 });
  }

  // Validasi parameter
  if (width && (isNaN(width) || width <= 0)) {
    return new Response("Parameter w harus angka > 0", { status: 400 });
  }
  if (quality && (isNaN(quality) || quality <= 0 || quality > 100)) {
    return new Response("Parameter q harus angka antara 0-100", { status: 400 });
  }

  try {
    // Validasi URL
    const imageUrlObj = new URL(imageUrl);
    if (!["http:", "https:"].includes(imageUrlObj.protocol)) {
      return new Response("URL gambar harus http atau https", { status: 400 });
    }

    // Redirect ke Netlify Function
    const functionUrl = new URL("https://edgeproxy.netlify.app/.netlify/functions/resize");
    functionUrl.searchParams.set("url", imageUrl);
    if (width) functionUrl.searchParams.set("w", width.toString());
    if (quality) functionUrl.searchParams.set("q", quality.toString());

    return Response.redirect(functionUrl.toString(), 302);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message) }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
}
