# Shipli

[![npm version](https://img.shields.io/npm/v/@prasenjeet/shipli)](https://www.npmjs.com/package/@prasenjeet/shipli)
[![license](https://img.shields.io/npm/l/@prasenjeet/shipli)](LICENSE)

Store rejections cost days of development time. **Shipli** is a CLI tool that audits your Flutter source code against **Apple App Store** and **Google Play** guidelines using AI.

Catch missing permissions, policy violations, and compliance issues before you submit.

## Features

- **Dual Store Support** — Audit against Apple App Store and Google Play, together or individually.
- **Two Audit Modes** — Store compliance, code quality, or both in a single run.
- **AI-Powered** — Choose between Google Gemini or Anthropic Claude. Bring your own API key.
- **Up-to-Date Policies** — Ships with the latest Apple and Google Play store policies. Works offline.
- **Auto-Detection** — Automatically detects project type and target platform from your project structure.
- **Zero Setup** — No compiled artifacts needed. Point it at your Flutter project and run.
- **CI-Ready** — Designed for automation. Integrates with any CI/CD pipeline.

## Installation

```bash
npm install -g @prasenjeet/shipli
```

Requires Node.js 18 or later.

## Usage

### Quick Start

```bash
# One-time setup — select provider, model, and enter API key
shipli init

# Run full audit (auto-detects platform)
shipli --dir ./

# iOS App Store only
shipli --dir ./ --platform ios --mode store

# Google Play only
shipli --dir ./ --platform android --mode store

# Code quality only
shipli --dir ./ --mode code
```

### Commands

| Command | Description |
|---------|-------------|
| `shipli init` | Create a `.shipli` config file interactively |
| `shipli config` | Update provider, model, or API key |
| `shipli --dir <path>` | Run the audit (default command) |

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--dir <path>` | Path to Flutter project root | *required* |
| `--key <key>` | API key | `.shipli` / env var |
| `--provider <name>` | `gemini` or `claude` | `gemini` |
| `--model <model>` | Model override | per provider |
| `--type <type>` | `app` or `package` | auto-detected |
| `--mode <mode>` | `store`, `code`, or `both` | `both` |
| `--platform <platform>` | `ios`, `android`, or `both` | auto-detected |

### Configuration

Run `shipli init` to create a `.shipli` config file, or create one manually:

```json
{
  "provider": "claude",
  "key": "sk-ant-...",
  "model": "claude-sonnet-4-6",
  "platform": "both"
}
```

The CLI looks for `.shipli` in two places:

1. **Project-level** — in the `--dir` path (highest priority)
2. **Global** — in your home directory `~/.shipli`

Resolution order: CLI flags > project `.shipli` > global `~/.shipli` > env vars > defaults.

> Add `.shipli` to your `.gitignore` — it contains your API key.

Use `shipli config` to update settings anytime.

### Supported Models

| Provider | Models |
|----------|--------|
| Claude | opus-4-6, sonnet-4-6, opus-4-5, sonnet-4-5, haiku-4-5, opus-4-1, opus-4, sonnet-4, sonnet-3-7, haiku-3-5, sonnet-3-5 |
| Gemini | 3.1-pro, 3.1-flash-lite, 3-flash, 2.5-flash, 2.5-pro, 2.5-flash-lite, 1.5-pro, 1.5-flash |

## Audit Categories

### App Store (iOS)

| Category | Examples |
|----------|---------|
| Privacy & Permissions | Undeclared sensitive APIs, missing usage descriptions |
| Data Collection & Tracking | Tracking transparency, analytics disclosure |
| Content & Design | Minimum functionality, UI compliance |
| In-App Purchases | Payment method compliance |
| Legal & Compliance | Privacy policy, export compliance |
| Prohibited Behaviors | Dynamic code loading, hot-patching |

### Play Store (Android)

| Category | Examples |
|----------|---------|
| Permissions & Data Safety | Unnecessary permissions, data safety declarations |
| Data Collection & Privacy | Privacy policy, user data handling |
| Content & Behavior | Restricted content, deceptive behavior |
| Billing & Monetization | Payment method compliance |
| API Level & Compatibility | Target API requirements, version compatibility |
| Security & Abuse | Malware patterns, abusive behavior |

### Code Quality

| Category | Examples |
|----------|---------|
| Security | Hardcoded credentials, insecure connections |
| Architecture | State management, separation of concerns |
| Error Handling | Exception coverage, crash handling |
| Performance | Memory leaks, unnecessary rebuilds |
| Best Practices | Lifecycle handling, null safety |
| Dependencies | Outdated packages, version constraints |

### Package Auditing

| Category | Examples |
|----------|---------|
| API Surface & Documentation | Export hygiene, entry points |
| Platform Declarations | Channel consistency, missing platforms |
| Consumer Guidance | Undocumented permission requirements |
| Dependency Hygiene | Constraint quality, misplaced dependencies |
| Example App Quality | Missing or incomplete examples |

## MCP Server

Shipli includes a built-in [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server, so AI coding assistants like Claude Code, Cursor, and Windsurf can run audits directly inside your editor.

### Setup

Add to your MCP config (e.g. `~/.claude/.mcp.json`):

```json
{
  "mcpServers": {
    "shipli": {
      "command": "shipli-mcp",
      "env": {
        "SHIPLI_PROVIDER": "claude",
        "SHIPLI_MODEL": "claude-haiku-4-5",
        "ANTHROPIC_API_KEY": "your-api-key"
      }
    }
  }
}
```

For Gemini, use `SHIPLI_PROVIDER: "gemini"` and set `GEMINI_API_KEY` instead.

### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `shipli_store_audit` | Run store compliance audit against Apple App Store and/or Google Play guidelines | `projectDir` (required), `platform` (optional: `ios`, `android`, `both`) |
| `shipli_code_review` | Run code quality and security review | `projectDir` (required) |

Both tools return structured JSON with PASS/WARNING/FAIL scores and specific guideline citations.

### Usage

Once configured, ask your AI assistant:

```
"Run a store audit on /path/to/my-flutter-app"
"Review the code quality of this Flutter project"
```

The assistant will call the appropriate Shipli MCP tool and return the results inline.

## CI Integration

```yaml
# GitHub Actions
- name: Shipli Audit
  run: npx @prasenjeet/shipli --dir ./ --provider claude --key ${{ secrets.ANTHROPIC_API_KEY }}
```

The CLI exits with code `1` on failure, making it easy to gate deployments.

## License

MIT
