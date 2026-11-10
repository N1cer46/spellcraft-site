#!/usr/bin/env node
/**
 * Локальная студия записи эталонов — отдельный инструмент, не входящий в сайт.
 *
 * Запуск из корня проекта:
 *   node tools/record-templates.mjs
 *
 * Затем открыть напечатанный URL, нарисовать каждый символ 5–8 раз мышью и просто
 * нажимать «В эталон» — образцы сразу пишутся в
 * client/public/reference-templates.json. Этот JSON раздаётся сайтом как статический
 * актив и используется распознавателем для всех пользователей.
 */
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SPELLBOOK_PATH = join(ROOT, "client", "src", "data", "spellbook.ts");
const TEMPLATES_PATH = join(ROOT, "client", "public", "reference-templates.json");
const PUBLIC_PATH = join(ROOT, "client", "public");
const HTML_PATH = join(__dirname, "record-templates.html");
const SYMBOLS_BASE = resolve(PUBLIC_PATH, "symbols");

const PORT = Number(process.env.PORT) || 4390;

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Pulls symbol definitions out of spellbook.ts — its sigil()/mark() calls are strictly regular. */
function extractSymbols() {
  const source = readFileSync(SPELLBOOK_PATH, "utf8");
  const pattern = /(sigil|mark)\("([^"]+)", "([^"]+)", "([^"]+)", "([^"]+)", "([^"]+)"\)/g;
  const symbols = [];
  let match;
  while ((match = pattern.exec(source))) {
    const [, kind, id, name, assetKey, group, description] = match;
    const folder = kind === "sigil" ? "sigils" : "signs";
    symbols.push({ id, kind, name, assetKey, group, description, image: `/symbols/${folder}/${slugify(assetKey)}.png` });
  }
  return symbols;
}

function readTemplates() {
  try {
    return JSON.parse(readFileSync(TEMPLATES_PATH, "utf8"));
  } catch {
    return {};
  }
}

const isPoint = (value) =>
  Boolean(value) && typeof value === "object" &&
  typeof value.x === "number" && Number.isFinite(value.x) &&
  typeof value.y === "number" && Number.isFinite(value.y);
const isStroke = (value) => Array.isArray(value) && value.length >= 2 && value.every(isPoint);
const isSample = (value) => Array.isArray(value) && value.length >= 1 && value.every(isStroke);
const isValidPayload = (body) =>
  Boolean(body) && typeof body === "object" && !Array.isArray(body) &&
  Object.values(body).every((samples) => Array.isArray(samples) && samples.length >= 1 && samples.every(isSample));

function readBody(request) {
  return new Promise((resolvePromise, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => resolvePromise(body));
    request.on("error", reject);
  });
}

const symbols = extractSymbols();
const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);
  try {
    // no-store: у инструмента нет версий/хешей, а при итерации на эталонах кешированный
    // старый HTML/JSON — это гарантированный источник «ничего не поменялось».
    const noStore = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
    if (request.method === "GET" && url.pathname === "/") {
      const html = await readFile(HTML_PATH, "utf8");
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      response.end(html);
      return;
    }
    if (request.method === "GET" && url.pathname === "/symbols.json") {
      response.writeHead(200, noStore);
      response.end(JSON.stringify(symbols));
      return;
    }
    if (url.pathname === "/templates") {
      if (request.method === "GET") {
        response.writeHead(200, noStore);
        response.end(JSON.stringify(readTemplates(), null, 2));
        return;
      }
      if (request.method === "POST") {
        const payload = JSON.parse(await readBody(request));
        if (!isValidPayload(payload)) {
          response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ success: false, error: "Неверный формат эталонов." }));
          return;
        }
        const tmpPath = `${TEMPLATES_PATH}.tmp`;
        writeFileSync(tmpPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
        renameSync(tmpPath, TEMPLATES_PATH);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ success: true }));
        return;
      }
    }
    if (request.method === "GET" && url.pathname.startsWith("/symbols/")) {
      const relative = url.pathname.slice("/symbols/".length);
      const file = resolve(SYMBOLS_BASE, relative);
      if (!file.startsWith(SYMBOLS_BASE + sep)) {
        response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Forbidden");
        return;
      }
      try {
        response.writeHead(200, { "Content-Type": "image/png" });
        response.end(await readFile(file));
      } catch {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not found");
      }
      return;
    }
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  Студия записи эталонов запущена локально:\n`);
  console.log(`    http://localhost:${PORT}/\n`);
  console.log(`  Символов в картотеке: ${symbols.length}`);
  console.log(`  Записывается в:       ${TEMPLATES_PATH}\n`);
  console.log(`  Нарисуйте каждый символ 5–8 раз и нажимайте «В эталон» — сохранение происходит сразу.`);
  console.log(`  Остановить: Ctrl+C\n`);
});
