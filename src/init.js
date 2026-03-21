import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import chalk from 'chalk';
import { createInterface } from 'node:readline';

// ── Arrow-key select prompt (no deps) ──

function select(label, options) {
  return new Promise((resolve) => {
    let cursor = 0;

    const render = () => {
      // Move cursor up to re-draw (skip on first render)
      if (render.drawn) {
        process.stdout.write(`\x1b[${options.length + 1}A`);
      }
      render.drawn = true;

      console.log(`  ${chalk.bold(label)}`);
      for (let i = 0; i < options.length; i++) {
        const icon = i === cursor ? chalk.cyan('❯') : ' ';
        const text = i === cursor
          ? chalk.cyan(options[i].label)
          : chalk.dim(options[i].label);
        const desc = options[i].description ? chalk.dim(` — ${options[i].description}`) : '';
        console.log(`    ${icon} ${text}${desc}`);
      }
    };

    render();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf-8');

    const onKey = (key) => {
      // Ctrl+C
      if (key === '\x03') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('data', onKey);
        process.exit(0);
      }
      // Up arrow
      if (key === '\x1b[A' || key === 'k') {
        cursor = (cursor - 1 + options.length) % options.length;
        render();
      }
      // Down arrow
      else if (key === '\x1b[B' || key === 'j') {
        cursor = (cursor + 1) % options.length;
        render();
      }
      // Enter
      else if (key === '\r' || key === '\n') {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onKey);
        resolve(options[cursor]);
      }
    };

    process.stdin.on('data', onKey);
  });
}

