import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import process from "node:process";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const python = process.env.MATHPATH_PYTHON || (process.platform === "win32" ? "python" : "python3");
const result = spawnSync(python, [path.join(root, "scripts", "import-topic-word-exams.py")], {
  cwd: root,
  encoding: "utf8",
  stdio: "inherit",
});

if (result.error) {
  process.stderr.write(
    `Could not start Python (${python}). Set MATHPATH_PYTHON to a runtime with python-docx installed.\n`,
  );
  process.exit(1);
}
if (result.status !== 0) process.exit(result.status ?? 1);

const prettier = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules", "prettier", "bin", "prettier.cjs"),
    "--write",
    "src/data/mathpath-topic-practice-exams.json",
    "content/word-import/private-topic-practice-keys.json",
  ],
  { cwd: root, encoding: "utf8", stdio: "inherit" },
);
if (prettier.error || prettier.status !== 0) process.exit(prettier.status ?? 1);
