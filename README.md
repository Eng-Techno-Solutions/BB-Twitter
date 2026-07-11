# BB Twitter

An **X (Twitter) client for the BlackBerry Q20** — a physical-keyboard, D-pad phone running Android 4.3 — built with React Native 0.53.3. The same codebase also runs in the browser via react-native-web.

It talks to X's internal web endpoints directly from the device: no backend server, no OAuth app registration, no Firebase. You sign in with your own session and the app behaves as a lightweight X reader/poster tuned for a 720×720 screen and a hardware keyboard.

> BB Twitter is a sibling of **BBSlack**. The hard-won platform layer (native TLS 1.2 HTTP bridge, hardware-key bridging, D-pad focus, background notification service, manual navigation, class components on RN 0.53.3) is reused verbatim; only the domain layer is rewritten for X. The full decision log lives in [`PROCESS.md`](./PROCESS.md).

---

## Features

- **Timelines** — Home (For You / Following), user profiles, search, bookmarks
- **Tweet actions** — like, retweet/quote, reply, with optimistic UI that reverts on failure
- **Compose** — new tweets, replies, quotes, with image attach (Android)
- **Direct Messages** — inbox (trusted + message requests) and conversations
- **Notifications** — mentions/likes/follows feed with an unread badge on the tab bar
- **Multi-account** — sign in to several accounts and switch between them
- **Media** — inline images and video, full-screen media viewer
- **Background notifications (Android)** — a native poll service posts system notifications while the app is closed, surviving a swipe-from-recents
- **Dark / light theme** and adjustable font size (small / medium / large)
- **Hardware keyboard + D-pad** navigation for the Q20

## Screenshots

| Home timeline | Notifications | Messages |
| :---: | :---: | :---: |
| ![Home timeline — For You / Following tabs](screenshots/Screen%20Shot%202026-07-11%20at%2017.12.49.png) | ![Notifications feed](screenshots/Screen%20Shot%202026-07-11%20at%2017.13.11.png) | ![Direct message inbox](screenshots/Screen%20Shot%202026-07-11%20at%2017.13.46.png) |
| **Profile** | **Compose** | **Repost / Quote** |
| ![User profile](screenshots/Screen%20Shot%202026-07-11%20at%2017.13.51.png) | ![Compose a tweet](screenshots/Screen%20Shot%202026-07-11%20at%2017.13.56.png) | ![Repost or quote menu](screenshots/Screen%20Shot%202026-07-11%20at%2017.14.03.png) |

<p align="center">
  <img src="screenshots/Screen%20Shot%202026-07-11%20at%2017.14.06.png" alt="Quote compose with embedded tweet" width="320" />
  <br/>
  <em>Quoting a tweet — the original renders inline below the composer.</em>
</p>

## Platforms

| Target      | How it runs                                              |
| ----------- | ------------------------------------------------------- |
| **Android** | BlackBerry Q20 (Android 4.3). Native `HttpModule` bridge with forced TLS 1.2, native background poll service, hardware key events. |
| **Web**     | react-native-web via react-scripts. A dev proxy (`src/setupProxy.js`) forwards X's API to dodge CORS. |

Both share one code path; platform differences resolve through `.android.tsx` / `.web.tsx` file suffixes.

## Tech Stack

- **React Native** 0.53.3, **React** 16.14.0 — **class components only**, no hooks
- **TypeScript** (`strict: true`, `strictNullChecks: false`)
- **No navigation library** — manual stack in `App.tsx`
- **No state library** — App owns global state, drills props to screens
- **ESLint** (flat config) + **Prettier** + **Husky** / lint-staged pre-commit
- Android build: Gradle, `minSdk 16` / `compile+target 28` / build-tools `30.0.3`, **Java 8 (temurin-8)**

---

## Getting Started

### Prerequisites