function textInput(label, fallback = '') {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const suffix = fallback ? chalk.dim(` (${fallback})`) : '';
  return new Promise((resolve) => {
    rl.question(`  ${label}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || fallback);
    });
  });
}

// ── Config ──

const PROVIDERS = [
  { label: 'Claude (Anthropic)', value: 'claude', description: 'claude-sonnet-4-6' },
  { label: 'Gemini (Google)', value: 'gemini', description: 'gemini-2.5-flash' },
];

const MODELS = {
  claude: [
    { label: 'claude-sonnet-4-6', value: 'claude-sonnet-4-6', description: 'Recommended — balanced flagship' },
    { label: 'claude-opus-4-6', value: 'claude-opus-4-6', description: 'Frontier — highest reasoning' },
    { label: 'claude-haiku-4-5', value: 'claude-haiku-4-5', description: 'Fastest & cheapest' },
    { label: 'claude-opus-4-5', value: 'claude-opus-4-5', description: 'Frontier intelligence' },
    { label: 'claude-sonnet-4-5', value: 'claude-sonnet-4-5', description: 'Balanced — enterprise' },
    { label: 'claude-opus-4-1', value: 'claude-opus-4-1', description: 'Advanced reasoning' },
    { label: 'claude-opus-4', value: 'claude-opus-4', description: 'Advanced reasoning' },
    { label: 'claude-sonnet-4', value: 'claude-sonnet-4', description: 'Balanced' },
    { label: 'claude-sonnet-3-7', value: 'claude-sonnet-3-7', description: 'Legacy — balanced' },
    { label: 'claude-haiku-3-5', value: 'claude-haiku-3-5', description: 'Legacy — fast' },
    { label: 'claude-sonnet-3-5', value: 'claude-sonnet-3-5', description: 'Legacy — balanced' },
  ],
  gemini: [
    { label: 'gemini-3.1-pro', value: 'gemini-3.1-pro', description: 'Frontier — advanced reasoning, 1M context' },
    { label: 'gemini-3.1-flash-lite', value: 'gemini-3.1-flash-lite', description: 'Ultra-efficient — lowest latency' },
    { label: 'gemini-3-flash', value: 'gemini-3-flash', description: 'High-performance multimodal + coding' },
    { label: 'gemini-2.5-flash', value: 'gemini-2.5-flash', description: 'Recommended — fast & cheap' },
    { label: 'gemini-2.5-pro', value: 'gemini-2.5-pro', description: 'Strong reasoning + multimodal' },
    { label: 'gemini-2.5-flash-lite', value: 'gemini-2.5-flash-lite', description: 'Lightweight — high-volume, low-cost' },
    { label: 'gemini-1.5-pro', value: 'gemini-1.5-pro', description: 'Legacy — early multimodal' },
    { label: 'gemini-1.5-flash', value: 'gemini-1.5-flash', description: 'Legacy — fast' },
  ],
};

// ── Main ──

export async function runInit() {
  console.log();
  console.log(chalk.bold('  Shipli — Setup'));
  console.log(chalk.dim('  Creates a .shipli config file in the current directory.'));
  console.log(chalk.dim('  Use ↑↓ arrows to navigate, Enter to select.\n'));

  // 1. Provider
  const providerChoice = await select('Select AI provider:', PROVIDERS);
  const provider = providerChoice.value;
  console.log();

  // 2. Model
  const modelChoice = await select('Select model:', MODELS[provider]);
  const model = modelChoice.value;
  console.log();

  // 3. API key (text input)
  const key = await textInput('API key');

  if (!key) {
    console.error(chalk.red('\n  API key is required.'));
    process.exit(1);
  }

  // Write config
  const config = { provider, model, key };
  const filePath = join(process.cwd(), '.shipli');
  await writeFile(filePath, JSON.stringify(config, null, 2) + '\n');

  console.log();
  console.log(chalk.green('  ✔ Created .shipli'));
  console.log(chalk.yellow('  ⚠ Add .shipli to your .gitignore — it contains your API key.'));
  console.log(chalk.dim(`\n  Run ${chalk.cyan('shipli --dir ./')} to start auditing.\n`));
}

// ── Config updater ──

async function loadExistingConfig() {
  const filePath = join(process.cwd(), '.shipli');
  try {
    const raw = await readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const CONFIG_FIELDS = [
  { label: 'Provider', key: 'provider', description: 'Change AI provider' },
  { label: 'Model', key: 'model', description: 'Change model' },
  { label: 'API Key', key: 'key', description: 'Update API key' },
  { label: 'Done', key: '_done', description: 'Save and exit' },
];

export async function runConfig() {
  const existing = await loadExistingConfig();
  if (!existing) {
    console.error(chalk.red('\n  No .shipli config found. Run ') + chalk.cyan('shipli init') + chalk.red(' first.\n'));
    process.exit(1);
  }

  console.log();
  console.log(chalk.bold('  Shipli — Config'));
  console.log(chalk.dim('  Update your .shipli configuration.\n'));

  console.log(chalk.dim('  Current config:'));
  console.log(`    Provider: ${chalk.cyan(existing.provider || 'not set')}`);
  console.log(`    Model:    ${chalk.cyan(existing.model || 'not set')}`);
  console.log(`    API Key:  ${chalk.cyan(existing.key ? '••••' + existing.key.slice(-6) : 'not set')}`);
  console.log();

  let changed = false;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const choice = await select('What to update?', CONFIG_FIELDS);

    if (choice.key === '_done') break;

    console.log();

    if (choice.key === 'provider') {
      const providerChoice = await select('Select AI provider:', PROVIDERS);
      existing.provider = providerChoice.value;
      // Reset model to default for new provider
      const defaultModel = MODELS[existing.provider]?.[0];
      if (defaultModel) {
        existing.model = defaultModel.value;
        console.log(chalk.dim(`    Model reset to ${existing.model}`));
      }
      changed = true;
    } else if (choice.key === 'model') {
      const provider = existing.provider || 'claude';
      const modelList = MODELS[provider];
      if (!modelList) {
        console.error(chalk.red(`    Unknown provider "${provider}". Update provider first.`));
        continue;
      }
      console.log();
      const modelChoice = await select(`Select ${provider} model:`, modelList);
      existing.model = modelChoice.value;
      changed = true;
    } else if (choice.key === 'key') {
      console.log();
      const key = await textInput('New API key');
      if (key) {
        existing.key = key;
        changed = true;
      }
    }

    console.log();
  }

  if (changed) {
    const filePath = join(process.cwd(), '.shipli');
    await writeFile(filePath, JSON.stringify(existing, null, 2) + '\n');
    console.log();
    console.log(chalk.green('  ✔ Config updated'));
  } else {
    console.log();
    console.log(chalk.dim('  No changes made.'));
  }
  console.log();
}
