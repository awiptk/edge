// netlify/edge-functions/gambar.js
export default async function (request, context) {
  // Preflight / CORS
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
        "Access-Control-Allow-Headers": "Range,Accept,Content-Type",
      },
    });
  }

  const urlObj = new URL(request.url);
  const imageUrl = urlObj.searchParams.get("url");
  if (!imageUrl) {
    return new Response("Parameter ?url= wajib ada", { status: 400 });
  }

  // Parse resize params
  const w = urlObj.searchParams.get("w");
  const h = urlObj.searchParams.get("h");
  const width = w ? parseInt(w, 10) : null;
  const height = h ? parseInt(h, 10) : null;

  if (w && (isNaN(width) || width <= 0)) {
    return new Response("Parameter w harus angka > 0", { status: 400 });
  }
  if (h && (isNaN(height) || height <= 0)) {
    return new Response("Parameter h harus angka > 0", { status: 400 });
  }

  try {
    // Validasi imageUrl (opsional, untuk keamanan)
    const imageUrlObj = new URL(imageUrl);
    if (!["http:", "https:"].includes(imageUrlObj.protocol)) {
      return new Response("URL gambar harus http atau https", { status: 400 });
    }

    // Bangun URL untuk Netlify Image CDN
    const netlifyImageUrl = new URL(imageUrl);
    if (width || height) {
      netlifyImageUrl.searchParams.set("nf_resize", "fit"); // Mode resize (fit, smartcrop, dll.)
      if (width) netlifyImageUrl.searchParams.set("w", width.toString());
      if (height) netlifyImageUrl.searchParams.set("h", height.toString());
      netlifyImageUrl.searchParams.set("format", "webp"); // Default ke WebP untuk optimasi
      netlifyImageUrl.searchParams.set("q", "80"); // Kualitas default
    }

    // Redirect ke Netlify Image CDN
    return Response.redirect(netlifyImageUrl.toString(), 302);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message) }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
                             }
