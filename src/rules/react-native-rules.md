# React Native App Store Compliance Guidelines

## Overview

This guide covers React Native-specific considerations for App Store and Play Store compliance.

---

## iOS App Store (React Native)

### 1. Permissions & Privacy

React Native apps must declare all permissions in `Info.plist`:

```xml
<!-- Required permissions must have clear usage descriptions -->
<key>NSCameraUsageDescription</key>
<string>This app needs camera access to [specific purpose]</string>

<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs location to [specific purpose]</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>This app needs photo library access to [specific purpose]</string>
```

**Common React Native Permission Libraries:**
- `react-native-permissions` - Requires individual permission pods
- `expo-image-picker`, `expo-camera`, `expo-location` - Expo managed permissions

**Apple Review Checklist:**
- [ ] Every permission has a specific, user-facing usage description
- [ ] No unused permissions declared
- [ ] App Tracking Transparency (ATT) implemented if tracking is used
- [ ] Privacy policy URL provided in App Store Connect

### 2. In-App Purchases

**MUST use Apple's StoreKit for digital goods:**

```javascript
// ACCEPTABLE: Using react-native-iap (wraps StoreKit)
import { useIAP } from 'react-native-iap';

// UNACCEPTABLE: Third-party payment for digital goods
// ❌ Stripe, PayPal, etc. for in-app digital purchases
```

**Allowed Third-Party Payments:**
- Physical goods delivery
- Real-world services (rides, food delivery)
- Cross-platform subscriptions with reader apps

### 3. Forbidden Patterns

Apple **rejects** apps with:

- **Code Push / OTA Updates** (except Expo updates for content/assets only)
- **Dynamic code execution**
- **JavaScript bundle replacement** that changes app behavior

```javascript
// ❌ FORBIDDEN: CodePush that modifies app logic
import CodePush from 'react-native-code-push';

// ✅ ACCEPTABLE: Expo Updates for asset/content only (with proper disclosure)
```

### 4. Performance & Stability

React Native apps must meet minimum functionality:
- No crashes on launch
- No infinite loading states
- Proper error boundaries implemented
- Native modules properly linked

**Required:**
```javascript
// Implement error boundaries
class ErrorBoundary extends React.Component {
  componentDidCatch(error, errorInfo) {
    // Log to error tracking service
  }
}
```

### 5. App Transport Security (ATS)

All network requests must use HTTPS:

```xml
<!-- Info.plist -->
<key>NSAppTransportSecurity</key>
<dict>
  <key>NSAllowsArbitraryLoads</key>
  <false/>
</dict>
```

---

## Google Play Store (React Native)

### 1. Permissions

Declare only necessary permissions in `AndroidManifest.xml`:

```xml
<!-- Only request permissions your app actually uses -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
```

**Google Play Data Safety Requirements:**
- Declare all data collected
- Declare all data shared
- Declare all third-party SDKs that collect data

### 2. Google Play Billing

**Digital goods MUST use Google Play Billing Library:**

```javascript
// ✅ REQUIRED: Use react-native-iap for digital goods
import { useIAP } from 'react-native-iap';

// ❌ NOT ALLOWED: Other payment methods for digital goods
```

### 3. Target SDK Requirements

React Native apps must target current Android requirements:

```gradle
// android/build.gradle
ext {
    buildToolsVersion = "34.0.0"
    minSdkVersion = 23
    compileSdkVersion = 34
    targetSdkVersion = 34
}
```

### 4. WebView Considerations

Apps must not be "thin wrappers" around websites:

- WebView-only apps are rejected
- Must provide native functionality
- Cannot simply wrap a mobile website

```javascript
// ❌ AVOID: App that's just a WebView
<WebView source={{ uri: 'https://example.com' }} />

// ✅ BETTER: Hybrid with native components
<View>
  <NativeHeader />
  <WebView source={{ uri: 'https://example.com/content' }} />
  <NativeNavigationBar />
</View>
```

---

## React Native-Specific Rejection Reasons

### 1. Native Module Linking Issues

Ensure all native modules are properly linked:

```bash
# iOS
cd ios && pod install

# Android
# Check that native modules are auto-linked
```

### 2. Hermes Engine Issues

If using Hermes, ensure:
- Bundle is properly compiled
- No runtime Hermes errors
- Debug features disabled in production

### 3. Expo-Specific Considerations

For Expo apps:
- `expo-updates` for OTA content (disclose in review notes)
- `expo-dev-client` allowed for development
- Custom native code requires EAS Build or bare workflow

### 4. Push Notifications

```javascript
// iOS: Must register for remote notifications
// Android: Must handle notification channels properly

// expo-notifications or @notifee/react-native
```

---

## Security Checklist

### Hardcoded Secrets

**NEVER commit:**
- API keys in source code
- AWS credentials
- Firebase service account keys
- Private keys

```javascript
// ❌ AVOID
const API_KEY = "sk-live-abc123...";

// ✅ USE
const API_KEY = process.env.EXPO_PUBLIC_API_KEY;
// Or use secure storage / backend proxy
```

### Sensitive Data Handling

- Use `expo-secure-store` or `react-native-keychain` for tokens
- Never log sensitive data
- Clear sensitive data on logout
- Implement proper session timeout

### Network Security

- Always use HTTPS
- Implement certificate pinning for sensitive APIs
- Validate SSL certificates
- Use authenticated API endpoints

---

## Common React Native Dependencies & Compliance

### Navigation
- `@react-navigation/native` - ✅ No issues
- `expo-router` - ✅ No issues
- `react-native-navigation` - ✅ No issues

### State Management
- All major libraries (Redux, MobX, Zustand) - ✅ No issues

### Networking
- `axios`, `fetch` - ✅ Use HTTPS only
- `react-query` - ✅ No issues

### Auth
- `@react-native-google-signin` - ✅ Proper OAuth
- `react-native-firebase` - ✅ Use for auth
- `expo-auth-session` - ✅ OAuth handling

### Payments
- `react-native-iap` - ✅ Use for digital goods
- `@stripe/stripe-react-native` - ⚠️ Only for physical goods/tips
- `react-native-paypal` - ⚠️ Only for physical goods

### Maps & Location
- `react-native-maps` - ✅ Requires location permission
- `expo-location` - ✅ Requires permission disclosure

### Camera & Media
- `react-native-camera`, `expo-camera` - ✅ Requires permission
- `react-native-image-picker`, `expo-image-picker` - ✅ Requires permission

---

## Pre-Submission Checklist

### iOS
- [ ] All Info.plist permissions have clear usage strings
- [ ] App Transport Security configured for HTTPS
- [ ] StoreKit used for digital purchases
- [ ] No CodePush that modifies app behavior
- [ ] Privacy policy URL valid
- [ ] App icons and launch screens configured
- [ ] No hardcoded secrets
- [ ] Error boundaries implemented

### Android
- [ ] All permissions declared in AndroidManifest.xml
- [ ] Google Play Billing for digital goods
- [ ] Target SDK meets Play Store requirements
- [ ] Data Safety form completed accurately
- [ ] No WebView-only content
- [ ] Privacy policy URL valid
- [ ] App signed with release keystore
- [ ] No hardcoded secrets

---

## Resources

- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [Google Play Developer Policy Center](https://play.google.com/about/developer-content-policy/)
- [React Native Official Docs](https://reactnative.dev/docs/getting-started)
- [Expo Submission Guide](https://docs.expo.dev/submit/introduction/)