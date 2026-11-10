// Runs the production recognizer; no separately maintained copy of the algorithm.
import { spawnSync } from "node:child_process";
const result = spawnSync(process.execPath, ["--import", "tsx", "tests/recognition-benchmark.ts", process.argv[2] || "freehand"], { stdio: "inherit" });
if (result.error) throw result.error;
process.exit(result.status ?? 1);
