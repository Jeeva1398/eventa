# Eventa eval report

33 held-out examples (2026-10-01).

| Metric | `qwen2.5-coder:1.5b` | `hf.co/jeeva1398/eventa-1.5b-gguf` |
|---|---|---|
| Explain: 3-section format | 80% | 100% |
| Explain: key facts mentioned | 97% | 82% |
| Review: real issues found | 100% | 100% |
| Review: precision | 44% | 100% |
| Review: correct severity | 80% | 100% |
| Review: clean diff → "No issues found." | 0% | 0% |
| Deps: exact fix commands | 100% | 100% |
| Deps: major upgrades covered | 100% | 100% |
| Deps: no invented versions | 93% | 100% |
| Avg seconds / example (CPU) | 13.9 | 8.1 |
