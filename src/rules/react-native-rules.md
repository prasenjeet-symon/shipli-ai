React Native Best Practices and Review Notes

This document contains a concise set of code-quality, security, and architecture guidelines
specific to React Native (JavaScript / TypeScript) projects to be used by Shipli's audit engine.

Key areas:

- Project structure and entry points
  - Ensure a single clear entry (e.g. `index.js` / `index.tsx`) and an App root component.
  - Keep native code minimal; prefer community packages only when well-maintained.

- Navigation
  - Prefer declarative navigation libraries (React Navigation, React Native Navigation).
  - Avoid deeply nested navigation stacks where data flow becomes unclear.
  - Test deep links and navigation param validation.

- State management
  - Use a single source of truth when appropriate (Redux, Recoil, MobX, Zustand, or React Context + hooks).
  - Avoid global mutable singletons; prefer immutable updates.
  - Keep heavy computation off the JS thread (use worker threads / native modules / interactors).

- Native modules and bridging
  - Validate Platform/Bridge usage and input validation across the JS/native boundary.
  - Sanitize and validate messages sent through NativeModules or EventEmitters.
  - Document required native permissions and host app integration steps.

- Performance
  - Avoid large synchronous work on the JS thread; move to native or background tasks.
  - Use PureComponent, React.memo, and proper keying to avoid unnecessary re-renders.
  - Optimize images, avoid large base64 blobs in memory, and use appropriate caching.

- Security & Privacy
  - Do not hardcode secrets in source; prefer secure storage (Keychain / Keystore) for runtime secrets.
  - Validate network calls use HTTPS and certificate pinning when required.
  - Be explicit about permissions and why they are needed in the app's privacy policy.

- Common risky patterns
  - Dynamic eval()/new Function(), remote code loading, or fetching JS bundles at runtime.
  - Excessive use of WebView wrapping user data without sandboxing.
  - Incorrect use of permissions (requesting more than necessary).

References:
- React Native docs: https://reactnative.dev/
- React Navigation: https://reactnavigation.org/
- OWASP Mobile Top 10
