import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const source = path.join(root, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const targetDirectory = path.join(root, "public", "pdfjs");
const target = path.join(targetDirectory, "pdf.worker.min.mjs");

await mkdir(targetDirectory, { recursive: true });
await copyFile(source, target);
