// Standalone replica of recognizer.ts vectorization, runnable inside the preview page.
async function vectorize(src) {
  const image = await new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = reject; img.src = src; });
  const size = 192;
  const canvas = document.createElement("canvas");
  canvas.width = size; canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.clearRect(0, 0, size, size);
  context.drawImage(image, 0, 0, size, size);
  const pixels = context.getImageData(0, 0, size, size).data;
  const binary = new Uint8Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    const lum = pixels[o] * 0.2126 + pixels[o + 1] * 0.7152 + pixels[o + 2] * 0.0722;
    binary[i] = pixels[o + 3] > 24 && lum < 235 ? 1 : 0;
  }
  const value = (x, y) => binary[y * size + x];
  let changed = true, guard = 0;
  while (changed && guard < 48) {
    changed = false;
    const del1 = [];
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      if (!value(x, y)) continue;
      const p2 = value(x, y - 1), p3 = value(x + 1, y - 1), p4 = value(x + 1, y), p5 = value(x + 1, y + 1);
      const p6 = value(x, y + 1), p7 = value(x - 1, y + 1), p8 = value(x - 1, y), p9 = value(x - 1, y - 1);
      const n = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
      const t = (p2 === 0 && p3 === 1 ? 1 : 0) + (p3 === 0 && p4 === 1 ? 1 : 0) + (p4 === 0 && p5 === 1 ? 1 : 0) + (p5 === 0 && p6 === 1 ? 1 : 0) + (p6 === 0 && p7 === 1 ? 1 : 0) + (p7 === 0 && p8 === 1 ? 1 : 0) + (p8 === 0 && p9 === 1 ? 1 : 0) + (p9 === 0 && p2 === 1 ? 1 : 0);
      if (n >= 2 && n <= 6 && t === 1 && p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0) del1.push(y * size + x);
    }
    if (del1.length) changed = true;
    del1.forEach((i) => { binary[i] = 0; });
    const del2 = [];
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      if (!value(x, y)) continue;
      const p2 = value(x, y - 1), p3 = value(x + 1, y - 1), p4 = value(x + 1, y), p5 = value(x + 1, y + 1);
      const p6 = value(x, y + 1), p7 = value(x - 1, y + 1), p8 = value(x - 1, y), p9 = value(x - 1, y - 1);
      const n = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
      const t = (p2 === 0 && p3 === 1 ? 1 : 0) + (p3 === 0 && p4 === 1 ? 1 : 0) + (p4 === 0 && p5 === 1 ? 1 : 0) + (p5 === 0 && p6 === 1 ? 1 : 0) + (p6 === 0 && p7 === 1 ? 1 : 0) + (p7 === 0 && p8 === 1 ? 1 : 0) + (p8 === 0 && p9 === 1 ? 1 : 0) + (p9 === 0 && p2 === 1 ? 1 : 0);
      if (n >= 2 && n <= 6 && t === 1 && p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) del2.push(y * size + x);
    }
    if (del2.length) changed = true;
    del2.forEach((i) => { binary[i] = 0; });
    guard++;
  }
  const points = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (binary[y * size + x]) points.push({ x, y });
  // normalize with 160 samples
  const SAMPLE = 160;
  const sampled = [];
  if (points.length === 1) for (let i = 0; i < SAMPLE; i++) sampled.push(points[0]);
  else for (let i = 0; i < SAMPLE; i++) sampled.push(points[Math.round((i / (SAMPLE - 1)) * (points.length - 1))]);
  const minX = Math.min(...sampled.map((p) => p.x)), maxX = Math.max(...sampled.map((p) => p.x));
  const minY = Math.min(...sampled.map((p) => p.y)), maxY = Math.max(...sampled.map((p) => p.y));
  const scale = Math.max(maxX - minX, maxY - minY, 1);
  const scaled = sampled.map((p) => ({ x: ((p.x - minX) / scale) * 2 - 1, y: ((p.y - minY) / scale) * 2 - 1 }));
  const cx = scaled.reduce((s, p) => s + p.x / scaled.length, 0), cy = scaled.reduce((s, p) => s + p.y / scaled.length, 0);
  return scaled.map((p) => ({ x: p.x - cx, y: p.y - cy }));
}
