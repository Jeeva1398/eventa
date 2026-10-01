# eventa

[![npm](https://img.shields.io/npm/v/@jeeva1398/eventa?color=cb3837&label=npm)](https://www.npmjs.com/package/@jeeva1398/eventa)
[![downloads](https://img.shields.io/npm/dm/@jeeva1398/eventa)](https://www.npmjs.com/package/@jeeva1398/eventa)
[![ci](https://github.com/Jeeva1398/eventa/actions/workflows/ci.yml/badge.svg)](https://github.com/Jeeva1398/eventa/actions/workflows/ci.yml)
[![model](https://img.shields.io/badge/%F0%9F%A4%97%20model-eventa--1.5b-yellow)](https://huggingface.co/jeeva1398/eventa-1.5b-gguf)
![offline](https://img.shields.io/badge/runs-100%25%20offline-2ea44f)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**An offline AI assistant for Node.js and TypeScript.** It explains crashes, reviews your git diff and audits dependencies, using a small fine-tuned model that runs on your laptop. No API key, and your code never leaves your machine.

```bash
npx @jeeva1398/eventa explain --run "node app.js"   # run it, explain the crash
npx @jeeva1398/eventa review                        # review your staged changes
npx @jeeva1398/eventa deps                          # fix vulnerabilities, plan upgrades
```

Or install once with `npm i -g @jeeva1398/eventa`, then use the `eventa` command. Requires Node 20+.

### What it looks like

```text
$ eventa explain --run "node src/users.js"
TypeError: Cannot read properties of undefined (reading 'name')
Looking at src/users.js:5, src/users.js:9

Cause: `user` is found for id 2 but that record has no `profile`, so `user.profile`
is `undefined` and reading `.name` on it throws.
Fix:   return (user?.profile?.name ?? '')?.toUpperCase();
```

```text
$ eventa review
▸ src/orders.js
Static checks
  [high] line 7: async-looking call without await or return, result and errors are dropped
  [high] line 8: SQL built with template interpolation, use parameters
AI review
- [high] line 7: `save()` returns a Promise that is not awaited, so failures are silently dropped → `await order.save();`
- [high] line 8: SQL injection risks for `userId` → use a parameterized statement: `db.query('SELECT * FROM users WHERE id = ?', [userId])`
```

### Why Eventa

| | Eventa | Cloud AI reviewers | `npm audit` |
|---|---|---|---|
| Works offline, no API key | ✅ | ❌ | ✅ |
| Code stays on your machine | ✅ | ❌ | ✅ |
| Explains crashes and `tsc` errors from your source | ✅ | ❌ | ❌ |
| Reviews diffs and stays quiet on clean code | ✅ (100% precision in our eval) | varies | ❌ |
| Exact fix commands + breaking-change notes | ✅ | ❌ | fix commands only |
| Cost | free | per token | free |

- **Built for Node:** Node core errors, TypeScript, Express, NestJS and Prisma.
- **Its own model:** [`eventa-1.5b`](https://huggingface.co/jeeva1398/eventa-1.5b-gguf), a Qwen2.5-Coder-1.5B fine-tune (Q4_K_M, about 1 GB) that answers in about 6 s on a laptop CPU.

## Commands

| Command | What it does |
|---|---|
| `eventa explain` | Reads an error from stdin, `--file <log>`, `--run "<cmd>"` or arguments. Parses Node stack traces and TypeScript `tsc` errors, reads the failing source lines, and explains the cause and fix. Knows Node, Express, NestJS and Prisma error codes. |
| `eventa review` | Reviews `git diff --staged` (or unstaged changes, or `--base main`) file by file. Static checks (missing await, injection, sync fs, empty catch…) guide the model. |
| `eventa deps` | Runs `npm audit` and `npm outdated` and scans imports for unused or missing packages. Prints a deterministic action plan: exact fix commands, verified breaking-change notes for major upgrades (Express, NestJS, Prisma, Mongoose, Jest, ESLint, …) and cleanup commands. `--ai` adds optional model commentary. |
| `eventa ask <question>` | Ask any Node.js question. |
| `eventa doctor` | Checks Node, Ollama and the model. |
| `eventa config get\|set\|path` | Settings in `~/.eventa/config.json` (`model`, `ollamaHost`, `temperature`, `contextSize`). |

Global flags: `-m, --model <name>`, `-p, --provider auto|ollama|local`, `--host <url>`, `--raw`. `explain`, `review` and `deps` also take `--json` for CI.

## How the model runs

With `provider: auto` (the default), Eventa uses Ollama if it is running and has the model. Otherwise it uses the **built-in runtime**:

- On first use it installs `node-llama-cpp` with only the CPU binary for your platform (~80 MB) into `~/.eventa/runtime`. It then downloads the GGUF model (~1 GB, SHA-256 verified, resumable) into `~/.eventa/models`.
- After that, everything runs offline. Use `eventa model list | pull | use | rm` to manage models.

## Privacy & security

- **Your code stays local.** It is only sent to the local model, or to Ollama at your configured host.
- **First local use** downloads the runtime from a pinned lockfile, with install scripts disabled, and the model from a pinned Hugging Face commit with SHA-256 verification.
- **`eventa deps`** runs `npm audit` / `npm outdated`, which send dependency names and versions to the npm registry.
- **Safeguards:** `explain` reads only files inside your project, and AI output has terminal control sequences stripped and is never executed.

Report vulnerabilities privately: https://github.com/Jeeva1398/eventa/security/advisories/new

## Development

Requirements: Node >= 20. [Ollama](https://ollama.com) is optional.

```bash
ollama pull qwen2.5-coder:1.5b   # optional: faster dev loop than the built-in runtime
npm install
npm run build
```

## Repo layout

```
packages/cli/   the `eventa` npm package (TypeScript)
training/       dataset builders, fine-tuning notebook, eval
```

Or install once with `npm i -g @jeeva1398/eventa`, then use the `eventa` command.

## Releasing

- **Model:** run `training/finetune.ipynb` on a free Kaggle/Colab T4 GPU. Its last cell publishes to `huggingface.co/jeeva1398/eventa-1.5b-gguf`.
- **CLI:** bump `packages/cli/package.json`, then push a `v*` tag. GitHub Actions publishes to npm (secret `NPM_TOKEN`) and attaches standalone binaries to the GitHub Release.

## License

The CLI and training code are MIT. The `eventa-1.5b` model weights are Apache-2.0, following the base model Qwen2.5-Coder-1.5B-Instruct.
