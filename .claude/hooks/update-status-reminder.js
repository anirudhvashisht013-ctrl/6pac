#!/usr/bin/env node
// PreToolUse(Bash) hook — keep IMPLEMENTATION_STATUS.md current.
//
//  - On `git commit`: if the status file is NOT among pending changes, return an
//    "ask" decision so a forgotten update surfaces. Once it's edited/staged the
//    commit proceeds with no prompt (happy path = zero friction).
//  - On `git push`: inject a soft reminder into Claude's context.
//
// Fails open: any error → no decision emitted → the command proceeds normally.
let d = '';
process.stdin.on('data', (c) => (d += c)).on('end', () => {
  let cmd = '';
  try {
    cmd = (JSON.parse(d).tool_input || {}).command || '';
  } catch (e) {}

  const isCommit = /git\s+commit/.test(cmd);
  const isPush = /git\s+push/.test(cmd);
  if (!isCommit && !isPush) return;

  let pending = '';
  try {
    pending = require('child_process').execSync('git status --porcelain', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (e) {}
  const statusFileTouched = /IMPLEMENTATION_STATUS\.md/i.test(pending);

  if (isCommit && !statusFileTouched) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason:
            'IMPLEMENTATION_STATUS.md is not among your pending changes. Per project workflow, update it with what changed (added/updated/removed) before committing. Approve to commit anyway, or cancel to update it first.',
        },
      })
    );
  } else if (isPush) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext:
            'Reminder: ensure IMPLEMENTATION_STATUS.md reflects what changed before/with this push.',
        },
      })
    );
  }
});
