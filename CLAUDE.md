# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

BB Twitter — an X (Twitter) client built with React Native (0.53.3) targeting **Android** and **Web** (via react-native-web). The Android app runs on a BlackBerry Q20 device with hardware keyboard and D-pad navigation.

It is a sibling of BBSlack: the **platform layer** (native Java modules, TLS 1.2, native HTTP bridge, hardware key bridging, D-pad focus, background poll service, manual navigation, class components) is copied verbatim from BBSlack; only the **domain layer** (the X API client, tweet/DM models, and screens) is rewritten for Twitter. See `PROCESS.md` for the full decision log — do not re-litigate platform-layer decisions.

## Commands

```bash
npm run web            # Start web dev server (react-scripts)
npm start              # Start Metro bundler for Android
npm run android        # Build and install on Android device
npm run build:android  # Build release APK (requires Java 8 / temurin-8), then verifies the bundle
npm run lint           # Run ESLint on .ts/.tsx
npm run lint:fix       # ESLint with auto-fix
npm run format         # Prettier on src, App.tsx, index.ts
npm run typecheck      # tsc --noEmit
npm run generate:emoji # Regenerate the emoji map (scripts/generate-emoji-map.js)
```

There is no test runner configured. `postinstall` runs `scripts/postinstall.js`; Husky pre-commit runs lint-staged (Prettier + ESLint) on staged `.ts`/`.tsx`.

## Dual Entry Points — Critical

There are **two separate App.tsx files** that must stay in sync:

- `App.tsx` (root) — Android entry. Adds `BackHandler` hardware-Back handling for the Q20 (pop stack → fall back to Home tab → background the app).
- `src/App.tsx` — Web entry. Same navigation/state, no hardware-Back.

Both own all global state (auth, accounts, active tab, theme, settings, unread badge) and render screens via a `switch` in `renderScreen()`. **Any navigation, state, or screen change must be applied to BOTH files** unless it's platform-specific logic.

## Architecture

- **TypeScript** everywhere (.ts/.tsx). `tsconfig.json`: `strict: true` with `strictNullChecks: false`. Type declarations for untyped modules in `src/types/modules.d.ts`.
- **All class components** — no hooks, no functional components. React 16.14.0. Uses the `function` keyword throughout (arrow functions mostly only for class-field handlers). Async/await is used.
- **Manual stack navigation** — `state.stack` array in App.tsx with `navigate()`, `goBack()`, `selectTab()`. No react-navigation. Five bottom tabs (home, search, notifications, messages, profile) each reset to a root screen; other screens (tweetDetail, compose, dmConversation, profile, bookmarks, settings) push onto the stack.
- **Props drilling** — App owns global state and passes props + shared tweet handlers (`_openTweet`, `_openAuthor`, `_reply`, `_quote`, `_compose`) down to screens. No Redux/Context.

### Layering (Separation of Concerns — enforced)

Screens never touch `XAPI` or the parse layer directly. Data flows through the **services layer** (`src/services/`), which is the only place that knows GraphQL/JSON shapes:

- `timelineLoader.ts` — every tweet list (home for-you/following, user tweets, search). Returns `TimelinePage` with a cursor.
- `notificationsService.ts` — notifications feed + cheap unread badge count.
- `dmService.ts` — DM inbox (trusted + best-effort untrusted) and conversations.
- `engagementService.ts` — like/retweet/bookmark. Split into **pure** `apply*` optimistic-update helpers (UI calls synchronously to flip state) and `commit*` network calls (screen reverts on throw).
- `mediaService.ts` — pick + upload image for Compose (Android in practice).
- `accountManager.ts` — multi-account: auth, upsert/remove account, auto-login, persistence.
- `authService.ts` — validates a session and returns identity via the GraphQL `Viewer` query.
- `loginFlow.ts` — username/password onboarding-flow state machine (fragile; the reliable path is a pasted session).
- `nativeNotification.ts` — bridge that syncs accounts to / toggles the native Android background poll service. No-op off Android.
- `viewCache.ts` — module-scope in-memory cache of loaded list data (items + cursor + scroll position), keyed by string, so navigating away/back or switching tabs restores a view instantly without refetching. Data-only (plain arrays, not mounted trees). **Cleared on login/logout/account-switch** (`clearViews()`) so one account's data never renders under another.

### API client (`src/api/`)

