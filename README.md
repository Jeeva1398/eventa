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
