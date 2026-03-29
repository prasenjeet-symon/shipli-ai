# React Native App Store Review Guidelines

Source: Apple's App Store Review Guidelines + Google Play Developer Program Policies (React Native specific)

# Apple App Store Review Guidelines — React Native Specific

## React Native Specific Rejections (Common)

React Native apps face specific rejection patterns that differ from native apps:

### 1. WebView-only Apps (4.2)
- Apps that are primarily web content wrapped in WebView may be rejected
- Must have substantial native functionality beyond just displaying web pages
- JS bundle must contain real native interactions, not just `WebView.loadURL()`

### 2. Missing Localized Info.plist Entries
- `CFBundleDisplayName` must be localized for all supported languages
- `NSAppTransportSecurity` exceptions must be justified
- Privacy manifests (`PrivacyInfo.xcprivacy`) required for iOS 17+

### 3. Inadequate Background Mode Justification
- Apps using background fetch, remote notifications, etc. must justify need
- `UIBackgroundModes` in Info.plist must match actual usage

### 4. Third-Party Payment (3.1.1)
- React Native apps using Stripe, Braintree, etc. for digital goods/services face rejection
- Must use StoreKit for iOS in-app purchases
- Common rejection: "App uses `[stripe/react-native-payments]` for in-app purchases"

### 5. Private API Usage
- Some React Native bridges access private APIs
- Apps may be rejected for using non-public APIs
- Common issue: JS-to-native bridges that access restricted functionality

### 6. JavaScriptCore Configuration
- Apps must not modify JavaScriptCore behavior in ways that bypass App Review
- `WKWebView` configuration must be appropriate for the app's use case

## Required Info.plist Entries for React Native Apps

```
NSLocationWhenInUseUsageDescription — "This app uses your location to [specific reason]"
NSCameraUsageDescription — "This app uses the camera to [specific reason]"
NSPhotoLibraryUsageDescription — "This app accesses your photos to [specific reason]"
NSMicrophoneUsageDescription — "This app records audio to [specific reason]"
NSContactsUsageDescription — "This app accesses your contacts to [specific reason]"
NSBluetoothAlwaysUsageDescription — "This app uses Bluetooth to [specific reason]"
NSCalendarsUsageDescription — "This app accesses your calendar to [specific reason]"
NSRemindersUsageDescription — "This app creates reminders to [specific reason]"
NSFaceIDUsageDescription — "This app uses Face ID to [specific reason]"
```

## Google Play Store — React Native Specific Issues

### 1. CleverTap / Firebase Configuration
- Must declare all Firebase/analytics dependencies in Privacy Policy
- Data Safety form must match actual data collection

### 2. Background Services
- React Native's background tasks must be declared
- WorkManager configuration must be explicit

### 3. Amazon Appstore Specific
- React Native apps sometimes miss Amazon-specific requirements
- In-app purchasing requires Amazon Appstore SDK if not using Google Play

## React Native Security Considerations

### 1. Secure Storage
- `AsyncStorage` stores data in plaintext — sensitive data needs `react-native-keychain` or `expo-secure-store`
- Check for `AsyncStorage.setItem()` with sensitive keys

### 2. Certificate Pinning
- React Native apps using `fetch` without certificate pinning are vulnerable to MITM
- Should use `react-native-ssl-pinning` or similar for production apps handling sensitive data

### 3. Deep Linking Security
- React Native's deep linking must validate URLs to prevent phishing
- `Linking.openURL()` should validate URL schemes

### 4. JavaScript Bundle Security
- JS bundle is bundled in the app — cannot be considered secure
- Sensitive logic should remain on server-side
- Check for hardcoded API keys in JS bundle (they're easily extracted)

### 5. WebView Security
- `WebView` component must have `originWhitelist` properly configured
- JavaScript interfaces to WebView must not expose sensitive native APIs

## React Native Performance Requirements

### 1. Startup Time
- Apps should not block main thread during startup
- Heavy initialization should use `InteractionManager` or async patterns

### 2. Memory Management
- FlatList virtualization must be used for lists
- Images must be properly sized and cached (use `react-native-fast-image`)

### 3. Hermes Engine
- New architecture apps using Hermes should verify bundle is properly compiled

## Expo-Specific Considerations

### 1. Development Builds
- Apps using Expo must have `ios/*.xcworkspace` for production
- Cannot submit `expo` CLI projects directly to stores

### 2. EAS Build
- Must use `eas build` for production iOS builds
- Development builds are not App Store Connect compatible

### 3. Expo SDK Permissions
- All Expo permissions must be declared in `app.json`/`app.config.js`
- Must use `expo-modules-core` permission hooks
