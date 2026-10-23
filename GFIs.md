# Good first issues

## Add more stack templates
Add templates for Rust, PHP and Ruby stacks.
Each template is a named pattern list in src/logic.js with a test.

## Add git status output parsing
Accept pasted git status --short output and extract the file paths automatically.
Handle renamed and untracked markers.

## Add a tracked-but-ignored warning
When a file matches an ignore rule, note that already-tracked files stay tracked until removed from the index.
Surface this in the audit report text.
