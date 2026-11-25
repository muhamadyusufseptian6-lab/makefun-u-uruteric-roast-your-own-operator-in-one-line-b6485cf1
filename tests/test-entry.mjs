// TDD-lite test for the roast entry: run with `node tests/test-entry.mjs`.
// Requires main.ts to exist; run from the entry dir root.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoDir = dirname(dirname(fileURLToPath(import.meta.url)));

function runOnce(outDir) {
  execFileSync("node", ["main.ts"], {
    cwd: repoDir,
    env: { ...process.env, MAKEFUN_OUTPUT_DIR: outDir },
    stdio: "pipe",
  });
  return readFileSync(join(outDir, "entry.txt"), "utf8");
}

let failures = 0;
function check(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? " — " + detail : ""}`);
  if (!ok) failures++;
}

// 1. main.ts exists and runs, writing entry.txt
const out1 = mkdtempSync(join(tmpdir(), "roast-out-"));
let text;
try {
  text = runOnce(out1);
  check("main.ts runs and writes entry.txt", true);
} catch (e) {
  check("main.ts runs and writes entry.txt", false, String(e.message));
  process.exit(1);
}

// 2. Gate: 1–140 characters, not only whitespace
check("entry is 1-140 chars", text.length >= 1 && text.length <= 140, `${text.length} chars`);
check("entry is not only whitespace", text.trim().length > 0);

// 3. One line: no newline characters
check("entry is a single line", !/[\r\n]/.test(text));

// 4. Valid UTF-8 text (round-trip through Buffer)
const bytes = Buffer.from(text, "utf8");
check("entry is valid UTF-8", bytes.toString("utf8") === text);

// 5. Determinism: a second run writes byte-identical output
const out2 = mkdtempSync(join(tmpdir(), "roast-out-"));
const text2 = runOnce(out2);
check("deterministic output", text === text2);

// 6. Stdlib-only: main.ts imports nothing outside node: builtins
const mainSrc = readFileSync(join(repoDir, "main.ts"), "utf8");
const imports = [...mainSrc.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
const nonStd = imports.filter((i) => !i.startsWith("node:"));
check("stdlib-only imports", nonStd.length === 0, nonStd.join(", ") || "only node: imports");

// 7. Roast of the operator: names the human and a concrete habit
check("roasts the operator, not a generic line", /human|operator|Ucup/i.test(text));

// 8. Punch lands at the end: last clause is a sharp turn, not filler
check("ends on a punch (no trailing filler)", /[.!?]$/.test(text.trim()) && text.trim().length === text.length);

rmSync(out1, { recursive: true, force: true });
rmSync(out2, { recursive: true, force: true });

console.log(failures === 0 ? "\nAll tests passed." : `\n${failures} test(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
