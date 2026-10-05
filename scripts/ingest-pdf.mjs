import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import console from "node:console";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const input = args[0];

if (!input || args.length > 1) {
  console.error("Usage: npm run ingest:pdf -- <input.pdf>");
  process.exit(2);
}

const pdfPath = path.resolve(process.cwd(), input);
const sourcePdfDirectory = path.resolve(root, "content/source-pdfs");
if (pdfPath === sourcePdfDirectory || pdfPath.startsWith(`${sourcePdfDirectory}${path.sep}`)) {
  console.error(
    "Phase 6A is fixture-only. PDFs in content/source-pdfs are protected from ingestion.",
  );
  process.exit(2);
}

const slug = path
  .basename(input, path.extname(input))
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, "-");
if (!slug || slug === "." || slug === "..") {
  console.error("Could not derive a safe output slug from the PDF filename.");
  process.exit(2);
}

const outputDirectory = path.join(root, "content", "extracted", slug);
const script = path.join(root, "scripts", "pdf_ingestion.py");
const pythonCandidates = process.env.MATHPATH_PYTHON
  ? [process.env.MATHPATH_PYTHON]
  : process.platform === "win32"
    ? ["python", "py"]
    : ["python3", "python"];

let result;
for (const python of pythonCandidates) {
  if (python.includes(path.sep) && !existsSync(python)) continue;
  result = spawnSync(python, [script, pdfPath, outputDirectory], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (!result.error || result.error.code !== "ENOENT") break;
}

if (!result || result.error) {
  console.error(
    "Python was not found. Install Python 3.11+ and requirements-pdf.txt, or set MATHPATH_PYTHON.",
  );
  process.exit(1);
}
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);
