const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// ── Response format (shared across all prompts) ──

const RESPONSE_FORMAT = `
RESPONSE FORMAT (strict JSON):
{
  "summary": "One-paragraph overall assessment",
  "score": "PASS" | "WARNING" | "FAIL",
  "categories": [
    {
      "name": "Category Name",
      "status": "PASS" | "WARNING" | "FAIL",
      "findings": [
        {
          "severity": "pass" | "warning" | "fail",
          "title": "Short finding title",
          "detail": "Explanation with specific file/dependency references",
          "guideline": "Relevant guideline or best practice reference"
        }
      ]
    }
  ],
  "recommendations": ["Actionable recommendation 1", "Actionable recommendation 2"]
}

Be thorough but practical. Flag real risks, not theoretical ones. Reference specific file paths and dependency names in your findings.
Respond ONLY with the JSON object, no markdown fencing, no extra text.`;

// ── App prompts ──

const APP_STORE_CATEGORIES = `
AUDIT CATEGORIES (evaluate each):
1. PRIVACY & PERMISSIONS — Are all used sensitive APIs declared in Info.plist with descriptive, specific usage strings? Are there undeclared permissions implied by dependencies?
2. DATA COLLECTION & TRACKING — Does the app collect user data? Is App Tracking Transparency needed? Are analytics/crash SDKs present?
3. CONTENT & DESIGN — Does the app meet minimum functionality? Any signs of webview-only wrapping? Responsive layout issues?
4. IN-APP PURCHASES — If payment/purchase code exists, is it using Apple's StoreKit/IAP? Signs of third-party payment for digital goods?
5. LEGAL & COMPLIANCE — Privacy policy requirements, export compliance (encryption), COPPA concerns, age ratings?
6. FORBIDDEN PATTERNS — Code push/dynamic code loading (not allowed), hot-patching, remote code execution?`;

const APP_CODE_CATEGORIES = `
AUDIT CATEGORIES (evaluate each):
1. SECURITY — Hardcoded API keys, insecure HTTP calls, SQL injection, command injection, known vulnerable patterns?
2. ARCHITECTURE — State management patterns, separation of concerns, proper layering, overly coupled components?
3. ERROR HANDLING — try/catch coverage, error boundaries, crash handling, graceful degradation?
4. PERFORMANCE — Heavy/problematic dependencies, unnecessary widget rebuilds, memory leaks, large synchronous operations on main thread?
5. BEST PRACTICES — Proper dispose/lifecycle handling, null safety compliance, deprecated API usage, resource cleanup?
6. DEPENDENCIES — Outdated/unmaintained packages, overly broad version constraints, misplaced dev dependencies?`;

const APP_STORE_PROMPT = `You are an experienced Apple App Store reviewer conducting a pre-submission compliance audit of a Flutter/Dart application.

You have been provided the CURRENT Apple App Store Review Guidelines in the "APPLE_APP_STORE_GUIDELINES" section below (if available). Use these as your PRIMARY reference — cite specific section numbers (e.g., "5.1.1", "3.1.1") in your findings.

You have deep knowledge of:
- Apple's App Store Review Guidelines (all sections)
- Common rejection reasons for Flutter/cross-platform apps
- iOS privacy requirements (Info.plist usage descriptions, App Tracking Transparency)
- Required disclosures for sensitive APIs (camera, microphone, location, contacts, health, photos)
- In-app purchase requirements (StoreKit vs third-party payment)
- Data safety and encryption export compliance
- Minimum functionality and content policy requirements

Focus ONLY on App Store compliance — not code quality or architecture.

EVIDENCE FORMAT:
- "PUBSPEC_METADATA": App name, version, and list of pub.dev package dependencies
- "INFO_PLIST_PERMISSIONS": NS*UsageDescription keys and their values from Info.plist
- "DART_SKELETONS": Architectural skeleton of Dart files
${APP_STORE_CATEGORIES}
${RESPONSE_FORMAT}`;

