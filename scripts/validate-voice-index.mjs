import fs from "node:fs";
import path from "node:path";

const ALLOWED_LANG = new Set(["hi-IN", "en-IN", "hi-Latn"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, files);
    else if (entry.isFile() && p.endsWith(".json")) files.push(p);
  }
  return files;
}

function fail(file, msg) {
  console.error(`❌ ${file}: ${msg}`);
  process.exitCode = 1;
}

const packsRoot = path.resolve("registry/voice-index.json/packs/union-budget-2026-27");
const jsonFiles = walk(packsRoot);

const globalTermCodes = new Map(); // termCode -> file
const globalIds = new Map();       // @id -> file

for (const file of jsonFiles) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    fail(file, `Invalid JSON: ${e.message}`);
    continue;
  }

  // Basic expectations
  if (data["@type"] !== "DefinedTermSet") fail(file, `@type must be DefinedTermSet`);
  if (!Array.isArray(data.hasDefinedTerm)) fail(file, `hasDefinedTerm must be an array`);

  // Optional: check inLanguage everywhere it appears
  const checkLangArray = (arr, where) => {
    if (!Array.isArray(arr)) return;
    for (const v of arr) {
      if (!ALLOWED_LANG.has(v)) fail(file, `${where} has invalid inLanguage: ${v}`);
    }
  };

  // Common places you use inLanguage:
  checkLangArray(data.inLanguage, "DefinedTermSet.inLanguage");
  if (Array.isArray(data.isPartOf)) {
    for (const node of data.isPartOf) checkLangArray(node?.inLanguage, `isPartOf[].inLanguage`);
  }
  if (Array.isArray(data.hasPart)) {
    for (const node of data.hasPart) checkLangArray(node?.inLanguage, `hasPart[].inLanguage`);
  }

  // Validate each term + enforce uniqueness
  for (const term of (data.hasDefinedTerm || [])) {
    if (!term || term["@type"] !== "DefinedTerm") {
      fail(file, `hasDefinedTerm item must be @type DefinedTerm`);
      continue;
    }

    const tc = term.termCode;
    const id = term["@id"];
    const ident = term.identifier;

    // termCode required and should match identifier (your pattern suggests they mirror)
    if (!tc) fail(file, `Missing term.termCode`);
    if (!ident) fail(file, `Missing term.identifier`);
    if (tc && ident && tc !== ident) fail(file, `termCode != identifier (${tc} vs ${ident})`);

    // Ensure unique termCode across the entire repo
    if (tc) {
      if (globalTermCodes.has(tc)) {
        fail(file, `Duplicate termCode "${tc}" also found in ${globalTermCodes.get(tc)}`);
      } else globalTermCodes.set(tc, file);
    }

    // Ensure unique @id across the entire repo
    if (id) {
      if (globalIds.has(id)) {
        fail(file, `Duplicate @id "${id}" also found in ${globalIds.get(id)}`);
      } else globalIds.set(id, file);
    }

    // Ensure additionalProperty has key HCAM blocks (optional but useful)
    const ap = Array.isArray(term.additionalProperty) ? term.additionalProperty : [];
    const names = new Set(ap.map(x => x?.name).filter(Boolean));
    const mustHave = ["English Explanation", "HCAM™ Hinglish Explanation", "HCAM™ Signal", "HCAM™ Voice-First (30 sec)"];
    for (const req of mustHave) {
      if (!names.has(req)) fail(file, `Term "${tc}" missing additionalProperty: "${req}"`);
    }
  }
}

if (process.exitCode) {
  console.error("\nValidation failed.");
  process.exit(1);
} else {
  console.log(`✅ Voice-index validation passed (${jsonFiles.length} JSON file(s))`);
}
