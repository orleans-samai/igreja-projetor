#!/usr/bin/env node
/**
 * Gera o ícone do Windows a partir da marca em public/favicon.svg.
 *
 * O PNG de 180px que existia antes não servia: o electron-builder recusa
 * ícone menor que 256×256 e o instalador nem chegava a ser gerado. Aqui a
 * marca é rasterizada direto do vetor, então sai nítida em qualquer tamanho.
 *
 * Saída:
 *   desktop/build/icon.ico  — 16…256, usado no .exe e no instalador
 *   desktop/build/icon.png  — 256, usado na janela do app
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = join(root, "public", "favicon.svg");
const outDir = join(root, "desktop", "build");
const SIZES = [16, 24, 32, 48, 64, 128, 256];
const SUPERSAMPLE = 4;

// ---------------------------------------------------------------- svg

/**
 * Lê o subconjunto de SVG que a marca usa: rect (com rx), circle e um path
 * de linhas retas. Não é um parser geral — é o suficiente para o favicon,
 * e falha alto se a marca ganhar uma forma que ele não conhece.
 */
function readMark(svg) {
  const viewBox = /viewBox="([^"]+)"/.exec(svg);
  if (!viewBox) throw new Error("favicon.svg sem viewBox");
  const [, , vw, vh] = viewBox[1].trim().split(/\s+/).map(Number);

  const shapes = [];
  const tags = svg.match(/<(rect|circle|path)\b[^>]*\/?>/g) ?? [];
  for (const tag of tags) {
    const attr = (name) => {
      // o espaço antes do nome evita que "x" case dentro de "rx"
      const hit = new RegExp(`\\s${name}="([^"]*)"`).exec(tag);
      return hit ? hit[1] : null;
    };
    const num = (name, fallback = 0) => {
      const raw = attr(name);
      return raw === null ? fallback : Number(raw);
    };
    const fill = attr("fill") ?? "#000000";

    if (tag.startsWith("<rect")) {
      shapes.push({
        kind: "rect",
        x: num("x"),
        y: num("y"),
        w: num("width"),
        h: num("height"),
        r: num("rx"),
        fill,
      });
    } else if (tag.startsWith("<circle")) {
      shapes.push({ kind: "circle", cx: num("cx"), cy: num("cy"), r: num("r"), fill });
    } else {
      const d = attr("d");
      if (!d) throw new Error("path sem d em favicon.svg");
      shapes.push({ kind: "poly", points: parsePath(d), fill });
    }
  }
  if (!shapes.length) throw new Error("favicon.svg sem formas");
  return { vw, vh, shapes };
}

/** Só M/L/H/V/Z absolutos — o que a marca usa. */
function parsePath(d) {
  const points = [];
  let x = 0;
  let y = 0;
  const tokens = d.trim().match(/[MLHVZ][^MLHVZ]*/gi) ?? [];
  for (const token of tokens) {
    const cmd = token[0].toUpperCase();
    const args = token
      .slice(1)
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    if (cmd === "Z") continue;
    if (cmd === "M" || cmd === "L") {
      for (let i = 0; i + 1 < args.length; i += 2) {
        x = args[i];
        y = args[i + 1];
        points.push([x, y]);
      }
    } else if (cmd === "H") {
      for (const a of args) {
        x = a;
        points.push([x, y]);
      }
    } else if (cmd === "V") {
      for (const a of args) {
        y = a;
        points.push([x, y]);
      }
    } else {
      throw new Error(`comando de path não suportado: ${cmd}`);
    }
  }
  if (points.length < 3) throw new Error("path com menos de 3 pontos");
  return points;
}

function parseColor(hex) {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.replace(/./g, (c) => c + c) : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

// ------------------------------------------------------------ raster

function insideRect(s, px, py) {
  if (px < s.x || py < s.y || px > s.x + s.w || py > s.y + s.h) return false;
  const r = Math.min(s.r, s.w / 2, s.h / 2);
  if (r <= 0) return true;
  // fora dos quatro cantos arredondados?
  const cx = Math.min(Math.max(px, s.x + r), s.x + s.w - r);
  const cy = Math.min(Math.max(py, s.y + r), s.y + s.h - r);
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

function insideCircle(s, px, py) {
  const dx = px - s.cx;
  const dy = py - s.cy;
  return dx * dx + dy * dy <= s.r * s.r;
}

function insidePoly(points, px, py) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** Desenha a marca em `size`×`size` com antialiasing por supersampling. */
function raster(mark, size) {
  const big = size * SUPERSAMPLE;
  const scale = big / mark.vw;
  const px = new Uint8Array(big * big * 4);

  for (const shape of mark.shapes) {
    const [r, g, b] = parseColor(shape.fill);
    for (let y = 0; y < big; y++) {
      // amostra no centro do pixel, em unidades do viewBox
      const uy = (y + 0.5) / scale;
      for (let x = 0; x < big; x++) {
        const ux = (x + 0.5) / scale;
        const hit =
          shape.kind === "rect"
            ? insideRect(shape, ux, uy)
            : shape.kind === "circle"
              ? insideCircle(shape, ux, uy)
              : insidePoly(shape.points, ux, uy);
        if (!hit) continue;
        const i = (y * big + x) * 4;
        px[i] = r;
        px[i + 1] = g;
        px[i + 2] = b;
        px[i + 3] = 255;
      }
    }
  }

  // média das amostras → cor e cobertura do pixel final
  const out = Buffer.alloc(size * size * 4);
  const n = SUPERSAMPLE * SUPERSAMPLE;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const i = ((y * SUPERSAMPLE + sy) * big + (x * SUPERSAMPLE + sx)) * 4;
          const alpha = px[i + 3] / 255;
          r += px[i] * alpha;
          g += px[i + 1] * alpha;
          b += px[i + 2] * alpha;
          a += alpha;
        }
      }
      const o = (y * size + x) * 4;
      if (a > 0) {
        out[o] = Math.round(r / a);
        out[o + 1] = Math.round(g / a);
        out[o + 2] = Math.round(b / a);
      }
      out[o + 3] = Math.round((a / n) * 255);
    }
  }
  return out;
}

// --------------------------------------------------------------- png

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filtro None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// --------------------------------------------------------------- ico

function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2); // tipo ícone
  header.writeUInt16LE(images.length, 4);

  const dir = Buffer.alloc(16 * images.length);
  let offset = header.length + dir.length;
  images.forEach((img, i) => {
    const e = i * 16;
    dir[e] = img.size >= 256 ? 0 : img.size; // 0 significa 256
    dir[e + 1] = img.size >= 256 ? 0 : img.size;
    dir[e + 2] = 0; // cores da paleta
    dir[e + 3] = 0;
    dir.writeUInt16LE(1, e + 4); // planos
    dir.writeUInt16LE(32, e + 6); // bits por pixel
    dir.writeUInt32LE(img.png.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += img.png.length;
  });

  return Buffer.concat([header, dir, ...images.map((img) => img.png)]);
}

// -------------------------------------------------------------- main

const mark = readMark(readFileSync(svgPath, "utf8"));
mkdirSync(outDir, { recursive: true });

const images = SIZES.map((size) => ({ size, png: encodePng(size, raster(mark, size)) }));
writeFileSync(join(outDir, "icon.ico"), encodeIco(images));

const png256 = images.find((img) => img.size === 256);
writeFileSync(join(outDir, "icon.png"), png256.png);

console.log(`ícone gerado de favicon.svg — ${SIZES.join(", ")} px`);
console.log(`  desktop/build/icon.ico`);
console.log(`  desktop/build/icon.png (256)`);