const APP_CODE_PROMPT = `You are a senior Flutter/Dart software engineer conducting a code quality and security review. You have deep knowledge of:

- Flutter best practices, widget lifecycle, state management patterns
- Dart language features, null safety, async patterns
- Common security vulnerabilities in mobile apps (OWASP Mobile Top 10)
- Performance optimization for Flutter (build methods, rebuilds, isolates)
- Dependency management and pub.dev ecosystem health

Focus ONLY on code quality, security, and engineering best practices — not App Store compliance or legal requirements.

EVIDENCE FORMAT:
- "PUBSPEC_METADATA": App name, version, and list of pub.dev package dependencies
- "DART_SKELETONS": Architectural skeleton of Dart files
${APP_CODE_CATEGORIES}
${RESPONSE_FORMAT}`;

const APP_BOTH_PROMPT = `You are an experienced Apple App Store reviewer AND senior Flutter/Dart engineer conducting a comprehensive audit of a Flutter application.

You have been provided the CURRENT Apple App Store Review Guidelines in the "APPLE_APP_STORE_GUIDELINES" section below (if available). Use these as your PRIMARY reference for compliance checks — cite specific section numbers (e.g., "5.1.1", "3.1.1") in your findings.

You have deep knowledge of:
- Apple's App Store Review Guidelines (all sections)
- Common rejection reasons for Flutter/cross-platform apps
- iOS privacy requirements (Info.plist usage descriptions, App Tracking Transparency)
- In-app purchase requirements, data safety, and encryption export compliance
- Flutter best practices, widget lifecycle, state management patterns
- Common security vulnerabilities in mobile apps (OWASP Mobile Top 10)
- Performance optimization and dependency management

Analyze the provided Flutter project evidence and produce a comprehensive audit report covering both App Store compliance and code quality.

EVIDENCE FORMAT:
- "PUBSPEC_METADATA": App name, version, and list of pub.dev package dependencies
- "INFO_PLIST_PERMISSIONS": NS*UsageDescription keys and their values from Info.plist
- "DART_SKELETONS": Architectural skeleton of Dart files
${APP_STORE_CATEGORIES}
${APP_CODE_CATEGORIES}
${RESPONSE_FORMAT}`;

// ── Package prompts ──

const PKG_STORE_CATEGORIES = `
AUDIT CATEGORIES (evaluate each):
1. PLATFORM DECLARATIONS — Do declared platforms in pubspec match actual platform channel implementations? Are MethodChannel names consistent? Missing platforms?
2. CONSUMER PERMISSIONS GUIDANCE — Does the plugin use sensitive APIs (camera, location, contacts, etc.)? If so, are the required Info.plist keys documented for host apps?
3. LEGAL & COMPLIANCE — License clarity, export compliance signals (encryption), data handling implications for consuming apps?`;

const PKG_CODE_CATEGORIES = `
AUDIT CATEGORIES (evaluate each):
1. API SURFACE & DOCUMENTATION — Is the public API clean and well-structured? Are exported symbols intentional? Clear entry point?
2. DEPENDENCY HYGIENE — Are dependency constraints appropriate? Any problematic or heavy transitive dependencies? Should any deps be dev_dependencies?
3. SECURITY — Hardcoded API keys, insecure HTTP calls, unsafe platform channel data handling?
4. COMPATIBILITY & VERSIONING — Dart SDK constraints, Flutter SDK constraints, breaking change risks, deprecated API usage?
5. EXAMPLE APP QUALITY — Does the example/ app exist and demonstrate key features? Is it a good integration test?
6. FLUTTER-SPECIFIC — Proper dispose/lifecycle handling, memory leak risks, platform channel error handling, null safety compliance?`;

