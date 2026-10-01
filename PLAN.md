# Eventa: Offline AI Assistant for Node.js Developers (Phase-wise Plan)

## Context
Goal: publish a free, offline AI tool that Node.js developers can install and use. It follows the recipe of
`prawinn04/vensa-1.1b-gguf`, a Llama-3.2-1B fine-tuned on Flutter with Unsloth and shipped as a Q4_K_M GGUF
that runs through Ollama or llama.cpp, but adapted for Node.js. It also adds a CLI so developers get real
commands, not just a chat.

- **Deliverables:**
  1. `eventa-1.5b-gguf` model on Hugging Face.
  2. `eventa` CLI on npm.
- **v1 commands:** `eventa explain` (errors), `eventa review` (git diff), `eventa deps` (dependency audit).
- **Project folder:** `D:\eventa`. After approval, this plan is copied to `D:\eventa\PLAN.md`.
- **Cost:** $0. Training runs on free Colab/Kaggle GPUs, and hosting is HF + npm + GitHub.

## Execution rules (from user)
- **Repo:** `D:\eventa`. It already exists with `README.md` and an "Initial commit", and its remote is `origin = https://github.com/Jeeva1398/eventa.git`.
- **Commit author:** set it in the repo-local config with `git config user.name "Jeeva1398"` and `git config user.email "jeevamp0799@gmail.com"`. Verify each commit with `git log -1 --format='%an <%ae>'`.
- **No AI attribution:** no Co-Authored-By trailer or "Generated with" line (per the global CLAUDE.md).
- **One phase at a time:** implement the phase, run its exit check, commit, then `git push origin main`. Add `PLAN.md` to the repo in the Phase 0 commit.
- **Not done locally:** account and token creation (npm, HF, Kaggle) and the GPU training run. For those I prepare the scripts, notebook and workflow, then hand the steps that need credentials or a GPU to the user. Example: `npm publish` and `push_to_hub_gguf` need the user's tokens.

---

## Phase 0: Setup (Day 1)
- Create `D:\eventa` as a git repo and a GitHub repo `eventa`.
- Create accounts and tokens on npm, Hugging Face (write token) and Kaggle or Google Colab.
- Install Node ≥ 18 and Ollama locally, then `ollama pull qwen2.5-coder:1.5b`. This is the stand-in model until our own is trained.
- Check that the name `eventa` is free on npm (`npm view eventa`). If it's taken, use `@Jeeva1398/eventa`.

**Exit:** the repo exists and `ollama run qwen2.5-coder:1.5b "hello"` works.

## Phase 1: CLI skeleton (Week 1)
Structure:
```
D:\eventa
  packages/cli/
    package.json        # "bin": {"eventa": "dist/index.js"}, type: module
    tsconfig.json
    src/index.ts        # commander: explain | review | deps | model | config
    src/llm/provider.ts # interface: generate(prompt, opts) -> AsyncIterable<string>
    src/llm/ollama.ts   # POST http://localhost:11434/api/generate (stream)
    src/ui/render.ts    # streamed markdown via marked-terminal, spinner via ora
    src/config.ts       # ~/.eventa/config.json (model, provider)
```
- Libraries: `commander`, `ora`, `chalk`, `marked` + `marked-terminal`, `execa`. Build with `tsup`.

**Exit:** `node dist/index.js ask "what is the event loop"` streams an answer from Ollama.

## Phase 2: v1 features (Weeks 2–3)
| Command | Input gathered | Prompt template |
|---|---|---|
| `eventa explain` | stdin / `--file crash.log` → stack-trace parser → reads ±15 lines around each `file:line` in the user's project | `prompts/explain.ts` |
| `eventa review` | `git diff --staged` (or `--base main`) → split per file/hunk → token budget | `prompts/review.ts` |
| `eventa deps` | `npm audit --json`, `npm outdated --json`, scan of imports vs package.json for unused deps | `prompts/deps.ts` |

- Shared helpers go in `src/context/`: `stackParser.ts`, `diffChunker.ts`, `tokenBudget.ts`.
- Prompts use the Alpaca format `### Instruction:\n...\n\n### Response:`, the same format we train on in Phase 4.
- Flags: `--json` for CI output, `--provider`, `--model`.
- Tests: Vitest, with fixtures for stack traces, diffs and audit JSON in `packages/cli/test/fixtures/`.

