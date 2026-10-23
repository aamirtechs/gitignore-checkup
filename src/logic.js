"use strict";
// Gitignore Checkup: core logic. Pure functions, no DOM, no fetch.

const TEMPLATES = {
  node: ["node_modules/", "npm-debug.log*", "yarn-error.log*", "dist/", "build/", ".env", ".env.*", "!.env.example", "coverage/", ".DS_Store"],
  python: ["__pycache__/", "*.py[cod]", ".venv/", "venv/", ".env", ".env.*", "!.env.example", ".pytest_cache/", ".mypy_cache/", "dist/", "build/", "*.egg-info/"],
  java: ["*.class", "target/", "build/", ".gradle/", "*.jar", "*.war", ".idea/", "*.iml"],
  go: ["*.exe", "*.test", "*.out", "vendor/", ".env"],
  rust: ["target/", "Cargo.lock", "**/*.rs.bk", ".env"],
  php: ["vendor/", ".env", ".env.*", "!.env.example", "composer.phar", ".phpunit.result.cache"],
  ruby: ["*.gem", ".bundle/", "vendor/bundle/", ".env", "log/", "tmp/"],
  macos: [".DS_Store", ".AppleDouble", ".LSOverride", "._*"],
  windows: ["Thumbs.db", "ehthumbs.db", "Desktop.ini", "$RECYCLE.BIN/"],
  ides: [".idea/", ".vscode/", "*.swp", "*.swo", "*~", ".project", ".classpath", ".settings/"],
  secrets: [".env", ".env.*", "!.env.example", "*.pem", "*.key", "id_rsa", "id_rsa.*", "*.p12", "*.keystore", "credentials.json", "service-account*.json", ".npmrc"]
};

const STACK_ORDER = ["node", "python", "java", "go", "rust", "php", "ruby", "macos", "windows", "ides", "secrets"];

// Assemble a .gitignore from stack names, preserving order, de-duplicating
// patterns while keeping a comment header per stack.
function buildGitignore(stacks) {
  const chosen = (stacks || []).map((s) => String(s).toLowerCase()).filter((s) => TEMPLATES[s]);
  const ordered = STACK_ORDER.filter((s) => chosen.includes(s));
  const seen = new Set();
  const lines = [];
  for (const stack of ordered) {
    lines.push("# " + stack);
    for (const pat of TEMPLATES[stack]) {
      if (seen.has(pat)) continue;
      seen.add(pat);
      lines.push(pat);
    }
    lines.push("");
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

// Parse .gitignore text into rule objects with 1-based line numbers.
function parseGitignore(text) {
  const rules = [];
  String(text || "").split(/\r?\n/).forEach((raw, i) => {
    let line = raw.trim();
    if (!line || line.startsWith("#")) return;
    let negated = false;
    if (line.startsWith("!")) { negated = true; line = line.slice(1); }
    const dirOnly = line.endsWith("/");
    const anchored = line.startsWith("/");
    const pattern = line.replace(/^\//, "");
    rules.push({ pattern, negated, dirOnly, anchored, line: i + 1, raw: raw.trim() });
  });
  return rules;
}

// Convert a gitignore glob body to a RegExp. Handles *, **, ? and leading patterns.
function globToRegExp(pattern, anchoredHint) {
  let p = pattern.replace(/\/$/, "");
  let anchored = anchoredHint || p.includes("/");
  let esc = "";
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === "*") {
      if (p[i + 1] === "*") { esc += ".*"; i++; if (p[i + 1] === "/") i++; }
      else esc += "[^/]*";
    } else if (ch === "?") esc += "[^/]";
    else esc += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  const body = anchored ? "^" + esc + "(/.*)?$" : "(^|/)" + esc + "(/.*)?$";
  return new RegExp(body);
}

// Does one rule match a path? Directory patterns match the dir and its contents.
function matchRule(rule, path) {
  const clean = String(path || "").replace(/^\.\//, "").replace(/\/$/, "");
  if (!clean) return false;
  return globToRegExp(rule.pattern, rule.anchored).test(clean);
}

// Evaluate a path against ordered rules. Last matching rule wins (git semantics).
// Returns { ignored, pattern, line, negated } or { ignored:false, pattern:null }.
function checkPath(rules, path) {
  let result = { ignored: false, pattern: null, line: null, negated: false };
  for (const rule of rules) {
    if (matchRule(rule, path)) {
      result = { ignored: !rule.negated, pattern: rule.raw, line: rule.line, negated: rule.negated };
    }
  }
  return result;
}

const DANGER_PATTERNS = [
  { re: /(^|\/)\.env($|\.)/, why: "environment file, usually holds credentials" },
  { re: /\.pem$/, why: "PEM certificate or private key file" },
  { re: /\.(key|p12|keystore|jks)$/, why: "private key or keystore file" },
  { re: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/, why: "SSH key file" },
  { re: /credential/i, why: "credentials file by name" },
  { re: /(^|\/)\.npmrc$/, why: "npm config, can hold registry tokens" },
  { re: /service-account.*\.json$/, why: "service account key file" },
  { re: /(^|\/)\.aws\//, why: "AWS config directory" },
  { re: /secret/i, why: "file with 'secret' in the name" }
];

function dangerInfo(path) {
  const clean = String(path || "");
  for (const d of DANGER_PATTERNS) if (d.re.test(clean)) return d.why;
  return null;
}

// Audit a pasted file list against combined rules (generated template rules
// merged with any existing .gitignore rules the user pastes).
function auditFiles(paths, rules) {
  return (paths || []).map((p) => String(p).trim()).filter(Boolean).map((path) => {
    const check = checkPath(rules, path);
    const danger = dangerInfo(path);
    return {
      path,
      ignored: check.ignored,
      matchedPattern: check.pattern,
      matchedLine: check.line,
      danger,
      leak: !!danger && !check.ignored
    };
  });
}

function parseFileList(text) {
  return String(text || "").split(/\r?\n/).map((l) => l.trim().replace(/^\.\//, "")).filter((l) => l && !l.startsWith("#"));
}

function buildAuditReport(audit, gitignoreText) {
  const leaks = audit.filter((a) => a.leak);
  const ignoredCount = audit.filter((a) => a.ignored).length;
  const lines = [];
  lines.push("Gitignore Checkup audit report");
  lines.push("Files checked: " + audit.length);
  lines.push("Ignored: " + ignoredCount);
  lines.push("Not ignored: " + (audit.length - ignoredCount));
  lines.push("Danger files NOT ignored: " + leaks.length);
  lines.push("");
  if (leaks.length) {
    lines.push("LEAKS (danger files that would be committed):");
    leaks.forEach((a) => lines.push("- " + a.path + " (" + a.danger + ")"));
    lines.push("");
  }
  lines.push("Per-file detail:");
  audit.forEach((a) => {
    if (a.ignored) lines.push("- " + a.path + ": ignored by '" + a.matchedPattern + "' (line " + a.matchedLine + ")");
    else lines.push("- " + a.path + ": NOT ignored" + (a.danger ? " [danger: " + a.danger + "]" : ""));
  });
  lines.push("");
  lines.push("Generated .gitignore:");
  lines.push(gitignoreText || "");
  return lines.join("\n");
}

const api = { TEMPLATES, STACK_ORDER, buildGitignore, parseGitignore, globToRegExp, matchRule, checkPath, dangerInfo, auditFiles, parseFileList, buildAuditReport };
if (typeof module !== "undefined" && module.exports) { module.exports = api; }
if (typeof window !== "undefined") { window.GitignoreCheckup = api; }
