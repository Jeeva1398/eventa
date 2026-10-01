import chalk from 'chalk';
import { downloadModel, formatProgress } from './download.js';
import { isDownloaded, type ModelSpec, modelPath } from './registry.js';
import { installRuntime, isRuntimeInstalled } from './runtime.js';

const log = (msg: string) => process.stderr.write(chalk.dim(msg) + '\n');

export async function prepareLocal(spec: ModelSpec): Promise<string> {
  if (!isRuntimeInstalled()) await installRuntime(log);
  if (isDownloaded(spec)) return modelPath(spec);

  log(`Downloading ${spec.id} (${spec.size ? `${(spec.size / 1024 ** 3).toFixed(1)} GB, ` : ''}one time)…`);
  const tty = process.stderr.isTTY;
  let lastLog = 0;
  const path = await downloadModel(spec, (p) => {
    if (tty) process.stderr.write(`\r${formatProgress(p)}`);
    else if (Date.now() - lastLog > 5000) {
      lastLog = Date.now();
      log(formatProgress(p));
    }
  });
  if (tty) process.stderr.write('\n');
  log(`Saved to ${path}`);
  return path;
}
