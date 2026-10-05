import { spawnSync } from "node:child_process";
import console from "node:console";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts", "ingest-real-sources.py");
const candidates = process.env.MATHPATH_PYTHON
  ? [process.env.MATHPATH_PYTHON]
  : process.platform === "win32"
    ? ["python", "py"]
    : ["python3", "python"];

let result;
for (const python of candidates) {
  result = spawnSync(python, [script], { cwd: root, encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (!result.error || result.error.code !== "ENOENT") break;
}
if (!result || result.error) {
  console.error("Python was not found. Install requirements-pdf.txt or set MATHPATH_PYTHON.");
  process.exit(1);
}
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
