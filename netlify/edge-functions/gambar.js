// Netlify Edge Function: gambar
// Path: /gambar/?url=<image_url>
// Note: Edge runtime (V8 isolate) — no sharp, no fs, use Web Fetch API.

export default async function (request, context) {
  const urlObj = new URL(request.url);
  const imageUrl = urlObj.searchParams.get('url');
  if (!imageUrl) {
    return new Response('Parameter ?url= wajib ada', { status: 400 });
  }

  // Basic validation
  let parsed;
  try {
    parsed = new URL(imageUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return new Response('Invalid URL protocol', { status: 400 });
    }
  } catch (e) {
    return new Response('Invalid URL', { status: 400 });
  }

  const MAX_BYTES = 5 * 1024 * 1024; // 5 MB limit (adjust as needed)

  try {
    // Fast attempt (default headers)
    let res = await fetch(imageUrl, { method: 'GET', redirect: 'follow' });

    // If origin returned 403, try a simple header-based fallback
    if (res.status === 403) {
      // **WARNING**: Modifying headers to bypass hotlink restrictions may violate Terms of Service.
      // Use only when you have right to fetch the image.
      const altHeaders = new Headers();
      altHeaders.set('Referer', 'https://example.com/');
      altHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
      res = await fetch(imageUrl, { method: 'GET', redirect: 'follow', headers: altHeaders });
    }

    if (res.status !== 200) {
      return new Response(`Origin responded with status ${res.status}`, { status: res.status });
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && Number(contentLength) > MAX_BYTES) {
      return new Response('Image terlalu besar', { status: 413 });
    }

    const contentType = res.headers.get('content-type') || 'application/octet-stream';
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      return new Response('Image terlalu besar', { status: 413 });
    }

    // Return image bytes directly so Netlify/CDN can cache at edge
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 1 day cache; tune as needed
      },
    });
  } catch (err) {
    return new Response('Error saat mengambil gambar: ' + String(err.message), { status: 502 });
  }
}
