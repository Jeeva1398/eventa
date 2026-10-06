# eventa

[![npm](https://img.shields.io/npm/v/@jeeva1398/eventa?color=cb3837&label=npm)](https://www.npmjs.com/package/@jeeva1398/eventa)
[![downloads](https://img.shields.io/npm/dm/@jeeva1398/eventa)](https://www.npmjs.com/package/@jeeva1398/eventa)
[![model](https://img.shields.io/badge/%F0%9F%A4%97%20model-eventa--1.5b-yellow)](https://huggingface.co/jeeva1398/eventa-1.5b-gguf)
![offline](https://img.shields.io/badge/runs-100%25%20offline-2ea44f)

**Offline AI assistant for Node.js and TypeScript developers.** It explains crashes, reviews your diffs and audits dependencies, using a small code model that runs on your own machine. No API key, and no code leaves your laptop.

```bash
npx @jeeva1398/eventa explain --run "node app.js"   # run it, explain the crash
npx @jeeva1398/eventa review                        # review staged changes
npx @jeeva1398/eventa deps                          # vulnerabilities, outdated, unused, missing
```

Or install once with `npm i -g @jeeva1398/eventa`, then run `eventa explain`, `eventa review`, and so on.

![eventa explaining a crash and reviewing a diff](https://raw.githubusercontent.com/Jeeva1398/eventa/main/docs/demo.gif)

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
| `temperature` | `0.2` | `EVENTA_TEMPERATURE` |

## Review pull requests in GitHub Actions

Eventa can review every pull request and post the findings as one comment, which it updates on each push. The model runs on the GitHub runner, so your code is not sent to any AI service.

```yaml
# .github/workflows/eventa.yml
name: eventa
on: pull_request
permissions:
  contents: read
  pull-requests: write
jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2
      - uses: Jeeva1398/eventa@v0.2.1
        with:
          fail-on: none   # or high | medium | low to fail the check
```

| Input | Default | |
|---|---|---|
| `fail-on` | `none` | Fail the job when the AI reports an issue at this severity or above. |
| `max-files` | `20` | Maximum number of files to review. |
| `base` | PR base | Git ref to diff against. |
| `comment` | `true` | Post or update the PR comment. The report is always written to the job summary. |
| `version` | the action's tag | `@jeeva1398/eventa` version to run. |

The first run downloads the runtime and model (~1 GB). Later runs restore them from the Actions cache. Reviews run at temperature 0, so re-running a job gives the same result. Pull requests from forks get a read-only token, so for those the report goes only to the job summary.

Locally, `eventa review --markdown` prints the same report, and `--fail-on high` sets exit code 1 when the review finds a high-severity issue.

## Privacy & security

Your code stays on your machine. Eventa sends it only to the model running locally: the built-in runtime, or Ollama.

### What Eventa reads

Eventa never uploads your project. Each command reads only what it needs, and sends it to the model running on your machine:

| Command | Reads | Sent to the model |
|---|---|---|
| `explain` | The error you give it, and about 30 lines around up to 3 stack-trace lines in your project (never `node_modules` or files outside the project) | The error, those lines, your Node version and dependency names |
| `review` | Only the `git diff` (staged, unstaged, or since `--base`) | The changed lines with 3 lines of context |
| `deps` | `package.json`, and your source files only to collect `import`/`require` package names | Package names, versions and advisory titles, and only with `--ai`. Never code. |
| `ask` | Nothing | Your question |

Eventa stores no prompts, answers or logs, and has no telemetry or analytics. The only files it writes are the config, runtime and models in `~/.eventa`.

If you point `ollamaHost` (or `OLLAMA_HOST`) at another machine, your code is sent there, and Eventa prints a warning each time. To guarantee that nothing leaves the machine, run `eventa config set provider local`.

### Network calls

| When | Where | What is sent |
|---|---|---|
| First local use | npm registry | Downloads the runtime from a **pinned lockfile** with integrity hashes and **install scripts disabled** |
| First local use | huggingface.co | Downloads the model from a pinned commit and verifies its **SHA-256** |
| `eventa deps` | npm registry | Runs `npm audit` / `npm outdated`, which send your dependency names and versions (exactly as running them yourself would) |

Other safeguards:
- `explain` only reads source files inside the current project, never arbitrary paths from a pasted stack trace.
- Model output is printed as text with terminal control sequences stripped, and is never executed.
- `--run` executes only the command you type.
- The npm package is published with provenance from GitHub Actions.

Found a security problem? Please open a private advisory: https://github.com/Jeeva1398/eventa/security/advisories/new

## FAQ & troubleshooting

**How much disk space does it need?**
About 1 GB in `~/.eventa`: the runtime (~80 MB) and the model (~940 MB). Both are downloaded on the first AI command, not at `npm install`. `eventa deps` (without `--ai`), `config` and `--help` download nothing. If you use Ollama instead, Eventa downloads neither; Ollama stores the model itself.

**How much memory, and do I need a GPU?**
No GPU is needed. The model runs on the CPU (Apple Silicon Macs also use Metal) and needs roughly 1.5–2 GB of free memory while it answers. Expect about 6 seconds per answer on a laptop CPU. `review` asks the model once per changed file.

**Which platforms are supported?**
Windows x64/arm64, macOS (Intel and Apple Silicon) and Linux x64/arm64/armv7/riscv64, all with prebuilt binaries and no compiler. On any other platform, install [Ollama](https://ollama.com) and Eventa will use it. The standalone binaries on GitHub Releases cannot install the built-in runtime, so use them with Ollama, or install the npm package.

**Can I download everything in advance, or set it up on an offline machine?**
Run `eventa model pull` once while online. After that, every command except `deps` works offline. For an air-gapped machine, copy `~/.eventa` from a machine with the same OS and CPU type, or download the `.gguf` file yourself and run `eventa model use /path/to/model.gguf`.

**I'm behind a proxy.**
The runtime is installed with npm, so it uses your npm proxy settings. The model is downloaded with Node's built-in `fetch`. On Node 24+, set `NODE_USE_ENV_PROXY=1` along with `HTTPS_PROXY`. Otherwise, download the `.gguf` yourself and run `eventa model use <path>`.

**Does it work with React, Next.js or other languages?**
It is trained for Node.js backends in JavaScript and TypeScript, including Express, NestJS and Prisma. It will still read other code, but expect weaker answers.

**I use pnpm or yarn.**
`explain`, `review` and `ask` work in any project. `deps` runs `npm audit` and `npm outdated`, so it needs a `package-lock.json`.

**The review flagged something that is fine.**
Lines under **Static checks** are quick pattern matches that guide the model, and can be wrong. The model's own findings are listed under **AI review**. `--fail-on` and the GitHub Action only count the AI findings.

**The download failed or stopped.**
Run the command again; it resumes where it stopped. If it keeps failing, delete `~/.eventa/models/*.part` and retry. `eventa doctor` shows what is installed.

**"Cannot reach Ollama" or "Unknown model".**
`-m` sets the model for both Ollama and the built-in runtime. To use an Ollama model such as `qwen2.5-coder:1.5b`, also pass `--provider ollama` and make sure `ollama serve` is running. Built-in model ids are listed by `eventa model list`.

**How do I update it?**
Run `npm i -g @jeeva1398/eventa` again. The model is downloaded again only when a new version pins a new model. You can then delete the old `.gguf` file from `~/.eventa/models`.

**How do I uninstall it?**
Run `npm uninstall -g @jeeva1398/eventa`, then delete `~/.eventa` (on Windows, `%USERPROFILE%\.eventa`) to remove the runtime and model.

## Limitations
This is a 1.5B model. It is fast and private, but it can be wrong, so treat its answers as a strong hint, not a verdict. The facts Eventa computes itself (stack frames, audit fixes, unused/missing packages, static checks) are deterministic.

## License
MIT. Source and training pipeline: https://github.com/Jeeva1398/eventa
