# eventa

Offline AI assistant for Node.js developers. A small fine-tuned code model that runs on your laptop, plus a CLI that puts it to work.

```bash
npx eventa explain < crash.log     # explain a stack trace and suggest a fix
npx eventa review                  # review your staged git diff
npx eventa deps                    # audit package.json dependencies
```

- **Offline & free**: runs locally via Ollama or a built-in llama.cpp runtime. No API key, no code leaves your machine.
- **Node-aware**: trained on Node.js errors, review pitfalls and npm ecosystem issues.
- **Model**: `eventa-1.5b-gguf` (Qwen2.5-Coder-1.5B fine-tune, Q4_K_M, ~1 GB) on Hugging Face.

> Status: under active development. See [PLAN.md](PLAN.md) for the phase-wise roadmap.

## Commands

| Command | What it does |
|---|---|
| `eventa explain` | Reads an error from stdin, `--file <log>`, `--run "<cmd>"` or arguments. Parses the stack trace, reads the failing source lines, and explains the cause and fix. |
| `eventa review` | Reviews `git diff --staged` (or unstaged changes, or `--base main`) file by file. Static checks (missing await, injection, sync fs, empty catch…) guide the model. |
| `eventa deps` | Runs `npm audit` and `npm outdated` and scans imports for unused or missing packages. Prints exact fix commands, then AI advice on upgrade risk (`--no-ai` to skip). |
| `eventa ask <question>` | Ask any Node.js question. |
| `eventa doctor` | Checks Node, Ollama and the model. |
| `eventa config get\|set\|path` | Settings in `~/.eventa/config.json` (`model`, `ollamaHost`, `temperature`, `contextSize`). |

Global flags: `-m, --model <name>`, `-p, --provider auto|ollama|local`, `--host <url>`, `--raw`. `explain`, `review` and `deps` also take `--json` for CI.

## How the model runs

With `provider: auto` (the default), Eventa uses Ollama if it is running and has the model. Otherwise it uses the **built-in runtime**:

- On first use it installs `node-llama-cpp` with only the CPU binary for your platform (~80 MB) into `~/.eventa/runtime`. It then downloads the GGUF model (~1 GB, SHA-256 verified, resumable) into `~/.eventa/models`.
- After that, everything runs offline. Use `eventa model list | pull | use | rm` to manage models. The built-in runtime needs Node >= 20.

## Development

Requirements: Node >= 18, [Ollama](https://ollama.com) (until the built-in runtime lands).

```bash
ollama pull qwen2.5-coder:1.5b   # stand-in model until eventa-1.5b is published
npm install
npm run build
```

## Repo layout

```
packages/cli/   the `eventa` npm package (TypeScript)
training/       dataset builders, fine-tuning notebook, eval
```

## License

MIT