- Node.js + npm
- For Android: Android SDK, a connected Q20 (or emulator), and **Java 8** (`temurin-8`) for release builds
- An X account (you sign in with a session — see [Authentication](#authentication))

### Install

```bash
npm install
```

### Run on Web

```bash
npm run web
```

Starts the react-scripts dev server. The proxy in `src/setupProxy.js` routes `/x-gql`, `/x-v11`, `/x-v2`, and `/x-upload` to X's real hosts.

### Run on Android

```bash
npm start        # start the Metro bundler (in one terminal)
npm run android  # build & install on the connected device (in another)
```

### Build a release APK

```bash
npm run build:android
```

Runs the Gradle release build under Java 8 and then verifies the bundle (`scripts/verify-release-bundle.js`).

---

## Authentication

X has no simple token endpoint, so there are two ways in:

1. **Session paste (reliable).** Log in to `x.com` in a browser, copy your `auth_token` and `ct0` cookie values (pasting the whole `Cookie` header works too — the app extracts them), and paste them into the Session tab. The app validates them via the GraphQL `Viewer` query.
2. **Username / password (fragile).** A multi-step onboarding-flow state machine (`src/services/loginFlow.ts`). X frequently injects captcha / suspicious-login challenges, so this path is best-effort; prefer the session paste.

Sessions are stored locally (Android `AsyncStorage`, web `localStorage`) and never leave the device except to X itself.

---

## Scripts

| Command                  | What it does                                             |
| ------------------------ | ------------------------------------------------------- |
| `npm run web`            | Web dev server                                          |
| `npm start`              | Metro bundler for Android                               |
| `npm run android`        | Build & install on device                               |
| `npm run build:android`  | Release APK (Java 8) + bundle verification              |
| `npm run lint`           | ESLint on `.ts`/`.tsx`                                  |
| `npm run lint:fix`       | ESLint with auto-fix                                    |
| `npm run format`         | Prettier                                                |
| `npm run typecheck`      | `tsc --noEmit`                                          |
| `npm run generate:emoji` | Regenerate the emoji map                                |

There is no test runner configured.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│  App.tsx (Android)  /  src/App.tsx (Web)      │  global state, manual stack nav, tab bar
└───────────────┬───────────────────────────────┘
                │ props
                ▼
        src/screens/*        Home, Search, Notifications, Messages,
                             DMConversation, Profile, TweetDetail,
                             Compose, Bookmarks, Settings, Login
                │ calls
                ▼
        src/services/*       timelineLoader, notificationsService,
                             dmService, engagementService, mediaService,
                             accountManager, authService, loginFlow,
                             viewCache, nativeNotification
                │ calls
                ▼
        src/api/*            XAPI (GraphQL / v1.1 / v2)  +  parse layer
                │
                ▼
        X internal endpoints (native HTTP bridge on Android, fetch+proxy on web)
```

**Separation of concerns is enforced:** screens never touch `XAPI` or the parse layer directly — all data goes through the services layer, which is the only place that knows X's response shapes.

Two design details worth knowing:

- **Optimistic engagement** — `engagementService` splits pure `apply*` helpers (flip like/retweet state instantly) from `commit*` network calls; the screen reverts on failure, so a slow or rate-limited X never blocks a tap.
- **View cache** — `viewCache` keeps loaded list data (items + cursor + scroll position) in memory so navigating away and back, or switching tabs, restores a view instantly instead of refetching. It's cleared on any login / logout / account switch.

### Dual entry points

`App.tsx` (Android) and `src/App.tsx` (Web) are **two files that must stay in sync**. They share identical navigation and state; the Android one adds hardware-Back handling. Any navigation/state/screen change goes into both unless it's platform-specific.

### Native Android modules

Java under `android/app/src/main/java/com/bbweather/` (the `com.bbweather` package is legacy from the sibling projects):

- `HttpModule` / `Tls12SocketFactory` — JSON-over-native HTTP bridge with forced TLS 1.2 for Android 4.3
- `NotificationModule` / `NotificationPollService` / `BootReceiver` — background poll → native OS notifications
- `KeyEventModule` — hardware key events for D-pad navigation
- `FilePickerModule`, `AudioRecorderModule` — native file pick / audio record

---

## Project Layout

```
App.tsx              Android entry (stack nav + state + hardware Back)
src/App.tsx          Web entry (stack nav + state)
src/api/             XAPI client + parse layer + native/fetch HTTP
src/services/        Data-access & orchestration seam (screens call these)
src/screens/         The 11 screens
src/components/       tweet/  media/  ui/
src/utils/           storage, keyEvents, constants, theme helpers, platform files
src/theme.ts         Dark/light + font sizes
src/setupProxy.js    Web dev proxy to X (CJS)
android/             Native Android app + Java modules
scripts/             Build/verify/codegen helpers
PROCESS.md           Full build & decision log
```

For contributor-facing guidance and deeper conventions, see [`CLAUDE.md`](./CLAUDE.md).

---

## Notes & Limitations

- Uses X's **internal** endpoints, which can change without notice. A GraphQL `400 "missing features"` error means X added a required feature flag — add it to `DEFAULT_FEATURES` / `VIEWER_FEATURES` in `src/api/xapi.ts`.
- Image upload and the native background notification service are **Android-only** in practice.
- Built and tuned for the Q20's 720×720 screen, hardware keyboard, and Android 4.3 runtime — not a general-purpose mobile client.
