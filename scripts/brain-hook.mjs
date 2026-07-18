#!/usr/bin/env node
// R1 hook (BRAIN_PLAN.md Phase 2 / 2.5). Claude Code PreToolUse hook: when the
// model tries to Read/Grep/Glob Fonderie source or docs (@fonderie/* under
// node_modules, or the fonderie skill), deny the read and redirect it to the
// brain_query MCP tool. Deterministic — does not rely on the model obeying a
// prompt.
//
// Every interception is a "retrieval opportunity" — logged to FONDERIE_HOOK_LOG
// so the harness can detect MISSED retrievals (model reached for source instead
// of the brain). This is the R1 miss-detector.
//
// Wire into .claude/settings.json:
//   { "hooks": { "PreToolUse": [
//     { "matcher": "Read|Grep|Glob",
//       "hooks": [{ "type": "command", "command": "node scripts/brain-hook.mjs" }] } ] } }
//
// Protocol: reads the hook payload as JSON on stdin, writes a decision as JSON
// on stdout. { "permissionDecision": "deny", "permissionDecisionReason": "..." }
// blocks the tool and feeds the reason back to the model.

import { appendFileSync, readFileSync } from 'node:fs';

const FONDERIE_RE = /node_modules\/@fonderie\/|\.claude\/skills\/fonderie|packages\/(auth|billing|workspaces|permissions|rate-limit|courier|webhooks|config|audit|events|customers|core|store|client)\//;

let raw = '';
try { raw = readFileSync(0, 'utf8'); } catch {}
let payload = {};
try { payload = JSON.parse(raw || '{}'); } catch {}

const tool = payload.tool_name || payload.tool || '';
const inp = payload.tool_input || payload.input || {};
// the field carrying the target differs by tool: Read→file_path, Grep/Glob→path/pattern
const target = [inp.file_path, inp.path, inp.pattern, inp.glob].filter(Boolean).join(' ');

const isFonderie = FONDERIE_RE.test(target);

if (process.env.FONDERIE_HOOK_LOG) {
  try {
    appendFileSync(
      process.env.FONDERIE_HOOK_LOG,
      JSON.stringify({ ts: new Date().toISOString(), tool, target, intercepted: isFonderie }) + '\n',
    );
  } catch {}
}

if (isFonderie) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          'Do not read Fonderie source or docs. Call the brain_query MCP tool with your task ' +
          '(e.g. "add team billing") to get the package, wiring, recipe, and security invariants.',
      },
    }),
  );
  process.exit(0);
}

// not Fonderie — allow (empty output = no decision = proceed)
process.exit(0);
