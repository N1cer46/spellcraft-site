/**
 * Hand-drawn recognition references. Samples are recorded with the standalone tool
 * (tools/record-templates.mjs) into client/public/reference-templates.json and served
 * to the browser as a static asset, so freshly recorded templates show up without a
 * rebuild. The same file is shipped to every user.
 *
 * A sample mirrors the user's input format exactly: an array of strokes, each stroke
 * an array of points — no vectorization, no PNG processing, no skeletonization.
 */

export type TemplatePoint = { x: number; y: number; t?: number };
/** One hand-drawn sample of a symbol: a list of strokes, each stroke a list of points. */
export type ReferenceSample = TemplatePoint[][];
/** symbolId → recorded samples (5–8 per symbol). */
export type ReferenceTemplates = Record<string, ReferenceSample[]>;

let templates: ReferenceTemplates | null = null;
let loadPromise: Promise<ReferenceTemplates> | null = null;

/** Fetches the runtime-served template file once per page load and caches it in memory. */
export function loadReferenceTemplates(): Promise<ReferenceTemplates> {
  if (templates) return Promise.resolve(templates);
  if (!loadPromise) {
    // BASE_URL ends with "/", so the result is always a correct absolute path both in dev ("/")
    // and on GitHub Pages ("/<repo>/"). The optional chain keeps tests outside Vite (plain node
    // has no import.meta.env) working — they resolve the file relative to the project root.
    const base = import.meta.env?.BASE_URL ?? "/";
    loadPromise = fetch(`${base}reference-templates.json`)
      .then((response) => {
        if (!response.ok) throw new Error(`Не удалось загрузить эталоны: ${response.status}`);
        return response.json();
      })
      .then((data) => {
        if (!data || typeof data !== "object" || Array.isArray(data) || !Object.values(data).every(samples =>
          Array.isArray(samples) && samples.every(sample => Array.isArray(sample) && sample.every(stroke =>
            Array.isArray(stroke) && stroke.every(point => point && Number.isFinite(point.x) && Number.isFinite(point.y))
          ))
        )) throw new Error("Некорректный формат эталонов");
        templates = data as ReferenceTemplates;
        return templates;
      })
      .catch((error) => {
        loadPromise = null;
        throw error;
      });
  }
  return loadPromise;
}

/** Raw recorded samples for a symbol (templates must be loaded first — see loadReferenceTemplates). */
export function samplesFor(symbolId: string): ReferenceSample[] {
  const samples = templates?.[symbolId];
  return Array.isArray(samples) ? samples : [];
}

/** Test hook: injects templates directly (outside the browser fetch/base-URL don't apply). */
export function setReferenceTemplatesForTests(data: ReferenceTemplates) {
  templates = data;
  loadPromise = Promise.resolve(data);
}
