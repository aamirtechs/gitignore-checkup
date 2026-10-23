"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const L = require("../src/logic.js");

test("buildGitignore assembles stack templates with headers and no duplicates", () => {
  const out = L.buildGitignore(["node", "secrets"]);
  assert.ok(out.includes("# node"));
  assert.ok(out.includes("node_modules/"));
  const envCount = out.split("\n").filter((l) => l === ".env").length;
  assert.equal(envCount, 1);
});

test("parseGitignore records patterns, negations and line numbers", () => {
  const rules = L.parseGitignore("# comment\n*.log\n!important.log\nbuild/\n");
  assert.equal(rules.length, 3);
  assert.equal(rules[0].line, 2);
  assert.equal(rules[1].negated, true);
  assert.equal(rules[2].dirOnly, true);
});

test("checkPath matches a suffix glob at any depth", () => {
  const rules = L.parseGitignore("*.log\n");
  const hit = L.checkPath(rules, "logs/debug/app.log");
  assert.equal(hit.ignored, true);
  assert.equal(hit.pattern, "*.log");
  assert.equal(hit.line, 1);
});

test("checkPath matches directory patterns and everything under them", () => {
  const rules = L.parseGitignore("node_modules/\n");
  assert.equal(L.checkPath(rules, "node_modules/react/index.js").ignored, true);
  assert.equal(L.checkPath(rules, "src/node_modules_notes.md").ignored, false);
});

test("a later negation overrides an earlier ignore (git semantics)", () => {
  const rules = L.parseGitignore(".env.*\n!.env.example\n");
  assert.equal(L.checkPath(rules, ".env.production").ignored, true);
  const ex = L.checkPath(rules, ".env.example");
  assert.equal(ex.ignored, false);
  assert.equal(ex.pattern, "!.env.example");
});

test("anchored patterns only match from the root", () => {
  const rules = L.parseGitignore("/dist/\n");
  assert.equal(L.checkPath(rules, "dist/app.js").ignored, true);
  assert.equal(L.checkPath(rules, "packages/x/dist/app.js").ignored, false);
});

test("dangerInfo flags env files, keys and credential names", () => {
  assert.ok(L.dangerInfo(".env"));
  assert.ok(L.dangerInfo("certs/server.pem"));
  assert.ok(L.dangerInfo("home/.ssh/id_rsa".replace("home/.ssh/", "")));
  assert.ok(L.dangerInfo("config/credentials.json"));
  assert.equal(L.dangerInfo("src/index.js"), null);
});

test("auditFiles marks an unignored .env as a leak", () => {
  const rules = L.parseGitignore("node_modules/\n");
  const audit = L.auditFiles(["node_modules/x/index.js", ".env", "src/app.js"], rules);
  assert.equal(audit[0].ignored, true);
  assert.equal(audit[1].leak, true);
  assert.equal(audit[2].ignored, false);
  assert.equal(audit[2].leak, false);
});

test("buildAuditReport summarises leaks and per-file matches", () => {
  const text = L.buildGitignore(["node"]);
  const rules = L.parseGitignore(text);
  const audit = L.auditFiles(["node_modules/x.js", "src/app.js"], rules);
  const report = L.buildAuditReport(audit, text);
  assert.ok(report.includes("Files checked: 2"));
  assert.ok(report.includes("ignored by 'node_modules/'"));
});
