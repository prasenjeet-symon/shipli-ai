# 🛡️ Shipli

App Store rejections cost days of development time. **Shipli** is a local CLI tool that statically analyzes your Flutter source code and `Info.plist` permissions against the latest Apple App Store Review Guidelines using an LLM.

Catch missing permissions, unhandled edge cases, and UI compliance issues *before* you wait in the review queue.

## ✨ Features

* **Deep UI Scanning:** Automatically detects if your responsive layouts hide required compliance buttons.
* **Theme & Styling Checks:** Ensures your UI doesn't rely on hard-coded colors that might fail Apple's accessibility or Dark Mode review standards.
* **Zero-Setup Artifacts:** No need to compile an `.ipa` file. It reads your `lib/` directory and `pubspec.yaml` directly.
* **Multi-Provider:** Choose between **Google Gemini** or **Anthropic Claude** as your AI backend.
* **CI-Friendly:** Exit code `1` on FAIL, `0` on PASS/WARNING — plug it into your pipeline.

## 🚀 Installation

```bash
npm install -g shipli
```

Requires **Node.js 18+**.

## 🛠️ Usage

### Quick Start

```bash
# One-time setup — creates a .shipli config file
shipli init

# Run the audit
shipli --dir ./
```

Or pass everything inline:

```bash
shipli --dir ./ --provider claude --key YOUR_API_KEY
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--dir <path>` | Path to Flutter project root | *required* |
| `--key <key>` | API key | `.shipli` / env var |
| `--provider <name>` | `gemini` or `claude` | `gemini` |
| `--model <model>` | Model override | `gemini-2.5-flash` / `claude-sonnet-4-6` |
| `--type <type>` | `app` or `package` | auto-detected from pubspec |

### Configuration: `.shipli`

Run `shipli init` to create a `.shipli` config file, or create one manually:

```json
{
  "provider": "claude",
  "key": "sk-ant-...",
  "model": "claude-sonnet-4-6"
}
```

The CLI looks for `.shipli` in two places:
1. **Project-level** — in the `--dir` path (highest priority)
2. **Global** — in your home directory `~/.shipli`

Project-level values override global ones. CLI flags override everything.

**Resolution order:** CLI flags > project `.shipli` > global `~/.shipli` > env vars > defaults

> **Note:** Add `.shipli` to your `.gitignore` — it contains your API key.

Environment variables (`GEMINI_API_KEY` / `ANTHROPIC_API_KEY`) are still supported as a fallback.

## 🧠 How it Works

1. **Detects Project Type:** Auto-detects whether you're auditing a **main app** or a **Flutter package/plugin** from `pubspec.yaml` (or use `--type` to override).
2. **Extracts Evidence:** Recursively scans your `lib/` folder for Dart files, stripping noise and keeping only the architectural skeleton. For packages, it also scans `example/` if present.
3. **Gathers Metadata:** For apps: reads `ios/Runner/Info.plist` permissions. For packages: reads plugin platform declarations from pubspec.
4. **AI Audit:** Sends evidence to Gemini or Claude with a tailored system prompt — App Store reviewer for apps, pub.dev quality auditor for packages.
5. **Actionable Report:** Outputs a clear Pass/Warning/Fail checklist directly in your terminal.

## 📱 App Audit Categories

| Category | Examples |
|----------|---------|
| **Privacy & Permissions** | Missing Info.plist usage descriptions, undeclared sensitive APIs |
| **Data Collection & Tracking** | Analytics SDKs, ATT requirements |
| **Content & Design** | Webview-only apps, minimum functionality |
| **In-App Purchases** | Third-party payment for digital goods |
| **Security** | Hardcoded API keys, insecure HTTP |
| **Legal** | Privacy policy, export compliance, COPPA |
| **Performance** | Problematic dependencies, excessive permissions |
| **Flutter-Specific** | Code push, dynamic code loading, platform channels |

## 📦 Package Audit Categories

| Category | Examples |
|----------|---------|
| **API Surface & Documentation** | Export hygiene, clear entry points |
| **Platform Declarations** | MethodChannel consistency, missing platforms |
| **Dependency Hygiene** | Overly tight/loose constraints, misplaced deps |
| **Consumer Permissions Guidance** | Undocumented Info.plist keys host apps need |
| **Security** | Hardcoded keys, unsafe platform channel handling |
| **Compatibility & Versioning** | SDK constraints, breaking change risks |
| **Example App Quality** | Missing example/, incomplete demos |
| **Flutter-Specific** | Dispose/lifecycle, memory leaks, null safety |

## 🔄 CI Integration

```yaml
# GitHub Actions example
- name: Shipli Audit
  run: npx shipli --dir ./ --provider claude --key ${{ secrets.ANTHROPIC_API_KEY }}
```

The CLI exits with code `1` if the audit result is **FAIL**, making it easy to gate deployments.

## License

MIT
