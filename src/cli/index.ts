#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "../core/config.js";
import { openStore } from "../core/db/store.js";

/**
 * `ccharness` CLI (PRD §5) — thin wrapper over `@ccharness/core`. Source of
 * truth for all state changes. The complete v1 command surface, no more:
 * sync, search, status, recommend, gen-claudemd, serve.
 *
 * Commands are scaffolded with their PRD-locked signatures; each action is
 * wired to its core function as the corresponding milestone lands.
 */
const program = new Command();

program
  .name("ccharness")
  .description(
    "Recommend a coherent, deconflicted Claude Code plugin/skill stack for the task at hand.",
  )
  .version("0.7.0");

program
  .command("sync")
  .description("refresh the index from configured marketplaces (PRD §4.1)")
  .action(async () => {
    const db = openStore();
    const _config = loadConfig();
    void db;
    notImplemented("sync", "Milestone A");
  });

program
  .command("search")
  .argument("<query>")
  .option("-c, --category <category>", "filter by category id or key")
  .description("query the index (PRD §4.1)")
  .action(() => notImplemented("search", "Milestone A"));

program
  .command("status")
  .description("show installed + enabled components, annotated (PRD §4.2)")
  .action(() => notImplemented("status", "Milestone B"));

program
  .command("recommend")
  .argument("<task>")
  .option("--scope <scope>", "system | project")
  .option("--tight", "prefer a tight context budget")
  .option("--integrations <list>", "comma-separated required integrations")
  .option("--provider <provider>", "anthropic | local")
  .option("--yes", "bypass the paid-provider cost confirm")
  .option("--no-cache", "force a fresh model call")
  .description("the product: what to enable/install/disable, with reasons (PRD §4.3)")
  .action(() => notImplemented("recommend", "Milestone C"));

program
  .command("gen-claudemd")
  .option("--scope <scope>", "system | project")
  .option("--path <file>", "target CLAUDE.md path")
  .option("--write", "perform the in-place managed-block update (default: print to stdout)")
  .description("emit the managed block; review-first by default (PRD §4.5)")
  .action(() => notImplemented("gen-claudemd", "Milestone D"));

program
  .command("serve")
  .option("--port <n>", "port", "4575")
  .description("launch the read-only dashboard on localhost (PRD §4.6)")
  .action(() => notImplemented("serve", "Milestone E"));

function notImplemented(cmd: string, milestone: string): never {
  console.error(`ccharness ${cmd}: not yet implemented (${milestone}).`);
  process.exitCode = 1;
  throw new Error(`${cmd} not implemented`);
}

program.parseAsync().catch((err) => {
  if (err instanceof Error && err.message.endsWith("not implemented")) return;
  console.error(err);
  process.exitCode = 1;
});
