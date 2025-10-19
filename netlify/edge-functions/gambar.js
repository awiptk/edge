// netlify/edge-functions/gambar.js
// Edge function "lebih kuat" untuk mengambil gambar dengan beberapa strategi
// WARNING: Jangan gunakan untuk melanggar Terms of Service situs origin.

export default async function (request, context) {
  // OPTIONS / preflight
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

  // Validation
  let parsed;
  try {
    parsed = new URL(imageUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return new Response("Invalid URL protocol", { status: 400 });
    }
  } catch (e) {
    return new Response("Invalid URL", { status: 400 });
  }

  const MAX_BYTES = 15 * 1024 * 1024; // batas 15MB
  const originHost = parsed.host;

  // Candidate header sets (urut dari paling "browser-like")
  const attempts = [
    {
      "Referer": `https://${originHost}/`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
      "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-Mode": "no-cors",
      "Sec-Fetch-Dest": "image",
      "Accept-Language": "en-US,en;q=0.9"
    },
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9"
    },
    {
      "Referer": `https://${originHost}/`,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      "Accept": "*/*"
    },
    // Range attempt
    {
      "Referer": `https://${originHost}/`,
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Accept": "*/*",
      "Range": "bytes=0-"
    },
  ];

  // Public proxy fallbacks (you may add/remove)
  const proxyFallbacks = [
    // images.weserv.nl expects URL without protocol (host + path + query)
    (p) => `https://images.weserv.nl/?url=${encodeURIComponent(p.host + p.pathname + p.search)}`,
    // add more proxies if you trust them / need (careful with rate limits & privacy)
  ];

  let lastRes = null;
  let lastErr = null;

  // 1) Try HEAD first to quickly check status (some origins respond to HEAD)
  try {
    const headRes = await fetch(imageUrl, { method: "HEAD", redirect: "follow" });
    if (headRes && headRes.status === 200) {
      // if HEAD OK and content-type image, try GET with first header set
      const ct = headRes.headers.get("content-type") || "";
      if (ct.startsWith("image/")) {
        // proceed to normal GET below (without wasting too many attempts)
        // fallthrough to attempts loop
      }
    }
  } catch (e) {
    // ignore head error, proceed to GET attempts
    console.log("HEAD failed:", e && e.message);
  }

  // 2) Try various GET attempts with different headers
  for (const hdrs of attempts) {
    try {
      const headers = new Headers();
      for (const k of Object.keys(hdrs)) headers.set(k, hdrs[k]);

      const res = await fetch(imageUrl, { method: "GET", redirect: "follow", headers });
      lastRes = res;

      // If 200 and content-type is image, return bytes
      if (res.status === 200) {
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.startsWith("image/")) {
          // not an image — continue trying
          console.log("response not image, content-type:", contentType);
        } else {
          const contentLength = res.headers.get("content-length");
          if (contentLength && Number(contentLength) > MAX_BYTES) {
            return new Response("Image terlalu besar", { status: 413 });
          }
          const arrayBuffer = await res.arrayBuffer();
          if (arrayBuffer.byteLength > MAX_BYTES) return new Response("Image terlalu besar", { status: 413 });

          // Success — return image with caching + CORS
          return new Response(arrayBuffer, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=86400",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      }

      // If 401/302/307 → likely auth or redirect to login; break early to fallback proxies
      if ([401, 302, 307].includes(res.status)) {
        console.log("early exit status", res.status);
        break;
      }

      // continue to next header set
    } catch (err) {
      lastErr = err;
      console.log("fetch error attempt:", err && err.message);
    }
  }

  // 3) If above failed, try public proxy fallbacks (images.weserv.nl)
  for (const proxyFn of proxyFallbacks) {
    try {
      const proxyUrl = proxyFn(parsed);
      console.log("trying proxy:", proxyUrl);
      const pRes = await fetch(proxyUrl, { method: "GET", redirect: "follow" });
      lastRes = pRes;
      if (pRes && pRes.status === 200) {
        const contentType = pRes.headers.get("content-type") || "application/octet-stream";
        const arrayBuffer = await pRes.arrayBuffer();
        if (arrayBuffer.byteLength > MAX_BYTES) return new Response("Image terlalu besar", { status: 413 });

        // return proxied image (note: proxied response may change headers)
        return new Response(arrayBuffer, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
            "X-Proxy-Used": "images.weserv.nl"
          },
        });
      }
    } catch (e) {
      console.log("proxy fetch error:", e && e.message);
      lastErr = e;
    }
  }

  // 4) Semua gagal — kembalikan info debug
  const debugHeaders = {};
  if (lastRes && lastRes.headers) {
    ["server", "x-cache", "content-type", "www-authenticate", "set-cookie", "cf-ray"].forEach(h => {
      try { debugHeaders[h] = lastRes.headers.get(h) } catch(e) {}
    });
  }

  const debug = {
    ok: false,
    message: "Gagal ambil gambar dari origin; origin kemungkinan menolak (403) atau butuh token/IP whitelist.",
    lastStatus: lastRes ? lastRes.status : 502,
    lastStatusText: lastRes ? (lastRes.statusText || "") : (lastErr ? String(lastErr.message) : "no-response"),
    debugHeaders,
    note: "Jika origin memblokir berdasarkan IP atau signed URL, Edge tidak bisa bypass. Pertimbangkan serverless atau caching setelah mendapat izin."
  };

  return new Response(JSON.stringify(debug, null, 2), {
    status: 502,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
      }
