import { rmSync } from 'node:fs';
import chalk from 'chalk';
import { loadConfig, setConfigValue } from '../config.js';
import { isDownloaded, MODELS, modelPath, resolveModel } from '../model/registry.js';
import { isRuntimeInstalled, runtimeDir } from '../model/runtime.js';
import { prepareLocal } from '../model/setup.js';

export function modelList(): void {
  const { localModel } = loadConfig();
  console.log(chalk.bold('Built-in models'));
  for (const spec of Object.values(MODELS)) {
    const mark = spec.id === localModel ? chalk.green('●') : ' ';
    const state = isDownloaded(spec) ? chalk.green('downloaded') : chalk.dim('not downloaded');
    console.log(`${mark} ${spec.id.padEnd(22)} ${state.padEnd(24)} ${chalk.dim(spec.description)}`);
  }
  console.log(chalk.dim(`\nRuntime: ${isRuntimeInstalled() ? `installed in ${runtimeDir()}` : 'not installed'}`));
}

export async function modelPull(id?: string): Promise<void> {
  const spec = resolveModel(id ?? loadConfig().localModel);
  const path = await prepareLocal(spec);
  console.log(chalk.green(`✔ ${spec.id} is ready (${path})`));
}

export function modelUse(id: string): void {
  const spec = resolveModel(id);
  setConfigValue('localModel', MODELS[spec.id] ? spec.id : spec.url || spec.file);
  console.log(`localModel = ${spec.id}${isDownloaded(spec) ? '' : chalk.dim('  (downloads on first use, or run `eventa model pull`)')}`);
}

export function modelRemove(id: string): void {
  const spec = resolveModel(id);
  if (!spec.url) throw new Error('Refusing to delete a local file you provided yourself.');
  rmSync(modelPath(spec), { force: true });
  rmSync(`${modelPath(spec)}.part`, { force: true });
  console.log(`Removed ${spec.id}`);
}
