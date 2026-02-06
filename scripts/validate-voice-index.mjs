import fs from "node:fs";

const files = [
  "registry/voice-index.json/packs/union-budget-2026-27/part-a-core-budget-concepts-2026.json",
  "registry/voice-index.json/packs/union-budget-2026-27/part-b-budget-public-finance-fiscal-language.json"
];

const mustHaveProps = new Set([
  "English Explanation",
  "HCAM™ Hinglish Explanation",
  "HCAM™ Signal",
  "HCAM™ Voice-First (30 sec)"
]);

const termCodes = new Set();
const termIds = new Set();

let ok = true;
const fail = (msg) => { console.error("❌", msg); ok = false; };

for (const f of files) {
  if (!fs.existsSync(f)) fail(`Missing file: ${f}`);
  const data = JSON.parse(fs.readFileSync(f, "utf8"));

  const terms = Array.isArray(data.hasDefinedTerm) ? data.hasDefinedTerm : [];
  if (!terms.length) fail(`${f}: hasDefinedTerm must have at least 1 term`);

  for (const t of terms) {
    if (t?.["@type"] !== "DefinedTerm") fail(`${f}: term missing @type DefinedTerm`);

    const tc = t?.termCode;
    const id = t?.["@id"];
    const ident = t?.identifier;

    if (!tc) fail(`${f}: missing termCode`);
    if (!ident) fail(`${f}: missing identifier`);
    if (tc && ident && tc !== ident) fail(`${f}: termCode != identifier (${tc} vs ${ident})`);

    if (tc) {
      if (termCodes.has(tc)) fail(`${f}: duplicate termCode across files: ${tc}`);
      termCodes.add(tc);
    }

    if (id) {
      if (termIds.has(id)) fail(`${f}: duplicate @id across files: ${id}`);
      termIds.add(id);
    }

    const ap = Array.isArray(t.additionalProperty) ? t.additionalProperty : [];
    const names = new Set(ap.map(x => x?.name).filter(Boolean));
    for (const req of mustHaveProps) {
      if (!names.has(req)) fail(`${f}: ${tc || "(unknown term)"} missing additionalProperty "${req}"`);
    }
  }
}

if (!ok) process.exit(1);
console.log("✅ Business rules OK");
