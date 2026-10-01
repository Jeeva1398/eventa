# Training eventa-1.5b

Fine-tunes `Qwen2.5-Coder-1.5B-Instruct` on Node.js debugging, code review and dependency tasks, then exports a Q4_K_M GGUF.

## 1. Build the dataset

```bash
npm run build-data -w eventa-training
```

`src/build-dataset.ts` writes `data/train.jsonl` and `data/eval.jsonl`. Every example is built with the **CLI's own prompt builders**, so the training inputs match what `eventa` sends at runtime.

| Task | Source | How the answer is made |
|---|---|---|
| explain | `src/scenarios/explain.ts`: small programs that really crash on Node (plus a few captured traces for version-specific errors). Each is run, and its stack trace is parsed with the CLI's parser. | Hand-written cause / fix / prevent per scenario |
| review | `src/scenarios/review.ts`: before/after files diffed with git, with static hints from the CLI's rules. Includes clean diffs whose hints must be dismissed. | Annotated issues with line numbers and severity |
| deps | `src/scenarios/deps.ts`: random reports built from real advisories and major-upgrade notes | Template that keeps the computed fix commands exactly |

Identifiers, file names and project roots (Windows and POSIX) vary per example. Whole scenarios listed in `EVAL_SCENARIOS` are held out, so eval measures generalisation, not memorisation. Override the sizes with `REPEATS`, `DEPS_TRAIN` and `DEPS_EVAL`.

Each record has `system`, `instruction`, `input`, `output` and a `check` used by eval. The notebook renders the records with the Qwen chat template: system message, then user = `instruction + "\n\n" + input`, then assistant = `output`.

## 2. Fine-tune (free GPU)

Open `finetune.ipynb` on Kaggle or Colab with a T4 GPU and run all cells. It runs Unsloth QLoRA (r=16, 2 epochs, responses-only loss) in about 15–25 min, then exports `eventa-1.5b-q4_k_m.gguf` and prints its SHA-256.

## 3. Evaluate locally

```bash
# put eventa-1.5b-q4_k_m.gguf in training/ first
ollama create eventa -f training/Modelfile
npm run eval -w eventa-training -- --models qwen2.5-coder:1.5b,eventa
```

`src/eval.ts` writes `eval-report.md` (local, not committed) and saves the raw model outputs in `outputs/`. It scores:
- **explain:** 3-section format and the key facts mentioned
- **review:** issue recall/precision (±1 line), severity, and clean diffs
- **deps:** exact fix commands, coverage of major upgrades, and invented versions
