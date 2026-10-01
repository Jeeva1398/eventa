import { CONFIG_KEYS, type Config, configPath, loadConfig, setConfigValue } from '../config.js';

function assertKey(key: string): asserts key is keyof Config {
  if (!CONFIG_KEYS.includes(key as keyof Config)) {
    throw new Error(`Unknown config key "${key}". Valid keys: ${CONFIG_KEYS.join(', ')}`);
  }
}

export function configGet(key?: string): void {
  const config = loadConfig();
  if (!key) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }
  assertKey(key);
  console.log(String(config[key]));
}

export function configSet(key: string, value: string): void {
  assertKey(key);
  setConfigValue(key, value);
  console.log(`${key} = ${value}`);
}

export function configWhere(): void {
  console.log(configPath());
}
