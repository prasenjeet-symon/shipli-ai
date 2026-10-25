# React Native Engineering Review Guidelines

These RN rule IDs identify engineering checks, not Apple or Google store-policy clauses.
For a store finding, cite the applicable store policy separately and explain the observed behavior.
Apply checks to the project's installed React Native, React, Expo SDK and navigation versions and selected platforms.
Shipli supplies selected, potentially truncated JS/JSX/TS/TSX excerpts and configuration, not a complete program.
Never infer missing cleanup, validation, providers, native configuration or error handling from omitted code.
Report only evidenced defects: include the RN rule ID, file, visible code, concrete impact and a targeted fix.
If a required file, generated value, wrapper or runtime behavior is unavailable, state the verification limit instead of inventing a violation.
Treat performance recommendations as conditional advice unless a costly path or measurement supports a defect; do not prescribe a particular state library.

## Navigation and deep links

### RN-001: Handle both initial and running-app links
- Check that implemented deep linking maps supported paths and parameters for cold starts and links received while running; React Navigation's linking integration can handle both.
- Evidence: compare visible link configuration and handlers with the target route. Expo Router or another integration may supply this automatically; do not demand duplicate manual listeners.
- Reference: [React Navigation deep linking](https://reactnavigation.org/docs/deep-linking/).

### RN-002: Treat incoming links as untrusted input
- Check visible handling of schemes, hosts, paths and parameter types before links select privileged actions; reject unsupported destinations and avoid placing authentication tokens in custom-scheme URLs.
- Evidence: identify the actual input-to-action path. A link prefix is routing configuration, not proof of authorization; do not assume unseen backend checks are absent.
- Reference: [React Native security](https://reactnative.dev/docs/security).

### RN-003: Preserve navigation state and authentication boundaries
- Check that logout/auth changes remove access to protected screens and that restoration, Back and deep links cannot revive stale authenticated UI; use conditional screens or equivalent state handling.
- Evidence: show the reachable stale screen or invalid transition from the supplied navigator/auth code; screen visibility alone does not establish a server authorization vulnerability.
- Reference: [React Navigation authentication flows](https://reactnavigation.org/docs/auth-flow/).

### RN-004: Keep route parameters suitable for persistence and linking
- Check for functions, cyclic objects or full mutable records in route params when navigation persistence or URL serialization is used; prefer stable identifiers and shared data ownership.
- Evidence: explain the concrete serialization failure or stale-data duplication. Do not label every object parameter invalid; JSON-serializable parameters are supported.
- Reference: [React Navigation route parameters](https://reactnavigation.org/docs/params/).

## State, hooks and lifecycle

### RN-005: Keep Hook calls valid and state updates coherent
- Check ordinary Hooks for conditional/loop calls, calls after conditional returns, or calls outside components/custom Hooks; account for version-specific APIs such as React's special `use` API.
- Check visible direct state mutation and stale captured updates; use immutable changes and functional setters when the next value depends on pending state. Allow libraries that safely implement draft mutation.
- References: [Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks), [useState](https://react.dev/reference/react/useState), [updating objects](https://react.dev/learn/updating-objects-in-state).

### RN-006: Match effect dependencies to reactive inputs
- Check effects and callbacks for demonstrable stale closures, repeated subscriptions or update loops caused by their dependency lists; compare actual captured reactive values with intended lifetime.
- Evidence: identify the changed input and failing behavior. Stable setters, refs and supported non-reactive mechanisms need not be added blindly; an empty dependency array is not itself a defect.
- Reference: [React useEffect](https://react.dev/reference/react/useEffect).

### RN-007: Pair resource acquisition with lifecycle cleanup
- Check visible timers, subscriptions, AppState/Linking listeners and sockets for appropriate disposal; cancel or ignore obsolete async results to prevent older requests overwriting newer state.
- Evidence: inspect the complete owning effect/hook or wrapper before asserting missing cleanup. A truncated excerpt, an awaited Promise or a finite request alone does not prove a leak.
- Reference: [React effect cleanup and async effects](https://react.dev/reference/react/useEffect).

### RN-008: Distinguish screen focus from component mounting
- Check focus-only camera, polling and event work against navigation lifecycle; screens can remain mounted when another screen is shown, so use focus-aware cleanup where needed.
- Evidence: identify an activity that must stop on blur and its visible lifetime. `useFocusEffect` cleanup also runs on dependency changes and unmount; do not require every screen effect to use it.
- References: [Navigation lifecycle](https://reactnavigation.org/docs/navigation-lifecycle/), [useFocusEffect](https://reactnavigation.org/docs/use-focus-effect/).

## Native modules and platform behavior

### RN-009: Match native contracts to the installed architecture
- Check custom native-module calls against their typed specs, registration/Codegen configuration, supported platforms and installed RN version; verify dependency support for the project's New Architecture configuration.
- Evidence: cite the actual contract or documented incompatibility. A legacy-module import alone does not prove breakage, and a package name alone does not establish compatibility or a mandatory migration.
- References: [Turbo Native Modules](https://reactnative.dev/docs/turbo-native-modules-introduction), [Expo New Architecture compatibility](https://docs.expo.dev/guides/new-architecture/).

### RN-010: Release stateful native resources when their owner ends
- Check custom modules that hold observers, native handles or ongoing work for appropriate teardown when a React Native instance is destroyed or recreated; match initialization and invalidation to the supported API.
- Evidence: require the relevant native implementation or an explicit lifecycle contract. Do not infer absent native cleanup from JS-only collection, or demand teardown on each component unmount for an app-lifetime module.
- Reference: [Native module lifecycle, RN 0.80 example; verify target version](https://reactnative.dev/docs/0.80/the-new-architecture/native-modules-lifecycle).

### RN-011: Respect platform-specific implementations
- Check platform-only APIs and behavior through `Platform.OS`, `Platform.select` and `.ios`/`.android`/`.native` files; ensure the selected platform has a supported implementation or deliberate fallback.
- Evidence: identify an unsupported call reachable on the affected target. A missing implementation in one excerpt is not evidence that its platform sibling or package implementation is absent.
- Reference: [React Native platform-specific code](https://reactnative.dev/docs/platform-specific-code).

## JavaScript-thread and list performance

### RN-012: Keep expensive work out of interaction-critical paths
- Check unbounded computation, repeated large serialization and high-volume logging during renders, gestures or navigation; reduce work, schedule it appropriately or use a suitable native/background implementation.
- Evidence: name the costly operation and expected scale; confirm with release-build profiling before claiming measured frame drops. Async syntax does not move synchronous work off the JS thread.
- Reference: [React Native performance](https://reactnative.dev/docs/performance).

### RN-013: Preserve list virtualization and item identity
- Check large or unbounded lists rendered eagerly for a virtualized alternative such as FlatList/SectionList; ensure stable item identity when items reorder, insert or delete.
- Check immutable list inputs and external render dependencies, using `extraData` when other props do not change. Do not demand it when changed props already trigger the required render.
- Reference: [React Native FlatList](https://reactnative.dev/docs/flatlist).

### RN-014: Tune list layout only with valid size assumptions
- Check incorrect `getItemLayout` lengths/offsets, including separators, and scroll-to-index usage outside the render window; recommend layout hints only when dimensions are known reliably.
- Evidence: connect an actual dimension mismatch or expensive list path to the issue. Missing memoization, inline render callbacks or default window sizes are not automatic defects; measure tradeoffs.
- Reference: [FlatList layout and scrolling](https://reactnative.dev/docs/flatlist#getitemlayout).

## Security, storage and networking

### RN-015: Keep secrets out of bundles and logs
- Check embedded privileged credentials, client-bundled environment variables and sensitive data sent to logs/telemetry; move server secrets behind a backend and redact sensitive output.
- Evidence: distinguish public configuration from credentials and show exposure. Do not reproduce a secret value in the report.
- Reference: [React Native security](https://reactnative.dev/docs/security).

### RN-016: Use storage appropriate to data sensitivity
- Check tokens/secrets written to unencrypted AsyncStorage or broadly persisted state; prefer a platform-backed secure store and handle unavailable or invalidated credentials.
- Evidence: trace the sensitive value to persistence. For Expo SecureStore, inspect custom Android backup exclusions and avoid assuming secrets survive uninstall or biometric changes; defaults may already configure backup safely.
- References: [React Native storage security](https://reactnative.dev/docs/security), [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

### RN-017: Handle network failures and protect transport
- Check production cleartext requests, overly broad ATS/Android cleartext exceptions, rejected requests and invalid responses that strand loading state or crash a screen; preserve actionable failure/retry behavior.
- Evidence: trace the active production endpoint and visible error path. Local development URLs and narrow justified exceptions need context; native networking does not enforce browser CORS as an authorization boundary.
- Reference: [React Native networking](https://reactnative.dev/docs/network).

## Expo managed/CNG and bare/native configuration

### RN-018: Review the effective native configuration source
- In managed/CNG projects, inspect app config and config plugins; in bare/manually maintained projects, inspect native files and build configuration. Generated `ios/` and `android/` directories can legitimately be absent.
- Evidence: flag a demonstrated conflicting value or customization that Prebuild overwrites. Do not report missing native directories as a violation; dynamic app config and generated values require verification, not guessed defaults.
- Reference: [Expo Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/).

### RN-019: Align permission declarations and runtime behavior
- Compare visible sensitive API use, runtime permission handling and the effective build-time declarations/usage descriptions; handle denial or unavailable capability without crashing or repeatedly demanding access.
- Evidence: account for config plugins and library manifests that add permissions. Expo Go behavior does not verify standalone build configuration; confirm generated native outputs before asserting an absent declaration.
- Reference: [Expo permissions](https://docs.expo.dev/guides/permissions/).

### RN-020: Verify native dependencies in the actual build
- Check that native libraries and configuration changes are included in a rebuilt development/production binary; Expo Go's fixed native modules do not establish support for arbitrary installed packages.
- Evidence: report a known JS/native mismatch or documented unsupported module, rather than treating Expo dependency usage or the lack of committed native folders as an error.
- References: [Expo library compatibility](https://docs.expo.dev/workflow/using-libraries/), [development-build FAQ](https://docs.expo.dev/develop/development-builds/faq/).

### RN-021: Keep over-the-air updates compatible with native code
- For EAS Update or another OTA mechanism, check that an update requiring changed native modules/configuration targets a compatible binary/runtime; native changes require an appropriate rebuilt binary.
- Evidence: demonstrate the runtime mismatch. CodePush, Expo Updates or OTA dependencies are not automatically store violations; assess actual update behavior against the applicable store policy separately.
- Reference: [Expo runtime versions and updates](https://docs.expo.dev/eas-update/runtime-versions/).
