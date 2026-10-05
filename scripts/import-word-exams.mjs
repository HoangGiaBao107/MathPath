import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const python = process.env.MATHPATH_PYTHON || (process.platform === "win32" ? "python" : "python3");
const ingestion = spawnSync(python, [path.join(root, "scripts", "import-word-exams.py")], {
  cwd: root,
  encoding: "utf8",
  stdio: "inherit",
});

if (ingestion.error) {
  process.stderr.write(
    `Could not start Python (${python}). Set MATHPATH_PYTHON to a Python runtime with python-docx installed.\n`,
  );
  process.exit(1);
}
if (ingestion.status !== 0) process.exit(ingestion.status ?? 1);

const prettier = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules", "prettier", "bin", "prettier.cjs"),
    "--write",
    "src/data/mathpath-word-student-previews.json",
    "content/word-import/private-exam-solutions.json",
    "content/word-import/figure-generation-manifest.json",
  ],
  { cwd: root, encoding: "utf8", stdio: "inherit" },
);
if (prettier.error || prettier.status !== 0) process.exit(prettier.status ?? 1);
