import { writeFile } from 'node:fs/promises';
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
    { label: 'claude-sonnet-4-6', value: 'claude-sonnet-4-6', description: 'Recommended — fast & capable' },
    { label: 'claude-opus-4-6', value: 'claude-opus-4-6', description: 'Most capable' },
    { label: 'claude-haiku-4-5', value: 'claude-haiku-4-5', description: 'Fastest & cheapest' },
  ],
  gemini: [
    { label: 'gemini-2.5-flash', value: 'gemini-2.5-flash', description: 'Recommended — fast & cheap' },
    { label: 'gemini-2.5-pro', value: 'gemini-2.5-pro', description: 'Most capable' },
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
