# eventa

**Offline AI assistant for Node.js developers.** It explains crashes, reviews your diffs and audits dependencies, using a small code model that runs on your own machine. No API key, and no code leaves your laptop.

```bash
npx @jeeva1398/eventa explain --run "node app.js"   # run it, explain the crash
npx @jeeva1398/eventa review                        # review staged changes
npx @jeeva1398/eventa deps                          # vulnerabilities, outdated, unused, missing
```

Or install once with `npm i -g @jeeva1398/eventa`, then run `eventa explain`, `eventa review`, and so on.

Requires Node.js 20+. On first use Eventa installs a small llama.cpp runtime (~80 MB) and downloads the model (~1 GB, checksum-verified). If [Ollama](https://ollama.com) is running, Eventa uses it instead.

## Commands

### `eventa explain`
Give it an error in any of these ways:
- pipe it in: `node app.js 2>&1 | eventa explain`
- read it from a log: `eventa explain --file crash.log`
- run a command: `eventa explain --run "npm test"` or `eventa explain --run "npx tsc --noEmit"` for TypeScript compile errors
- paste it as arguments

Eventa parses the stack trace or `tsc` output, reads the source lines it points to in your project, and answers with **Cause**, **Fix** and **Prevent**. Known error codes come with built-in reference notes: Node (`ERR_REQUIRE_ESM`, `ECONNREFUSED`, …), TypeScript (`TS2345`, `TS18048`, …), Prisma (`P2002`, `P2025`, …) and NestJS dependency-injection errors.

### `eventa review`
Reviews `git diff --staged`, falling back to unstaged changes. Use `--base main` to review everything since `main`. Each file gets static checks first (missing `await`, SQL/command injection, `eval`, sync fs, empty `catch`, disabled TLS, hard-coded secrets), then the model confirms or dismisses them and reports `- [severity] line N: problem → fix`.

### `eventa deps`
Runs `npm audit` and `npm outdated` and scans your imports. It prints the vulnerabilities with their **exact fix commands**, outdated packages (flagging major bumps), unused dependencies and packages that are imported but not declared. Then it prints an **action plan** built only from facts: the fix commands, verified breaking-change notes for about 25 popular packages (others say "read the changelog" instead of guessing), and cleanup commands. It is instant and works without the model. Add `--ai` for optional extra commentary from the model.

### More
- `eventa ask <question>`: any Node.js question
- `eventa doctor`: check Node, Ollama and the built-in runtime
- `eventa model list | pull [id] | use <id> | rm <id>`: manage local models (`qwen2.5-coder-1.5b`, `eventa-1.5b`, or any `.gguf` URL or path)
- `eventa config get | set <key> <value> | path`: settings in `~/.eventa/config.json`

Global flags: `-p, --provider auto|ollama|local`, `-m, --model <name>`, `--host <url>`, `--raw`. `explain`, `review` and `deps` also accept `--json` for scripts and CI.

| Setting | Default | Env |
|---|---|---|
| `provider` | `auto` | `EVENTA_PROVIDER` |
| `model` (Ollama) | `hf.co/jeeva1398/eventa-1.5b-gguf` | `EVENTA_MODEL` |
| `localModel` (built-in) | `eventa-1.5b` | `EVENTA_LOCAL_MODEL` |
| `ollamaHost` | `http://localhost:11434` | `EVENTA_OLLAMA_HOST` / `OLLAMA_HOST` |
| `contextSize` | `8192` | |
| `temperature` | `0.2` | |

## Limitations
This is a 1.5B model. It is fast and private, but it can be wrong, so treat its answers as a strong hint, not a verdict. The facts Eventa computes itself (stack frames, audit fixes, unused/missing packages, static checks) are deterministic.

## License
MIT. Source and training pipeline: https://github.com/Jeeva1398/eventa
