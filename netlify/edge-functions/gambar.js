// netlify/edge-functions/gambar.js
export default async function (request, context) {
  console.log("Edge Function /gambar triggered!");  // Log untuk test: Ini harus muncul di dashboard

  // Preflight / CORS
  if (request.method === "OPTIONS") {
    console.log("OPTIONS request handled");
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS,POST",
        "Access-Control-Allow-Headers": "Range,Accept,Content-Type,X-Netlify-Function-Access",
      },
    });
  }

  console.log("Processing GET/POST request");  // Log tambahan

  const urlObj = new URL(request.url);
  let imageUrl, width, quality;

  if (request.method === "POST") {
    try {
      const body = await request.json();
      imageUrl = body.url;
      width = body.w ? parseInt(body.w, 10) : null;
      quality = body.q ? parseInt(body.q, 10) : null;
      console.log("POST body parsed:", { imageUrl, width, quality });
    } catch (err) {
      console.error("POST body error:", err);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }
  } else {
    imageUrl = urlObj.searchParams.get("url");
    width = urlObj.searchParams.get("w") ? parseInt(urlObj.searchParams.get("w"), 10) : null;
    quality = urlObj.searchParams.get("q") ? parseInt(urlObj.searchParams.get("q"), 10) : null;
    console.log("GET params parsed:", { imageUrl, width, quality });
  }

  if (!imageUrl) {
    console.error("No imageUrl provided");
    return new Response("Parameter url wajib ada", { status: 400 });
  }

  // Validasi parameter (sama seperti sebelumnya)
  if (width && (isNaN(width) || width <= 0)) {
    return new Response("Parameter w harus angka > 0", { status: 400 });
  }
  if (quality && (isNaN(quality) || quality <= 0 || quality > 100)) {
    return new Response("Parameter q harus angka antara 0-100", { status: 400 });
  }

  try {
    const imageUrlObj = new URL(imageUrl);
    if (!["http:", "https:"].includes(imageUrlObj.protocol)) {
      return new Response("URL gambar harus http atau https", { status: 400 });
    }

    const functionUrl = new URL("https://edgeproxy.netlify.app/.netlify/functions/resize");
    functionUrl.searchParams.set("url", imageUrl);
    if (width) functionUrl.searchParams.set("w", width.toString());
    if (quality) functionUrl.searchParams.set("q", quality.toString());

    console.log("Fetching from Netlify Function:", functionUrl.toString());

    const headers = {
      "Accept": "image/*",
      "User-Agent": "Netlify-Edge-Function/1.0",
      "X-Netlify-Function-Access": "internal",
    };

    const response = await fetch(functionUrl.toString(), { headers });
    if (!response.ok) {
      console.error("Netlify Function response status:", response.status);
      return new Response(JSON.stringify({ error: `Netlify Function responded with status ${response.status}` }), {
        status: response.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    console.log("Netlify Function succeeded, returning image");

    const buffer = await response.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("content-type") || "image/webp",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
        "X-Resize": `w=${width || ""};q=${quality || ""}`,
      },
    });
  } catch (err) {
    console.error("Edge Function error:", err);
    return new Response(JSON.stringify({ error: String(err.message) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
  }