- `xapi.ts` — the `XAPI` class wrapping X's internal endpoints: **GraphQL** (`/i/api/graphql/`), **v1.1** (`api.x.com/1.1/`), and **v2** (`/i/api/2/`). Auth is a session (`auth_token` + `ct0`/csrf), not OAuth. X's GraphQL rejects requests missing feature flags — `DEFAULT_FEATURES` / `VIEWER_FEATURES` hold the current sets; a 400 "missing features" error means add the named flag there. Query IDs live in `X_GQL` (constants.ts).
- `parse.ts` / `parseDM.ts` / `parseNotifications.ts` — turn raw X responses into the app's `Tweet` / `DMConversation` / notification models (`src/types/x.ts`). Keep response-shape knowledge here.
- `http.ts` — Android uses `NativeModules.HttpModule` (Java bridge); web falls back to `fetch()`. Also `uploadFile()` for multipart media upload.

## Platform Patterns

**Platform-specific files** use suffix convention — Metro/react-scripts resolve automatically:
- `.web.tsx`/`.web.ts` for web, `.android.tsx`/`.android.ts` for Android
- Examples: `notification`, `filePicker`, `audioRecorder`, `audioDownload`, `notificationSound`, `pointer`, `Icon`, `VideoView`
- Modules with both variants share a `.d.ts` type declaration (e.g. `Icon.d.ts`, `VideoView.d.ts`)

**Icons**: Android uses `react-native-vector-icons/Feather`, web uses `lucide-react`. Both exposed through the `Icon` component (`src/components/ui/`).

**HTTP**: Abstracted in `src/api/http.ts` (native bridge vs `fetch`).

**Web proxy** (`src/setupProxy.js`): routes X's internal API through the dev server to dodge CORS. `/x-gql`→graphql, `/x-v11`→v1.1, `/x-v2`→v2, `/x-upload`→media upload. The browser strips the `Cookie` header, so the client sends the session as `x-bbt-cookie` and the proxy rewrites it back to a real `Cookie`. Stays `.js` (CJS required by react-scripts); not part of typecheck. Client picks proxy vs direct hosts via `API` in `src/utils/constants.ts` (web = `*_PROXY`, Android = `*_WEB`).

**Storage** (`src/utils/storage.ts`): Web uses `localStorage`, Android uses `AsyncStorage`. All functions are async. Holds the `XSession`, accounts, active account id, and settings.

**Web-specific styling**: CSS in `public/index.html` targets `data-type` attributes for focus/hover styles. Silently ignored on Android. On web, theme is applied via `data-theme` on `<html>`.

**Focus/interaction**: Every interactive element needs both — Web: CSS `:focus` via `data-type` in `public/index.html`; Android: `TouchableHighlight` with `underlayColor`.

## Native Android Modules

Package is `com.bbweather` (legacy from the sibling projects). Java lives in `android/app/src/main/java/com/bbweather/`:

- `HttpModule` / `HttpPackage` — JSON-over-native HTTP bridge (`Tls12SocketFactory` forces TLS 1.2 for Android 4.3).
- `NotificationModule` / `NotificationPollService` / `BootReceiver` — background poll service that diffs and posts OS notifications natively, so they survive the app being swiped from recents. JS side only syncs accounts and toggles it via `services/nativeNotification.ts`.
- `KeyEventModule` — bridges Q20 hardware key events (see `src/utils/keyEvents.ts`).
- `FilePickerModule`, `AudioRecorderModule` — native file pick / audio record.

## Theme System

`src/theme.ts` — dark/light mode with `getColors()`, `setMode()`, `setFontSizeKey()`. Font sizes: small (13px), medium (15px), large (17px). Exports `ThemeColors`, `ThemeMode`, `FontSizeKey` types.

## Screens (`src/screens/`)

Rendered by the `switch` in each App's `renderScreen()`: Login, Home (for-you/following tabs), Search, Notifications, Messages (DM inbox), DMConversation, Profile, TweetDetail, Compose (tweet/reply/quote), Bookmarks, Settings.

## Key Components (`src/components/`)

- `tweet/` — `TweetList`, `TweetItem` (core tweet rendering), `TweetText` (token-based X markup parser), `RepostMenu`.
- `media/` — `TweetMedia`, `MediaViewer`, `VideoView`.
- `ui/` — `Header`, `TabBar`, `Icon`, `ErrorView`, `ErrorBoundary` (wraps the active screen so a render failure doesn't take down the whole app).

## Hardware Keyboard (Q20)

`src/utils/keyEvents.ts` bridges Android hardware key events. Screens implement `focusIndex`-based D-pad navigation for the Q20's trackpad and arrow keys.
