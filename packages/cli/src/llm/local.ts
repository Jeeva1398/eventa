import { isDownloaded, resolveModel } from '../model/registry.js';
import { isRuntimeInstalled, type LlamaModel, loadRuntime } from '../model/runtime.js';
import { prepareLocal } from '../model/setup.js';
import { type GenerateOptions, type Provider, ProviderError } from './provider.js';

const loaded = new Map<string, Promise<LlamaModel>>();

async function loadModel(path: string): Promise<LlamaModel> {
  let model = loaded.get(path);
  if (!model) {
    model = loadRuntime().then(async (rt) => {
      const llama = await rt.getLlama({ gpu: process.platform === 'darwin' ? 'auto' : false, build: 'never', logLevel: 'error' });
      return llama.loadModel({ modelPath: path });
    });
    model.catch(() => loaded.delete(path));
    loaded.set(path, model);
  }
  return model;
}

export class LocalProvider implements Provider {
  readonly name = 'local';

  constructor(readonly model: string) {}

  async check(): Promise<void> {
    const spec = resolveModel(this.model);
    if (!isRuntimeInstalled()) throw new ProviderError('Local runtime is not installed', 'Run `eventa model pull` (or any command, it installs on first use)');
    if (!isDownloaded(spec)) throw new ProviderError(`Local model ${spec.id} is not downloaded`, `Run \`eventa model pull ${spec.id}\``);
  }

  async prepare(): Promise<void> {
    await loadModel(await prepareLocal(resolveModel(this.model)));
  }

  async *generate(prompt: string, opts: GenerateOptions = {}): AsyncGenerator<string> {
    const path = await prepareLocal(resolveModel(this.model));
    const rt = await loadRuntime();
    const model = await loadModel(path);
    const context = await model.createContext({ contextSize: opts.numCtx });
    const session = new rt.LlamaChatSession({ contextSequence: context.getSequence(), systemPrompt: opts.system });

    const chunks: string[] = [];
    let done = false;
    let failure: unknown;
    let wake: (() => void) | null = null;
    const notify = () => {
      wake?.();
      wake = null;
    };
    session
      .prompt(prompt, {
        temperature: opts.temperature,
        signal: opts.signal,
        onTextChunk: (t) => {
          chunks.push(t);
          notify();
        },
      })
      .catch((err: unknown) => (failure = err))
      .finally(() => {
        done = true;
        notify();
      });

    try {
      while (true) {
        if (chunks.length) yield chunks.shift()!;
        else if (done) break;
        else await new Promise<void>((r) => (wake = r));
      }
      if (failure) throw new ProviderError(`Local model error: ${(failure as Error).message}`);
    } finally {
      session.dispose();
      await context.dispose();
    }
  }
}
