const path = require("node:path");
const fs = require("node:fs/promises");
const ROUTES = new Set(["/", "/projetor", "/palco", "/pedido", "/instalar"]);
async function resolveAsset(root, rawUrl) {
  const url = new URL(rawUrl);
  if (url.protocol !== "lumen:" || url.hostname !== "app") return null;
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { return null; }
  if (pathname.includes("\\") || pathname.includes("\0") || pathname.split("/").includes("..")) return null;
  const relative = ROUTES.has(pathname) ? "index.html" : pathname.slice(1);
  // NTFS alternate streams must never be interpreted as file paths.
  if (relative.includes(":")) return null;
  const file = path.resolve(root, relative);
  if (!file.startsWith(path.resolve(root) + path.sep)) return null;
  try { return (await fs.stat(file)).isFile() ? file : null; } catch { return null; }
}
module.exports = { resolveAsset };
