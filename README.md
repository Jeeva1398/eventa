# eventa

Offline AI assistant for Node.js developers. A small fine-tuned code model that runs on your laptop, plus a CLI that puts it to work.

```bash
npx @jeeva1398/eventa explain < crash.log     # explain a stack trace and suggest a fix
npx @jeeva1398/eventa review                  # review your staged git diff
npx @jeeva1398/eventa deps                    # audit package.json dependencies
```

Or install once with `npm i -g @jeeva1398/eventa`, then use the `eventa` command.

- **Offline & free**: runs locally via Ollama or a built-in llama.cpp runtime. No API key, no code leaves your machine.
- **Node-aware**: trained on Node.js, TypeScript, Express, NestJS and Prisma errors, review pitfalls and npm ecosystem issues.
- **Model**: `eventa-1.5b-gguf` (Qwen2.5-Coder-1.5B fine-tune, Q4_K_M, ~1 GB) on Hugging Face.

> Status: under active development.

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
