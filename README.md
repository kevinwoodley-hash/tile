# TileIQ Pro — Native App Setup

Stack: Capacitor 6 · EAS Build (cloud iOS + Android) · No Mac required

---

## Prerequisites

Install once on your Chromebook (Linux Beta terminal):

```bash
# Node.js (if not already installed)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# EAS CLI (global)
npm install -g @expo/eas-cli

# Capacitor CLI (global)
npm install -g @capacitor/cli
```

---

## Step 1 — Install dependencies

```bash
cd tileiq-native
npm install
```

---

## Step 2 — Add native platforms

```bash
npx cap add android
npx cap add ios
```

This creates `android/` and `ios/` folders. They are gitignored — EAS Build regenerates them.

---

## Step 3 — Sync web files

Every time you update `www/` (index.html, script.js, style.css):

```bash
npx cap sync
```

---

## Step 4 — EAS account + project

```bash
eas login           # create account at expo.dev if needed
eas project:init    # creates EAS project, gives you a project ID
```

Copy the project ID into `app.json` → `extra.eas.projectId`.

---

## Step 5 — App icons & splash screen

Create an `assets/` folder with:

| File | Size | Notes |
|------|------|-------|
| `icon.png` | 1024×1024px | No transparency (iOS requirement) |
| `splash.png` | 2732×2732px | Centred logo on #1C1C1E background |
| `adaptive-icon.png` | 1024×1024px | Android foreground layer |

Suggested design: white ⬛ tile icon on dark background with amber TileIQ wordmark.

---

## Step 6 — Build (cloud, no Mac needed)

### Preview APK (Android, test on device):
```bash
eas build --platform android --profile preview
```
Downloads an `.apk` you can sideload on any Android device.

### Production Android (Play Store .aab):
```bash
eas build --platform android --profile production
```

### Production iOS (App Store .ipa — EAS runs macOS in cloud):
```bash
eas build --platform ios --profile production
```
EAS will prompt you to log in with your Apple ID and handle signing automatically.

---

## Step 7 — Submit to stores

### App Store:
```bash
eas submit --platform ios
```
Fill in your Apple ID, App Store Connect App ID, and Team ID in `eas.json` first.

### Google Play:
1. Create app in Google Play Console
2. Download a Service Account JSON key
3. Save as `google-play-service-account.json` (gitignored)
4. Run: `eas submit --platform android`

---

## Ongoing workflow

```
Edit www/ files
    ↓
npx cap sync
    ↓
eas build --platform android --profile preview   ← test
    ↓
eas build --platform all --profile production    ← release
```

---

## Required store registrations

| Account | Cost | Link |
|---------|------|------|
| Apple Developer Program | £79/year | developer.apple.com/programs |
| Google Play Console | £17 one-off | play.google.com/console |
| EAS Build (free tier) | £0/mo | 30 builds/month included |

---

## Notes

- The `android/` and `ios/` folders are **gitignored** — EAS builds from source every time
- Supabase auth redirect URLs need your app scheme added: `com.tileiq.pro://`
  - Supabase Dashboard → Authentication → URL Configuration → add `com.tileiq.pro://`
- iOS builds require an Apple Developer account but **not a Mac** — EAS handles it
- First App Store submission takes 1–7 days for review
