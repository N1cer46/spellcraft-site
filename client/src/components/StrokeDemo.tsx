import { useEffect, useState } from "react";
import {
  loadReferenceTemplates,
  type ReferenceSample,
} from "@/data/reference-templates";
export default function StrokeDemo({ id }: { id: string }) {
  const [sample, setSample] = useState<ReferenceSample | null>(null),
    [step, setStep] = useState(0),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setSample(null);
    setStep(0);
    setError("");
    loadReferenceTemplates()
      .then(t => {
        if (alive) {
          const example = t[id]?.[0];
          if (example?.length) setSample(example);
          else setError("Для этого символа пока нет примера штрихов.");
        }
      })
      .catch(() => {
        if (alive) setError("Не удалось загрузить пример");
      });
    return () => {
      alive = false;
    };
  }, [id]);
  const points = sample?.flat() ?? [];
  const xs = points.map(p => p.x),
    ys = points.map(p => p.y);
  const x = Math.min(...xs),
    y = Math.min(...ys),
    size = Math.max(Math.max(...xs) - x, Math.max(...ys) - y, 1);
  return (
    <details>
      <summary>Порядок штрихов</summary>
      {error ? (
        <p>{error}</p>
      ) : sample ? (
        <>
          <svg
            viewBox="-10 -10 120 120"
            width="160"
            height="160"
            aria-label="Пример начертания"
          >
            {sample.slice(0, step + 1).map((stroke, i) => (
              <polyline
                key={i}
                points={stroke
                  .map(
                    p =>
                      `${((p.x - x) / size) * 100},${((p.y - y) / size) * 100}`
                  )
                  .join(" ")}
                fill="none"
                stroke={i === step ? "#ad7833" : "#315a48"}
                strokeWidth="2"
              />
            ))}
          </svg>
          <p>
            Штрих {step + 1} из {sample.length}. Порядок рекомендательный.
          </p>
          <button onClick={() => setStep((step + 1) % sample.length)}>
            Следующий штрих
          </button>
        </>
      ) : (
        <p>Загрузка примера…</p>
      )}
    </details>
  );
}
