// netlify/functions/resize.js
const sharp = require("sharp");

exports.handler = async (event) => {
  const { url, w = "300", q = "80" } = event.queryStringParameters;
  if (!url) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter url wajib ada" }),
    };
  }

  const width = parseInt(w, 10);
  const quality = parseInt(q, 10);

  if (isNaN(width) || width <= 0) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter w harus angka > 0" }),
    };
  }
  if (isNaN(quality) || quality <= 0 || quality > 100) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Parameter q harus angka antara 0-100" }),
    };
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Netlify-Function/1.0",
        "Accept": "image/*",
      },
    });
    if (!response.ok) {
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `Origin responded with status ${response.status}` }),
      };
    }

    const MAX_BYTES = 15 * 1024 * 1024; // 15 MB
    const buffer = await response.buffer();
    if (buffer.length > MAX_BYTES) {
      return {
        statusCode: 413,
        body: JSON.stringify({ error: "Image terlalu besar" }),
      };
    }

    const resizedImage = await sharp(buffer)
      .resize({ width })
      .webp({ quality })
      .toBuffer();

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
    return {
      statusCode: 500,
      body: JSON.stringify({ error: String(err.message) }),
    };
  }
};
