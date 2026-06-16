# ccharness

**Given what I'm working on right now, which plugins/skills should be enabled?**

A personal, local-first CLI that recommends a coherent, deconflicted Claude Code
plugin/skill stack for the task at hand. It knows what's in the marketplaces,
knows what you have installed, and — via a grounded LLM recommender — tells you
what to **enable**, **install**, or **turn off**, flagging conflicts (two memory
plugins) and context-cost (hook-/MCP-heavy stacks) as facts the model can't wave
away.

> Status: **v0.7.0, scaffold.** Core types, SQLite schema, the CLAUDE.md
> managed-block writer, and the conflict checker are implemented; sync,
> inventory, the recommender pipeline, and the dashboard are scaffolded per the
> plan below. See [`docs/`](docs/) for the full PRD and implementation plan.

## Why this exists

The ecosystem already has pieces ([pi-pathfinder], [ccpi], the canonical
catalog). ccharness fills the gap they leave: **out-of-session, deterministic,
durable** recommendation of a *standing* configuration relative to what you
actually have installed — the deconflicted-coherent-stack reasoning nobody else
automates. See PRD §1.1.

## Architecture

- **`@ccharness/core`** — index, normalizer, inventory scanner, recommender
  (pre-filter → grounded validation), conflict checker, CLAUDE.md block writer.
  Pure functions over a local SQLite store. No UI assumptions.
- **Model provider adapter** — swappable behind a strict JSON-schema contract
  (Anthropic API or a local OpenAI-compatible endpoint). The only
  non-deterministic part. Core depends on the contract, not the provider.
- **`ccharness` CLI** — thin wrapper over core; source of truth for state changes.
- **Read-only web dashboard** — `ccharness serve`; views the same store, computes
  nothing the CLI can't.

**The product is the recommender:** the LLM does judgment, the index does truth.
A deterministic pre-filter bounds what the model sees; deterministic validation
drops anything that doesn't resolve to a real catalog entry; conflict and
context-cost checks run as hard facts the model cannot override.

## CLI surface (v1, complete)

```
ccharness sync                              # refresh index from configured marketplaces
ccharness search <query> [--category <c>]   # query the index
ccharness status                            # show installed + enabled components
ccharness recommend "<task>" [--scope ...] [--tight] [--integrations a,b] [--provider anthropic|local] [--yes] [--no-cache]
ccharness gen-claudemd [--scope system|project] [--path <f>] [--write]
ccharness serve [--port <n>]                # read-only dashboard (localhost)
```

## Develop

```bash
pnpm install
pnpm test          # vitest
pnpm typecheck
pnpm build
pnpm dev -- --help # run the CLI from source
```

## Build order

The milestones are dependency- and value-ordered; each is independently
shippable (stop after C for an advice tool, D for a safe one, E for a comfortable one):

| Milestone | Delivers | PRD |
|---|---|---|
| 0 | Spike: study prior art, pick default provider | — |
| A | `sync` + `search` — an index you can query | §4.1 |
| B | `status` — know your current setup | §4.2 |
| C | `recommend` — **the product** | §4.3/§4.4/§4.7/§4.8 |
| D | `gen-claudemd` — safe to act on | §4.5 |
| E | `serve` — read-only dashboard | §4.6 |

## License

MIT © Dustin Powers (UMB Advisors)

[pi-pathfinder]: #
[ccpi]: #
