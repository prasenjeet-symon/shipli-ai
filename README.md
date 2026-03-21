# 🛡️ Shipli

Store rejections cost days of development time. **Shipli** is a local CLI tool that statically analyzes your Flutter source code against the latest **Apple App Store** and **Google Play** guidelines using an LLM.

Catch missing permissions, policy violations, and compliance issues *before* you submit.

## ✨ Features

* **Dual Store Support:** Audit against **Apple App Store** and **Google Play** — or both at once.
* **Two Audit Modes:** `--mode store` for compliance, `--mode code` for quality, or both (default).
* **Live Guidelines:** Fetches the latest store policies at runtime and caches them locally.
* **Auto-Detection:** Detects project type (app/package) and platform (ios/android) automatically.
* **Multi-Provider:** Choose between **Google Gemini** or **Anthropic Claude** as your AI backend.
* **Zero-Setup Artifacts:** No `.ipa` or `.apk` needed — reads `lib/`, `pubspec.yaml`, `Info.plist`, and `AndroidManifest.xml` directly.
* **CI-Friendly:** Exit code `1` on FAIL, `0` on PASS/WARNING.

## 🚀 Installation

```bash
npm install -g shipli
```

Requires **Node.js 18+**.

## 🛠️ Usage

### Quick Start

```bash
# One-time setup
shipli init

# Run full audit (auto-detects platform)
shipli --dir ./

# iOS App Store only
shipli --dir ./ --platform ios --mode store

# Google Play only
shipli --dir ./ --platform android --mode store

# Code quality only (platform-agnostic)
shipli --dir ./ --mode code
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `--dir <path>` | Path to Flutter project root | *required* |
| `--key <key>` | API key | `.shipli` / env var |
| `--provider <name>` | `gemini` or `claude` | `gemini` |
| `--model <model>` | Model override | `gemini-2.5-flash` / `claude-sonnet-4-6` |
| `--type <type>` | `app` or `package` | auto-detected from pubspec |
| `--mode <mode>` | `store`, `code`, or `both` | `both` |
| `--platform <platform>` | `ios`, `android`, or `both` | auto-detected from project |

### Configuration: `.shipli`

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

**Resolution order:** CLI flags > project `.shipli` > global `~/.shipli` > env vars > defaults

> **Note:** Add `.shipli` to your `.gitignore` — it contains your API key.

## 🧠 How it Works

1. **Detects Project & Platform:** Auto-detects app vs package from `pubspec.yaml`, and iOS/Android from project structure.
2. **Extracts Evidence:** Scans `lib/` for Dart files, keeping only the architectural skeleton. For packages, also scans `example/`.
3. **Gathers Metadata:** Reads `Info.plist` (iOS) and/or `AndroidManifest.xml` (Android) permissions.
4. **Fetches Live Guidelines:** Downloads the latest Apple App Store Review Guidelines and/or Google Play Developer Policies (cached for 7 days).
5. **AI Audit:** Sends evidence + live guidelines to the LLM with a tailored system prompt.
6. **Actionable Report:** Outputs a Pass/Warning/Fail checklist with specific guideline citations.

## 📱 App Store Audit Categories (iOS)

| Category | Examples |
|----------|---------|
| **Privacy & Permissions** | Missing Info.plist usage descriptions, undeclared APIs |
| **Data Collection & Tracking** | ATT requirements, analytics SDKs |
| **Content & Design** | Webview-only apps, minimum functionality |
| **In-App Purchases** | StoreKit/IAP vs third-party payment |
| **Legal & Compliance** | Privacy policy, encryption export, COPPA |
| **Forbidden Patterns** | Code push, dynamic code loading |

## 🤖 Play Store Audit Categories (Android)

| Category | Examples |
|----------|---------|
| **Permissions & Data Safety** | Unnecessary permissions, Data Safety compliance |
| **Data Collection & Privacy** | Privacy policy, User Data policy |
| **Content & Behavior** | Restricted content, deceptive behavior |
| **Billing & Monetization** | Google Play Billing Library requirements |
| **Target API & Compatibility** | Minimum API level, Android version issues |
| **Malware & Abuse** | Stalkerware, abusive notifications |

## 🔧 Code Quality Categories

| Category | Examples |
|----------|---------|
| **Security** | Hardcoded keys, insecure HTTP, injection |
| **Architecture** | State management, separation of concerns |
| **Error Handling** | try/catch, crash handling |
| **Performance** | Widget rebuilds, memory leaks |
| **Best Practices** | Dispose/lifecycle, null safety |
| **Dependencies** | Outdated packages, version constraints |

## 📦 Package Audit Categories

| Category | Examples |
|----------|---------|
| **API Surface & Documentation** | Export hygiene, clear entry points |
| **Platform Declarations** | MethodChannel consistency |
| **Consumer Permissions Guidance** | Undocumented permission requirements |
| **Dependency Hygiene** | Constraint quality, misplaced deps |
| **Example App Quality** | Missing example/, incomplete demos |

## 🔄 CI Integration

```yaml
# GitHub Actions example
- name: Shipli Audit
  run: npx shipli --dir ./ --platform both --provider claude --key ${{ secrets.ANTHROPIC_API_KEY }}
```

The CLI exits with code `1` if the audit result is **FAIL**, making it easy to gate deployments.

## License

MIT
