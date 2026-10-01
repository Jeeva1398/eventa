# Releasing Eventa

Two things get published: the **model** (Hugging Face) and the **CLI** (npm + GitHub Releases). Both are free.

## One-time setup

| Where | What |
|---|---|
| huggingface.co | Account `Jeeva1398` and a **write** access token |
| npmjs.com | Account, then an **Automation** (or granular, publish) access token |
| GitHub repo → Settings → Secrets → Actions | `NPM_TOKEN` = the npm token |
| Kaggle or Colab | Account with phone verification (needed for free GPUs). Add `HF_TOKEN` as a notebook secret |

## 1. Publish the model

1. Open `training/finetune.ipynb` on Kaggle or Colab with a **T4 GPU** and run all cells.
2. The last cell uploads `eventa-1.5b-q4_k_m.gguf`, the model card, `system`/`params` (for Ollama) and the `Modelfile` to `huggingface.co/Jeeva1398/eventa-1.5b-gguf`.
3. Download the GGUF as well, put it in `training/`, and compare it with the base model:

   ```bash
   ollama create eventa -f training/Modelfile
   npm run eval -w eventa-training -- --models qwen2.5-coder:1.5b,eventa
   ```

4. If it wins, make it the default. In `packages/cli/src/config.ts`, set `localModel: 'eventa-1.5b'`; for Ollama users, `model: 'hf.co/Jeeva1398/eventa-1.5b-gguf'`. Commit the new `training/eval-report.md` too.

Check: `ollama run hf.co/Jeeva1398/eventa-1.5b-gguf` and `npx eventa model pull eventa-1.5b`. The CLI fetches the SHA-256 from the Hugging Face API and verifies the download.

## 2. Publish the CLI

```bash
npm version patch -w eventa          # or minor / major
git add -A && git commit -m "release v$(node -p "require('./packages/cli/package.json').version")"
git tag "v$(node -p "require('./packages/cli/package.json').version")"
git push origin main --tags
```

Pushing the tag runs `.github/workflows/release.yml`, which:
- checks that the tag matches `packages/cli/package.json`, runs the tests and builds
- runs `npm publish --provenance` using `NPM_TOKEN`
- compiles standalone binaries with Bun (linux/mac/windows) and attaches them to a GitHub Release

To publish by hand instead: `npm login`, then `npm publish -w eventa --access public`. `prepublishOnly` runs the typecheck, tests and build first.

**About the npm name:** `eventa` was used once and unpublished in 2023, and npm lets the name be reused after that. If the publish is refused anyway, rename the package to `@jeeva1398/eventa`. The `bin` stays `eventa`, so users run `npx @jeeva1398/eventa`.

## Check after release

On a clean machine with Node 20+ and no Ollama:

```bash
npx eventa@latest doctor
node -e "null.x" 2>&1 | npx eventa@latest explain
```
