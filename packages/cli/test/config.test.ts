import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULTS, configPath, loadConfig, setConfigValue } from '../src/config.js';

beforeEach(() => {
  process.env.EVENTA_HOME = mkdtempSync(join(tmpdir(), 'eventa-'));
});

describe('config', () => {
  it('falls back to defaults', () => {
    expect(loadConfig({}, {})).toEqual(DEFAULTS);
  });

  it('applies file, then env, then overrides', () => {
    setConfigValue('model', 'from-file');
    expect(loadConfig({}, {}).model).toBe('from-file');
    expect(loadConfig({}, { EVENTA_MODEL: 'from-env' }).model).toBe('from-env');
    expect(loadConfig({ model: 'from-flag' }, { EVENTA_MODEL: 'from-env' }).model).toBe('from-flag');
    expect(loadConfig({}, { EVENTA_TEMPERATURE: '0' }).temperature).toBe(0);
    expect(loadConfig({}, { EVENTA_TEMPERATURE: 'x' }).temperature).toBe(0.2);
    expect(loadConfig({ model: undefined }, {}).model).toBe('from-file');
  });

  it('normalises OLLAMA_HOST without a scheme', () => {
    expect(loadConfig({}, { OLLAMA_HOST: '127.0.0.1:11434' }).ollamaHost).toBe('http://127.0.0.1:11434');
  });

  it('stores numbers as numbers and rejects bad ones', () => {
    setConfigValue('temperature', '0.5');
    expect(JSON.parse(readFileSync(configPath(), 'utf8')).temperature).toBe(0.5);
    expect(() => setConfigValue('temperature', 'hot')).toThrow();
  });
});
