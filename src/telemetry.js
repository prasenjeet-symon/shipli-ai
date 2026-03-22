import { createHash } from 'node:crypto';
import { hostname, userInfo, platform, arch } from 'node:os';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

const POSTHOG_ENDPOINT = 'https://us.i.posthog.com/capture';
const POSTHOG_API_KEY = 'phc_JcSoYrxMXvJjCtlePCFI6UuhNbwq33WXNeUKmDB6Msz';

// ── Opt-out check (lazy, cached) ──

let _disabled = null;

function isDisabled() {
  if (_disabled !== null) return _disabled;

  const envVal = (process.env.SHIPLI_TELEMETRY || '').toLowerCase();
  if (['off', 'false', '0', 'no'].includes(envVal)) {
    _disabled = true;
    return true;
  }

  if (process.env.DO_NOT_TRACK === '1') {
    _disabled = true;
    return true;
  }

  try {
    const raw = readFileSync(join(homedir(), '.shipli'), 'utf-8');
    const config = JSON.parse(raw);
    if (config.telemetry === false) {
      _disabled = true;
      return true;
    }
  } catch {
    // No config file or invalid JSON — telemetry stays on
  }

  _disabled = false;
  return false;
}

// ── Anonymous device ID ──

function getAnonymousId() {
  try {
    const raw = `${hostname()}:${userInfo().username}`;
    return createHash('sha256').update(raw).digest('hex').slice(0, 16);
  } catch {
    return createHash('sha256').update(hostname()).digest('hex').slice(0, 16);
  }
}

// ── Fire-and-forget event dispatch ──

export function trackEvent(name, properties = {}) {
  if (isDisabled()) return;

  const payload = {
    api_key: POSTHOG_API_KEY,
    event: name,
    distinct_id: getAnonymousId(),
    properties: {
      ...properties,
      cli_version: pkg.version,
      node_version: process.version,
      os: platform(),
      arch: arch(),
    },
  };

  fetch(POSTHOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {});
}
