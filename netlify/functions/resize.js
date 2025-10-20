// netlify/functions/resize.js
const sharp = require("sharp");

exports.handler = async (event) => {
  console.log("Netlify Function /resize triggered!");
  console.log("Query params:", event.queryStringParameters);

  const { url, w = "300", q = "80" } = event.queryStringParameters;
  if (!url) {
    console.error("Missing url parameter");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter url wajib ada" }),
    };
  }

  const width = parseInt(w, 10);
  const quality = parseInt(q, 10);

  if (isNaN(width) || width <= 0) {
    console.error("Invalid width:", w);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter w harus angka > 0" }),
    };
  }
  if (isNaN(quality) || quality <= 0 || quality > 100) {
    console.error("Invalid quality:", q);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter q harus angka antara 0-100" }),
    };
  }

  try {
    console.log("Fetching image from:", url);
    
    // Extract domain from URL for dynamic Referer
    let refererDomain = "https://www.google.com/";
    try {
      const urlObj = new URL(url);
      refererDomain = `${urlObj.protocol}//${urlObj.hostname}/`;
    } catch (e) {
      console.log("Could not parse URL for referer, using default");
    }
    
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,id;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": refererDomain,
        "Origin": refererDomain.replace(/\/$/, ""),
        "Connection": "keep-alive",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "cross-site",
        "DNT": "1",
        "Upgrade-Insecure-Requests": "1",
      },
    });
    if (!response.ok) {
      console.error("Fetch failed with status:", response.status, "Status text:", response.statusText);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Origin responded with status ${response.status}: ${response.statusText}` }),
      };
    }

    const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
    const buffer = await response.buffer();
    if (buffer.length > MAX_BYTES) {
      console.error("Image too large:", buffer.length);
      return {
        statusCode: 413,
        body: JSON.stringify({ error: "Image terlalu besar" }),
      };
    }

    console.log("Processing image with sharp, width:", width, "quality:", quality);
    const resizedImage = await sharp(buffer)
      .resize({ width })
      .webp({ quality })
      .toBuffer();

    console.log("Image processed successfully");
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
        "X-Resize": `w=${width};q=${quality}`,
      },
      body: resizedImage.toString("base64"),
      isBase64Encoded: true,
    };
  } catch (err) {
    console.error("Netlify Function error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err.message) }),
    };
  }
};
