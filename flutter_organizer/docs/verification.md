# Verification · 3 September 2026

The implementation was checked with Flutter 3.47.2 / Dart 3.13.2.

- `flutter analyze`: no issues.
- `flutter test`: 10 passing tests (session/API behavior and widget layouts).
- `vitest run test/api/mobile`: 19 passing backend tests.
- TypeScript `tsc --noEmit --incremental false`: passed.
- ESLint on the changed backend files/tests: passed.
- iOS Info.plist and Keychain entitlement plist validation: passed.
- Phone (375×812) and landscape (812×375) widget tests at 1.8× text size: passed.
- [Overview preview](preview-overview.png) and [events preview](preview-events.png)
  were rendered from Flutter widgets with explicitly synthetic sample data and
  visually inspected. Additional previews cover orders, payments, scanning, sign-in, and dark mode. These are previews, not live account screenshots.

The SDK was downloaded to `/private/tmp/ticketpulse-flutter-sdk` for verification;
it is not installed permanently on the user's PATH.

The iOS build attempt returned `Application not configured for iOS` in this
machine's environment. `flutter doctor -v` confirms a missing full Xcode
installation and missing CocoaPods; only Apple Command Line Tools are selected.
The generated iOS runner, permissions, and Keychain entitlements are included.

No authenticated live-backend test or physical-device camera check was performed.
The new backend routes must be deployed alongside the app before using a remote
API origin. Release signing, store metadata, and device testing remain release tasks.

## Android build

`flutter build apk --debug --dart-define=API_BASE_URL=https://ticketpulse.tech`
completed successfully and produced `build/app/outputs/flutter-apk/app-debug.apk`.
This is a development APK, not a signed store release.

The first attempt with secure-storage 11.0.0 failed because that package required
an Android 37 target unavailable under the expected SDK target name. The app now
uses secure-storage 10.3.1 (locked in `pubspec.lock`), compatible with Android 36
and using the maintained secure-storage 10.x API. Required Android NDK, platform,
build-tools, and CMake components were installed by Gradle during verification.
Flutter reports a future compatibility warning for mobile_scanner's Kotlin
Gradle plugin; it does not prevent the current build.

The final UI uses the actual project logo on light/dark surfaces and in native
launcher icons. Its SVG artwork/colors are preserved. All six screens were
rendered, plus the dashboard in dark mode, and visually inspected after the
navy/orange redesign. No AI-generated branding is used.
