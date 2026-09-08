const { stat } = require("node:fs/promises");
const { createReadStream } = require("node:fs");
const { Readable } = require("node:stream");

/** Serve byte ranges explicitly: Electron file:// fetch can ignore Range. */
async function mediaResponse(file, request, mime) {
  const { size } = await stat(file);
  const headers = new Headers({
    "content-type": mime,
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
  });
  let start = 0, end = size - 1, status = 200;
  const range = request.method === "HEAD" || request.headers.has("if-range") ? null : request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match && (match[1] || match[2])) {
      if (match[1]) {
        start = Number(match[1]);
        end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
      } else {
        start = Math.max(0, size - Number(match[2]));
      }
    }
    if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || start > end) {
      headers.set("content-range", `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    status = 206;
    headers.set("content-range", `bytes ${start}-${end}/${size}`);
  }
  headers.set("content-length", String(Math.max(0, end - start + 1)));
  if (request.method === "HEAD" || size === 0) return new Response(null, { status, headers });
  return new Response(Readable.toWeb(createReadStream(file, { start, end })), { status, headers });
}

module.exports = { mediaResponse };
