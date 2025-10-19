// netlify/edge-functions/gambar.js
// Edge function: fetch image, optional resize via @squoosh/lib (WASM).
// Requires bundling @squoosh/lib and packaging its WASM files alongside the function.

import { ImagePool } from "@squoosh/lib";

export const config = { /* runtime default for Netlify Edge */ };

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
  if (!imageUrl) return new Response("Parameter ?url= wajib ada", { status: 400 });

  // parse resize params
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

  // limit input size (adjust as needed)
  const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

  try {
    const originRes = await fetch(imageUrl, { method: "GET", redirect: "follow" });
    if (!originRes.ok) {
      return new Response(`Origin responded with status ${originRes.status}`, { status: originRes.status });
    }

    const contentLength = originRes.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return new Response("Image terlalu besar", { status: 413 });
    }

    const arrayBuffer = await originRes.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return new Response("Image terlalu besar", { status: 413 });
    }

    // If no resize requested, return original bytes
    if (!width && !height) {
      return new Response(arrayBuffer, {
        status: 200,
        headers: {
          "Content-Type": originRes.headers.get("content-type") || "image/*",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // --- RESIZE PATH using @squoosh/lib (WASM) ---
    // Note: ImagePool is resource-managed; close it after use.
    // We will output webp by default; change encoder/options if you want another format.
    const imagePool = new ImagePool();
    try {
      const image = imagePool.ingestImage(new Uint8Array(arrayBuffer));
      // Wait for image decode step (ImagePool handles decode internally when needed)
      // Encode with resize options into webp
      const encodeOptions = {
        webp: {
          quality: 80,
        },
        resize: {}
      };

      // Only set width/height keys if provided
      if (width) encodeOptions.resize.width = width;
      if (height) encodeOptions.resize.height = height;

      // Squoosh expects encode options at encode() call; also set resize in encode options:
      await image.encode({
        // webp encoder + resize options:
        webp: encodeOptions.webp,
        // squoosh supports `resize` top-level inside encode call for many setups:
        // Note: some versions require `image.resize` API, but most accept a `resize` property
        resize: {
          width: encodeOptions.resize.width || undefined,
          height: encodeOptions.resize.height || undefined,
          // fitMethod options may vary: "lanczos3" is a good default
          method: "lanczos3"
        }
      });

      // Get encoded binary for webp
      const encoded = image.encodedWith["webp"];
      if (!encoded || !encoded.binary) {
        throw new Error("Encoding gagal: tidak ada hasil webp");
      }

      const outBuf = encoded.binary; // Uint8Array
      return new Response(outBuf, {
        status: 200,
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=86400",
          "Access-Control-Allow-Origin": "*",
          "X-Edge-Resize": `w=${width||""};h=${height||""}`
        },
      });
    } finally {
      // free resources
      await imagePool.close();
    }
  } catch (err) {
    // If squoosh not present or runs into error, return 500 with message
    return new Response(JSON.stringify({ error: String(err && err.message) }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
            }