**Exit:** all three commands give useful answers on sample fixtures using the stock Qwen model.

## Phase 3: Built-in local model, no Ollama needed (Week 4)
- `src/llm/local.ts` uses `node-llama-cpp` to load the GGUF in-process.
- `src/model/download.ts`: on first run, download the GGUF from the HF URL to `~/.eventa/models/` with a progress bar and SHA256 check.
- `eventa model list | pull | use <tag>`.
- Provider order: `--provider` flag → Ollama if running → built-in node-llama-cpp.
- Optional `src/llm/cloud.ts` uses `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` for higher quality. It's opt-in only.

**Exit:** on a machine without Ollama, `npx eventa explain` downloads the model once and then works offline.

## Phase 4: Train our own model `eventa` (Weeks 5–7)
- **Base:** `Qwen2.5-Coder-1.5B-Instruct`. It's better at code than Llama-3.2-1B and gives about a 1 GB Q4_K_M file.
- **Dataset** (`training/data/*.jsonl`, fields: instruction / input / output):
  - errors → cause + fix: Node core `ERR_*` codes, common runtime errors, Stack Overflow / GitHub issues.
  - diffs → review comments: CodeReviewer dataset filtered to JS/TS, plus hand-written Node pitfalls (missing await, unhandled rejection, sync fs in handlers, SQL/command injection).
  - audit JSON → upgrade advice.
  - Target 5k–20k examples. Clean, dedupe, and hold out 5% for eval (`training/eval.jsonl`).
- **Training:** `training/finetune.ipynb` uses Unsloth with QLoRA (r=16, 2–3 epochs) on a free T4 GPU.
- **Export:** `model.save_pretrained_gguf(..., quantization_method="q4_k_m")`.
- **Eval:** `training/eval.py` compares base and fine-tuned outputs on the held-out set and scores whether the root cause is correct.

**Exit:** the fine-tuned model clearly beats base Qwen on the eval set.

## Phase 5: Deploy (Week 8)
1. **Model → Hugging Face**
   - `model.push_to_hub_gguf("Jeeva1398/eventa-1.5b-gguf", tokenizer, quantization_method="q4_k_m", token=HF_TOKEN)`.
   - Add a model card (usage, prompt format, MIT license, eval results) and a `Modelfile`.
   - Users then run `ollama run hf.co/Jeeva1398/eventa-1.5b-gguf`.
2. **CLI default:** point `config.ts` at the new HF model URL and checksum.
3. **CLI → npm**
   - Add `#!/usr/bin/env node` to index.ts and limit `"files": ["dist"]`. The model isn't bundled (the package stays about 1 MB).
   - `npm login && npm run build && npm publish --access public`.
   - Users then run `npx eventa explain` or `npm i -g eventa`.
4. **GitHub Actions** (`.github/workflows/release.yml`)
   - On tag `v*`: lint, run tests, build, then `npm publish` (secret `NPM_TOKEN`).
   - Build standalone binaries (`bun build --compile`) for win/mac/linux and attach them to the GitHub Release.
5. **Docs:** a root README with a demo GIF, install steps and the commands.

**Exit:** on a clean PC, `npx eventa@latest explain < crash.txt` works end to end.

## Phase 6: Growth / v2 (after launch)
- `eventa test <file>` generates node:test or Vitest tests.
- `eventa migrate` converts CJS to ESM and callbacks to async/await.
- `eventa commit` writes commit messages.
- `eventa hook install` adds a pre-commit review.
- An MCP server mode so Claude Code and Cursor can use the same tools.
- A VS Code extension that wraps the CLI.
- A new model version trained on user-reported failures (opt-in feedback only).

---

## Verification checklist
- Phase 1: `ask` streams from Ollama.
- Phase 2: Vitest fixtures pass. A known `ERR_REQUIRE_ESM` crash is explained correctly. A staged diff with a missing `await` is flagged. A pinned vulnerable lodash version is reported.
- Phase 3: works offline after the first download, with no Ollama installed.
- Phase 4: the fine-tuned model scores higher than base on `eval.jsonl`.
- Phase 5: `npm pack`, global install from the tarball in a clean folder, and all commands run. The HF Ollama command works.
