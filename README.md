# Gitignore Checkup
Live page: https://aamirtechs.github.io/gitignore-checkup/

Template generators only emit a .gitignore; they never check it against the files you actually have, which is how .env files and node_modules get committed. Gitignore Checkup generates the file from your stack choices and then audits your real file list against the rules, explaining every match and flagging the dangerous leaks.

## Features
- Stack picker (Node, Python, Java, Go, macOS, IDEs and more) that assembles a correct .gitignore
- Paste your file list and audit it against the generated rules plus an existing .gitignore
- Pattern explainer per file: which pattern matched, and on which line
- Danger flags for .env files, private keys and credential file patterns
- Download the .gitignore and a plain-text audit report

## How it works
Tick your stacks to build a .gitignore, optionally paste your current one, then paste your file paths. The matcher applies real gitignore semantics (globs, directory patterns, negations, last match wins) locally and reports ignored status per file plus a leak list. It runs entirely in the browser.

## Privacy
Runs 100% in your browser. Your files never leave this device, nothing is uploaded,
and there is no tracking.

## Development
Core logic lives in `src/logic.js` and is shared by the page and the tests.
Run the tests with `npm test`.

## License
MIT, Copyright 2026 Amir Hussain.