const PKG_STORE_PROMPT = `You are an experienced Flutter plugin reviewer focused on compliance and platform integration. You have deep knowledge of:

- Flutter plugin architecture (platform channels, federated plugins)
- iOS platform integration requirements for Flutter plugins
- Privacy and permission implications for consuming apps
- Apple App Store Review Guidelines as they affect plugins

Focus ONLY on Apple App Store compliance and consumer-facing requirements — not code quality.

EVIDENCE FORMAT:
- "PUBSPEC_METADATA": Package name, version, description, dependencies
- "PLUGIN_PLATFORMS": Supported platforms and native integration classes
- "DART_SKELETONS": Architectural skeleton of Dart files
- "EXAMPLE_APP" (if present): Skeleton of the example/ app
${PKG_STORE_CATEGORIES}
${RESPONSE_FORMAT}`;

const PKG_CODE_PROMPT = `You are a senior Flutter/Dart package engineer conducting a code quality review. You have deep knowledge of:

- pub.dev scoring criteria (documentation, API design, maintenance, platform support)
- Dart package best practices (semantic versioning, dependency constraints, export hygiene)
- Flutter plugin architecture and platform channel patterns
- Performance and memory management in plugins

Focus ONLY on code quality, API design, and engineering best practices — not store compliance.

EVIDENCE FORMAT:
- "PUBSPEC_METADATA": Package name, version, description, dependencies
- "PLUGIN_PLATFORMS": Supported platforms and native integration classes
- "DART_SKELETONS": Architectural skeleton of Dart files
- "EXAMPLE_APP" (if present): Skeleton of the example/ app
${PKG_CODE_CATEGORIES}
${RESPONSE_FORMAT}`;

const PKG_BOTH_PROMPT = `You are an experienced Flutter/Dart package reviewer and pub.dev quality auditor. You have deep knowledge of:

- Flutter plugin architecture (platform channels, federated plugins, platform interface patterns)
- pub.dev scoring criteria (documentation, API design, maintenance, platform support)
- Dart package best practices (semantic versioning, dependency constraints, export hygiene)
- iOS platform integration requirements
- Privacy and permission implications for consuming apps

Analyze the provided Flutter package/plugin evidence and produce a comprehensive audit report.

EVIDENCE FORMAT:
- "PUBSPEC_METADATA": Package name, version, description, dependencies
- "PLUGIN_PLATFORMS": Supported platforms and native integration classes
- "DART_SKELETONS": Architectural skeleton of Dart files
- "EXAMPLE_APP" (if present): Skeleton of the example/ app
${PKG_STORE_CATEGORIES}
${PKG_CODE_CATEGORIES}
${RESPONSE_FORMAT}`;

// ── Prompt selection ──

const PROMPTS = {
  app:     { store: APP_STORE_PROMPT, code: APP_CODE_PROMPT, both: APP_BOTH_PROMPT },
  package: { store: PKG_STORE_PROMPT, code: PKG_CODE_PROMPT, both: PKG_BOTH_PROMPT },
};

function selectPrompt(projectType, mode) {
  return PROMPTS[projectType]?.[mode] || PROMPTS.app.both;
}

// ── Message builder ──

