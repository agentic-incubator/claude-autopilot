#!/usr/bin/env node
// Validate the marketplace's structural invariants — the "check by hand" list
// from CLAUDE.md, automated so a broken push never reaches users who install
// straight from git. No external deps; runs on plain Node (>=22).
//
// Checks:
//   1. marketplace.json and plugin.json are valid JSON with required fields.
//   2. Versions agree: marketplace metadata.version === each plugin's plugin.json version.
//   3. Every plugin `source` directory exists and contains a plugin.json whose
//      `name` matches the manifest entry.
//   4. Every `/autopilot-*` command referenced in README.md has a commands/*.md file.
//   5. Every skill directory has a SKILL.md with frontmatter whose `name` matches
//      the directory and a non-empty `description`.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];
const fail = (msg) => errors.push(msg);

function readJson(relPath) {
  const abs = join(ROOT, relPath);
  if (!existsSync(abs)) {
    fail(`Missing file: ${relPath}`);
    return null;
  }
  try {
    return JSON.parse(readFileSync(abs, "utf8"));
  } catch (e) {
    fail(`Invalid JSON in ${relPath}: ${e.message}`);
    return null;
  }
}

// Minimal frontmatter parser — pulls top-level `key: value` pairs from the
// leading `---` block. Sufficient for `name`/`description`.
function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const out = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
  }
  return out;
}

// 1 + 2 + 3 — manifests and versions.
const marketplace = readJson(".claude-plugin/marketplace.json");
if (marketplace) {
  if (!marketplace.name) fail("marketplace.json: missing `name`");
  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length === 0) {
    fail("marketplace.json: `plugins` must be a non-empty array");
  }
  const marketVersion = marketplace.metadata?.version;
  if (!marketVersion) fail("marketplace.json: missing `metadata.version`");

  for (const entry of marketplace.plugins ?? []) {
    if (!entry.name) fail("marketplace.json: a plugin entry is missing `name`");
    if (!entry.source) {
      fail(`marketplace.json: plugin "${entry.name}" is missing \`source\``);
      continue;
    }
    const pluginDir = entry.source.replace(/^\.\//, "");
    const manifestPath = join(pluginDir, ".claude-plugin", "plugin.json");
    const plugin = readJson(manifestPath);
    if (!plugin) continue;
    if (plugin.name !== entry.name) {
      fail(
        `Name mismatch: marketplace lists "${entry.name}" but ${manifestPath} declares "${plugin.name}"`,
      );
    }
    if (marketVersion && plugin.version !== marketVersion) {
      fail(
        `Version mismatch: marketplace metadata.version is "${marketVersion}" but ${manifestPath} is "${plugin.version}"`,
      );
    }
  }
}

// 4 — README command references resolve to command files.
const readmePath = join(ROOT, "README.md");
if (existsSync(readmePath)) {
  const readme = readFileSync(readmePath, "utf8");
  const referenced = new Set([...readme.matchAll(/\/(autopilot-[a-z]+)/g)].map((m) => m[1]));
  const commandsDir = join(ROOT, "plugins/autopilot/commands");
  for (const cmd of referenced) {
    if (!existsSync(join(commandsDir, `${cmd}.md`))) {
      fail(`README references /${cmd} but plugins/autopilot/commands/${cmd}.md does not exist`);
    }
  }
} else {
  fail("Missing README.md");
}

// 5 — every skill directory has a valid SKILL.md.
const skillsRoot = join(ROOT, "plugins/autopilot/skills");
if (existsSync(skillsRoot)) {
  for (const dir of readdirSync(skillsRoot)) {
    if (dir.startsWith(".")) continue; // skip git-ignored local-state dirs
    const skillDir = join(skillsRoot, dir);
    if (!statSync(skillDir).isDirectory()) continue;
    const skillFile = join(skillDir, "SKILL.md");
    if (!existsSync(skillFile)) {
      fail(`Skill "${dir}" is missing SKILL.md`);
      continue;
    }
    const fm = parseFrontmatter(readFileSync(skillFile, "utf8"));
    if (!fm) {
      fail(`${dir}/SKILL.md: missing or malformed YAML frontmatter`);
      continue;
    }
    if (fm.name !== dir) {
      fail(`${dir}/SKILL.md: frontmatter name "${fm.name}" does not match directory "${dir}"`);
    }
    if (!fm.description) fail(`${dir}/SKILL.md: frontmatter is missing \`description\``);
  }
} else {
  fail("Missing plugins/autopilot/skills directory");
}

if (errors.length) {
  console.error(`✗ Manifest validation failed (${errors.length} issue(s)):\n`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log("✓ Manifest validation passed.");
