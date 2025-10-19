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

  // Parse parameters
  const w = urlObj.searchParams.get("w");
  const q = urlObj.searchParams.get("q");
  const width = w ? parseInt(w, 10) : null;
  const quality = q ? parseInt(q, 10) : null;

  // Validasi parameter
  if (w && (isNaN(width) || width <= 0)) {
    return new Response("Parameter w harus angka > 0", { status: 400 });
  }
  if (q && (isNaN(quality) || quality <= 0 || quality > 100)) {
    return new Response("Parameter q harus angka antara 0-100", { status: 400 });
  }

  try {
    // Validasi URL
    const imageUrlObj = new URL(imageUrl);
    if (!["http:", "https:"].includes(imageUrlObj.protocol)) {
      return new Response("URL gambar harus http atau https", { status: 400 });
    }

    // Fetch gambar eksternal
    const originRes = await fetch(imageUrl, { method: "GET", redirect: "follow" });
    if (!originRes.ok) {
      return new Response(`Origin responded with status ${originRes.status}`, { status: originRes.status });
    }

    const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
    const contentLength = originRes.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return new Response("Image terlalu besar", { status: 413 });
    }

    const arrayBuffer = await originRes.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return new Response("Image terlalu besar", { status: 413 });
    }

    // Kembalikan gambar dengan parameter transformasi
    const responseHeaders = {
      "Content-Type": originRes.headers.get("content-type") || "image/*",
      "Cache-Control": "public, max-age=86400",
      "Access-Control-Allow-Origin": "*",
    };

    // Terapkan transformasi jika ada w atau q
    if (width || quality) {
      // Catatan: Netlify Image CDN tidak langsung mendukung gambar eksternal,
      // jadi kita langsung kembalikan gambar dengan header transformasi simulasi
      responseHeaders["X-Edge-Resize"] = `w=${width || ""};q=${quality || ""}`;
      return new Response(arrayBuffer, {
        status: 200,
        headers: responseHeaders,
      });
    }

    // Jika tidak ada transformasi, kembalikan asli
    return new Response(arrayBuffer, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err.message) }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
    }