function buildUserMessage({ files, exampleFiles, permissions, pubspec, plistFound, projectType, guidelines }) {
  const sections = [];
  const isPackage = projectType === 'package';

  // Inject live guidelines as grounding context (store & both modes)
  if (guidelines?.content) {
    sections.push('=== APPLE_APP_STORE_GUIDELINES ===');
    sections.push(`(Live from developer.apple.com, fetched ${guidelines.fetchedAt?.split('T')[0] || 'unknown'})`);
    sections.push(guidelines.content);
  }

  sections.push('\n=== PUBSPEC_METADATA ===');
  sections.push(`${isPackage ? 'Package' : 'App'}: ${pubspec.name}${pubspec.version ? ` v${pubspec.version}` : ''}`);
  if (pubspec.description) {
    sections.push(`Description: ${pubspec.description}`);
  }
  sections.push(`Dependencies: ${pubspec.dependencies.join(', ') || '(none)'}`);
  sections.push(`Dev Dependencies: ${pubspec.devDependencies.join(', ') || '(none)'}`);

  if (isPackage && pubspec.pluginPlatforms) {
    sections.push('\n=== PLUGIN_PLATFORMS ===');
    for (const [platform, config] of Object.entries(pubspec.pluginPlatforms)) {
      sections.push(`${platform}: ${JSON.stringify(config)}`);
    }
  }

  if (!isPackage) {
    sections.push('\n=== INFO_PLIST_PERMISSIONS ===');
    if (!plistFound) {
      sections.push('Info.plist NOT FOUND at ios/Runner/Info.plist');
    } else if (Object.keys(permissions).length === 0) {
      sections.push('No NS*UsageDescription keys found in Info.plist.');
    } else {
      for (const [key, value] of Object.entries(permissions)) {
        sections.push(`${key}: "${value}"`);
      }
    }
  }

  sections.push('\n=== DART_SKELETONS ===');
  for (const file of files) {
    sections.push(`\n--- ${file.relativePath} ---`);
    sections.push(file.skeleton);
  }

  if (exampleFiles && exampleFiles.length > 0) {
    sections.push('\n=== EXAMPLE_APP ===');
    for (const file of exampleFiles) {
      sections.push(`\n--- example/${file.relativePath} ---`);
      sections.push(file.skeleton);
    }
  } else if (isPackage) {
    sections.push('\n=== EXAMPLE_APP ===');
    sections.push('No example/ app found in this package.');
  }

  return sections.join('\n');
}

// ── API callers ──

async function callGemini(userMessage, { apiKey, model, systemPrompt }) {
  const url = `${GEMINI_API_URL}/${model}:generateContent`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    if (res.status === 400 && errBody.includes('API_KEY')) {
      throw new Error('Invalid API key. Check your Gemini API key and try again.');
    }
    throw new Error(`Gemini API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const reason = data.candidates?.[0]?.finishReason;
    throw new Error(`Gemini returned an empty response${reason ? ` (reason: ${reason})` : ''}`);
  }

  const usage = data.usageMetadata || {};
  return {
    text,
    tokens: {
      input: usage.promptTokenCount || null,
      output: usage.candidatesTokenCount || null,
      total: usage.totalTokenCount || null,
    },
  };
}

async function callClaude(userMessage, { apiKey, model, systemPrompt }) {
  const body = {
    model,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    temperature: 0.2,
  };

  const res = await fetch(CLAUDE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    if (res.status === 401) {
      throw new Error('Invalid API key. Check your Anthropic API key and try again.');
    }
    throw new Error(`Claude API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text;

  if (!text) {
    throw new Error(`Claude returned an empty response (stop_reason: ${data.stop_reason || 'unknown'})`);
  }

  const usage = data.usage || {};
  return {
    text,
    tokens: {
      input: usage.input_tokens || null,
      output: usage.output_tokens || null,
      total: (usage.input_tokens || 0) + (usage.output_tokens || 0) || null,
    },
  };
}

// ── Main audit function ──

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

export async function audit(evidence, { apiKey, model, provider, mode }) {
  const systemPrompt = selectPrompt(evidence.projectType, mode);
  const userMessage = buildUserMessage(evidence);

  const estimated = {
    system: estimateTokens(systemPrompt),
    user: estimateTokens(userMessage),
    total: estimateTokens(systemPrompt) + estimateTokens(userMessage),
  };

  const response = provider === 'claude'
    ? await callClaude(userMessage, { apiKey, model, systemPrompt })
    : await callGemini(userMessage, { apiKey, model, systemPrompt });

  const cleaned = response.text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  try {
    const result = JSON.parse(cleaned);
    result._tokens = {
      estimated,
      actual: response.tokens,
    };
    return result;
  } catch {
    throw new Error(`Failed to parse AI response as JSON. Raw output:\n${response.text.slice(0, 500)}`);
  }
}
