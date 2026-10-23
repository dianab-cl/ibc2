#!/usr/bin/env node
// Every frozen page must carry noindex and a canonical that resolves to a
// real page in latest/. A canonical pointing at a 404 is worse than none:
// it tells search engines to rank a page that does not exist.
//
// Canonicals are site-relative (/ibc-go/latest/<page>) because this site has
// no deployed domain yet. An absolute URL is reported as a problem so an
// old-site canonical (docs.cosmos.network) cannot slip through.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const FROZEN = path.join(ROOT, "ibc-go", "v10.1.x");
const LATEST = path.join(ROOT, "ibc-go", "latest");

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : full.endsWith(".mdx") ? [full] : [];
  });
}

const problems = [];
const files = walk(FROZEN);
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  const rel = path.relative(FROZEN, file);
  if (!/^noindex:\s*true\s*$/m.test(text)) {
    problems.push(`${rel}: missing "noindex: true"`);
    continue;
  }
  const m = text.match(/^canonical:\s*'?([^'\n]+)'?\s*$/m);
  if (!m) {
    problems.push(`${rel}: missing canonical`);
    continue;
  }
  if (/^[a-z]+:\/\//i.test(m[1])) {
    problems.push(`${rel}: canonical must be site-relative, got ${m[1]}`);
    continue;
  }
  if (!m[1].startsWith("/ibc-go/latest/")) {
    problems.push(`${rel}: canonical must start with /ibc-go/latest/, got ${m[1]}`);
    continue;
  }
  const target = m[1].replace(/^\/ibc-go\/latest\//, "").replace(/\/$/, "");
  if (!target || !fs.existsSync(path.join(LATEST, target + ".mdx"))) {
    problems.push(`${rel}: canonical points at a missing page: ${m[1]}`);
  }
}

if (files.length === 0) problems.push(`no pages found under ${FROZEN}`);

if (problems.length) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} problem(s)`);
  process.exit(1);
}
console.log("all frozen pages carry noindex and a resolvable canonical");
