# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

BB Twitter — a Slack client built with React Native (0.53.3) targeting **Android** and **Web** (via react-native-web). The Android app runs on a BlackBerry Q20 device with hardware keyboard and D-pad navigation.

## Commands

```bash
npm run web          # Start web dev server (react-scripts)
npm start            # Start Metro bundler for Android
npm run android      # Build and install on Android device
npm run build:android  # Build release APK (requires Java 8 / temurin-8)
npm run lint         # Run ESLint on TypeScript files
npm run lint:fix     # Run ESLint with auto-fix
npm run format       # Run Prettier on all source files
npm run typecheck    # Run TypeScript type checker (tsc --noEmit)
```

## Dual Entry Points — Critical

There are **two separate App.tsx files** that must stay in sync:

- `App.tsx` (root) — Android entry. Has `BackHandler`, `AppState`, `DeviceEventEmitter`, native notification service management.
- `src/App.tsx` — Web entry. Has DOM theme application, simplified notification polling.

**Any navigation, state, or screen change must be applied to BOTH files** unless it's platform-specific logic.

## Architecture

- **TypeScript** — entire codebase is TypeScript (.ts/.tsx). Type declarations in `src/types/modules.d.ts`.
- **All class components** — no hooks, no functional components. React 16.14.0.
- **Manual stack navigation** — `state.stack` array in App.tsx, with `navigate()`, `goBack()`, `replaceTop()`. No react-navigation.
- **Props drilling** — App component owns all global state, passes props to screens. No Redux/Context.
- **Slack API client** (`src/api/slack.ts`) — wraps Slack Web API with Bearer token auth. Android hits `https://slack.com/api/` directly; web uses `/slack-api/` proxy (configured in `src/setupProxy.js`).
- **Code style** — uses `function` keyword throughout (no arrow functions in most files). Async/await is used.

## Tooling

- **TypeScript** — `tsconfig.json` at root. `strict: true` with `strictNullChecks: false`.
- **ESLint** — flat config in `eslint.config.mjs`. TypeScript-aware rules via `@typescript-eslint`.
- **Prettier** — `.prettierrc` with tabs, double quotes, no trailing commas, sorted imports.
- **Husky + lint-staged** — pre-commit hook runs Prettier and ESLint on staged `.ts`/`.tsx` files.
- **Metro TypeScript** — `rn-cli.config.js` configures `react-native-typescript-transformer` for Android builds.

## Platform Patterns

**Platform-specific files** use suffix convention — Metro/react-scripts resolve automatically:
- `.web.tsx`/`.web.ts` for web, `.android.tsx`/`.android.ts` for Android (e.g., `Icon.web.tsx` / `Icon.android.tsx`)
- Examples: `notification.ts`/`.web.ts`, `filePicker.ts`/`.web.ts`, `NativeSound.ts`/`.web.ts`, `audioRecorder.ts`/`.web.ts`
- Platform-specific Icon module has a shared type declaration: `src/components/Icon.d.ts`

**Icons**: Android uses `react-native-vector-icons/Feather`, web uses `lucide-react`. Both exposed through `Icon` component.

**HTTP**: Android uses `NativeModules.HttpModule` (Java bridge), web falls back to `fetch()`. Abstracted in `src/api/http.ts`.

**Web proxy** (`src/setupProxy.js`): Two endpoints — `/slack-api` proxies to `slack.com/api`, `/slack-file` proxies authenticated file downloads (images, audio). This file stays as `.js` (CJS required by react-scripts).

**Storage** (`src/utils/storage.ts`): Web uses `localStorage`, Android uses `AsyncStorage`. All functions are async.

**Web-specific styling**: CSS in `public/index.html` targets `data-type` attributes for focus/hover styles. These attributes are silently ignored on Android.

**Focus/interaction**: Every interactive element needs:
- Web: CSS `:focus` style via `data-type` attribute in `public/index.html`
- Android: `TouchableHighlight` with `underlayColor`

## Theme System

`src/theme.ts` — dark/light mode with `getColors()`, `setMode()`. Font sizes: small (13px), medium (15px), large (17px). On web, theme is applied via `data-theme` attribute on `<html>`. Exports `ThemeColors`, `ThemeMode`, `FontSizeKey` types.

## Screens

8 screens rendered by switch in `App.tsx#renderScreen()`: Login, ChannelList, Chat, Thread, Search, ChannelInfo, Settings, Profile.

## Key Components

- `MessageItem` — core message rendering (text, images, files, audio, reactions, threads)
- `SlackText` — token-based Slack markup parser (@mentions, #channels, links, bold, italic, code)
- `EmojiPicker` — grid emoji selector with search and Twemoji
- `ImageViewer` — modal image preview with zoom

## Hardware Keyboard (Q20)

`src/utils/keyEvents.ts` bridges Android hardware key events. Screens implement `focusIndex`-based D-pad navigation for the Q20's trackpad and arrow keys.
