import chalk from 'chalk';

const ICONS = {
  pass: chalk.green('✔'),
  warning: chalk.yellow('⚠'),
  fail: chalk.red('✖'),
};

const SCORE_STYLE = {
  PASS: { badge: chalk.bgGreen.black.bold(' PASS '), color: chalk.green },
  WARNING: { badge: chalk.bgYellow.black.bold(' WARNING '), color: chalk.yellow },
  FAIL: { badge: chalk.bgRed.white.bold(' FAIL '), color: chalk.red },
};

const BOX_WIDTH = 56;

function wrapText(text, width = 64, indent = '      ') {
  const words = text.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > width) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);

  return lines.join(`\n${indent}`);
}

function boxLine(text, width) {
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
  const pad = Math.max(0, width - stripped.length - 2);
  return chalk.dim('  │') + ' ' + text + ' '.repeat(pad) + ' ' + chalk.dim('│');
}

function getTitle(mode, platform) {
  const platformLabel = { ios: 'iOS', android: 'Android', both: 'iOS + Android' }[platform] || '';
  if (mode === 'code') return 'Code Quality Report';
  if (mode === 'store') {
    if (platform === 'ios') return 'App Store Compliance Report';
    if (platform === 'android') return 'Play Store Compliance Report';
    return 'Store Compliance Report (iOS + Android)';
  }
  // both
  if (platform && platform !== 'both') return `Full Audit Report (${platformLabel})`;
  if (platform === 'both') return 'Full Audit Report (iOS + Android)';
  return 'Full Audit Report';
}

export function print(result, { projectType = 'app', projectName = '', provider = '', model = '', mode = 'both', platform = 'both' } = {}) {
  const nl = () => console.log();

  // ── Header Box ──
  nl();
  console.log(chalk.dim('  ┌' + '─'.repeat(BOX_WIDTH) + '┐'));
  const title = getTitle(mode, platform);
  console.log(boxLine(chalk.bold('Shipli') + chalk.dim(`  —  ${title}`), BOX_WIDTH));
  if (projectName) {
    console.log(boxLine(chalk.cyan(projectName) + chalk.dim(`  (${projectType})`), BOX_WIDTH));
  }
  if (provider) {
    console.log(boxLine(chalk.dim(`Provider: ${provider}/${model}`), BOX_WIDTH));
  }
  console.log(chalk.dim('  └' + '─'.repeat(BOX_WIDTH) + '┘'));
  nl();

  // ── Overall Score ──
  const style = SCORE_STYLE[result.score] || SCORE_STYLE.WARNING;
  console.log(`  Result:  ${style.badge}`);
  nl();

  // ── Summary ──
  if (result.summary) {
    console.log(chalk.dim('  ┈┈┈ Summary ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈'));
    nl();
    console.log(`  ${wrapText(result.summary, 68, '  ')}`);
    nl();
  }

  // ── Categories ──
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const category of result.categories || []) {
    const catStyle = SCORE_STYLE[category.status] || SCORE_STYLE.WARNING;
    const label = category.name || 'Unknown';
    const line = chalk.dim('  ┈┈┈ ') + chalk.bold(label) + ' ' + chalk.dim('┈'.repeat(Math.max(1, 44 - label.length))) + ' ' + catStyle.badge;
    console.log(line);
    nl();

    for (const finding of category.findings || []) {
      const icon = ICONS[finding.severity] || ICONS.warning;
      const ref = finding.guideline ? chalk.dim(` [${finding.guideline}]`) : '';
      console.log(`    ${icon}  ${chalk.bold(finding.title)}${ref}`);
      if (finding.detail) {
        console.log(`       ${chalk.dim(wrapText(finding.detail, 62, '       '))}`);
      }
      nl();

      if (finding.severity === 'pass') passCount++;
      else if (finding.severity === 'warning') warnCount++;
      else failCount++;
    }
  }

  // ── Recommendations ──
  if (result.recommendations?.length) {
    console.log(chalk.dim('  ┈┈┈ ') + chalk.bold('Recommendations') + ' ' + chalk.dim('┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈'));
    nl();
    for (let i = 0; i < result.recommendations.length; i++) {
      console.log(`    ${chalk.cyan(`${i + 1}.`)} ${result.recommendations[i]}`);
    }
    nl();
  }

  // ── Footer ──
  console.log(chalk.dim('  ' + '─'.repeat(BOX_WIDTH + 2)));
  nl();

  // Tally bar
  const total = passCount + warnCount + failCount;
  const barWidth = 30;
  const passBar = Math.round((passCount / total) * barWidth) || 0;
  const warnBar = Math.round((warnCount / total) * barWidth) || 0;
  const failBar = barWidth - passBar - warnBar;

  const bar = chalk.bgGreen(' '.repeat(passBar))
    + chalk.bgYellow(' '.repeat(warnBar))
    + chalk.bgRed(' '.repeat(Math.max(0, failBar)));

  console.log(`  ${bar}`);
  nl();

  const parts = [];
  parts.push(chalk.green(`${passCount} passed`));
  parts.push(chalk.yellow(`${warnCount} warnings`));
  parts.push(chalk.red(`${failCount} failed`));
  console.log(`  ${parts.join(chalk.dim('  ·  '))}`);
  nl();

  // ── Token Usage ──
  if (result._tokens) {
    const { estimated, actual } = result._tokens;
    const fmt = (n) => n != null ? n.toLocaleString() : '—';
    const tokenParts = [];

    if (actual?.input != null) {
      tokenParts.push(`input: ${fmt(actual.input)}`);
    }
    if (actual?.output != null) {
      tokenParts.push(`output: ${fmt(actual.output)}`);
    }
    if (actual?.total != null) {
      tokenParts.push(`total: ${fmt(actual.total)}`);
    } else if (estimated?.total != null) {
      tokenParts.push(`estimated: ~${fmt(estimated.total)}`);
    }

    if (tokenParts.length) {
      console.log(chalk.dim(`  Tokens: ${tokenParts.join(chalk.dim('  ·  '))}`));
      nl();
    }
  }
}
