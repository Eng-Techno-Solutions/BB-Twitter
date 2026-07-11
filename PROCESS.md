# BBTwitter — Build Process & Decision Log

An X (Twitter) client for the **BlackBerry Q20**, built as a sibling to **BBSlack**.
This document is the running journal of the journey: every decision, why it was
taken, the trade-offs, and the roadmap. It is written to be read top-to-bottom by
a senior engineer who has never seen the repo.

> **North star:** reuse the *exact* BBSlack architecture — every hard-won decision
> in BBSlack was found after a long search to make it run flawlessly on the Q20's
> Android 4.3 runtime, hardware keyboard, and D-pad. We do **not** re-litigate those
> decisions. We only remap the **domain** (Slack → Twitter) on top of the proven
> platform layer.

---

## 1. What "follow BBSlack exactly" means here

BBSlack is two things stacked:

1. **A platform layer** — the hard part. Native Java modules, TLS 1.2 via Conscrypt,
   a JSON-over-native HTTP bridge, hardware key-event bridging, D-pad focus
   navigation, a background poll service, platform-suffix file resolution, manual
   stack navigation, class components on React 16.14 / RN 0.53.3, AsyncStorage vs
   localStorage, the exact Gradle/AGP/SDK versions.
2. **A domain layer** — Slack-specific: the Slack Web API client, channel/message
   models, and the 8 screens.

**We copy (1) verbatim and rewrite (2) for Twitter.** Nothing in the platform layer
is "improved" — the whole point is that it already works on the Q20.

### Decisions inherited from BBSlack (NOT reopened)

| Area | Inherited decision | Why it stays |
| --- | --- | --- |
| RN version | `react-native@0.53.3`, `react@16.14.0` | Last line that runs on the Q20 Android 4.3 runtime |
| Components | **All class components, no hooks** | RN 0.53 predates hooks; consistency with BBSlack |
| Navigation | Manual `state.stack` + `navigate/goBack/replaceTop` | No react-navigation on this RN; proven on Q20 |
| State | Props drilling from root `App` | No Redux/Context; keeps bundle tiny, JS thread light |
| HTTP | Native `HttpModule` (Java) with `fetch()` web fallback | Android 4.3's stock stack rejects modern TLS; native path forces TLS 1.2 |
| TLS | `Tls12SocketFactory` + Conscrypt provider | Q20 ships TLS 1.2 disabled; servers reject legacy |
| Storage | `localStorage` (web) / `AsyncStorage` (android) | Same abstraction, async everywhere |
| Icons | `react-native-vector-icons/Feather` (android) / `lucide-react` (web) | Bridged via platform-suffix `Icon` component |
| Keyboard | `KeyEventModule` → `DeviceEventEmitter("onKeyEvent")` | Q20 D-pad/trackpad, `focusIndex` navigation |
| Build | AGP 3.1.4, compileSdk 28, minSdk 16, temurin-8 | The one combination that assembles + installs on Q20 |
| Entry points | **Dual** `App.tsx` (android) + `src/App.tsx` (web) | Kept in sync; platform-specific lifecycle differs |
| Lang/tooling | TypeScript strict (null-checks off), ESLint flat, Prettier tabs | Identical config |
| Code style | `function` keyword, async/await, no arrow fns in most files | Match BBSlack for zero cognitive switching |

### The one place we deviate on purpose

BBSlack targets **Android + Web**. We keep the web target working (it's the fast
dev loop — `npm run web` in a desktop browser), but **the Q20 Android build is the
product**. Web is a development convenience, exactly as in BBSlack.

---

## 2. The hardest decision: how to talk to X at all

This is the decision that took the most thought, so it is documented in full.

### The problem
X's **official API v2** is paywalled to the point of being useless for a real
client: the Free tier has **no home-timeline read**, no user-timeline read, and a
tiny write quota. Basic ($100+/mo) is still read-limited. You cannot build a usable
Twitter client on the official API. So "official API" is a dead end for this project.

### How BBSlack solved the equivalent problem
BBSlack does **not** use Slack's official OAuth app-distribution flow. It calls
Slack's **internal** endpoints — `auth.findTeam`, `auth.signin` (email + password +
2FA pin) — to derive a **session bearer token**, then drives Slack's internal Web
API (`slack.com/api/*`) with that token. This is the "browser session, replayed
from a native client" pattern.

### The faithful parallel for X
Do exactly what BBSlack does, one layer over: authenticate as a **web session** and
drive X's **internal API** (the same endpoints `x.com` itself calls):

- **Base bearer** — X's public web app bearer token (a long-lived constant shipped
  in x.com's JS). Same for everyone; it is not the user secret.
- **User session** — the user's `auth_token` cookie + `ct0` (CSRF) cookie, taken
  from a logged-in `x.com` session.
- **Request shape** — `Authorization: Bearer <web-bearer>`,
  `x-csrf-token: <ct0>`, `Cookie: auth_token=…; ct0=…`,
  `x-twitter-auth-type: OAuth2Session`, `x-twitter-active-user: yes`.
- **Endpoints** — the internal GraphQL API (`x.com/i/api/graphql/<queryId>/<Op>`),
  the internal v1.1/v2 JSON endpoints (`x.com/i/api/1.1/…`, `.../2/…`), and
  `upload.twitter.com/1.1/media/upload.json` for media.

This is the only path that yields a working timeline/tweet/like/reply/DM client,
and it mirrors BBSlack's architecture precisely (session-derived credentials → an
internal API client → a native TLS-1.2 HTTP bridge).

### Auth methods offered (mirrors BBSlack's two methods)
BBSlack offers **(a)** email/password/pin sign-in and **(b)** a paste-a-token
fallback. BBTwitter mirrors this:

- **Method A — Session paste (primary, most reliable).** User pastes `auth_token`
  and `ct0` from their browser session. Zero moving parts, survives X's frequent
  login-flow changes. The "Session" tab on `LoginScreen`.
- **Method B — Username/password login flow (IMPLEMENTED, iter 10).** The
  "Password" tab. Replays X's `onboarding/task.json` state machine
  (`services/loginFlow.ts`): guest token → flow init → JS instrumentation →
  username → password → account-dup check → success, surfacing **2FA** and
  **email/phone (LoginAcid)** as a code prompt. The `ct0`/`auth_token` arrive via
  `Set-Cookie`, so this needs a native cookie jar — added a process-wide
  `CookieManager` in `MainApplication` + `HttpModule.getCookies/clearCookies`
  (`utils/cookies.ts` bridges it). **Android-only** (web `fetch` can't read these
  cookies) and it **dead-ends on Arkose/FunCaptcha** with a message pointing back
  to Method A. Because native code changed, the Q20 needs a **clean rebuild**
  (`npm run android` / `build:android`) to pick up the cookie jar.

### Known fragility (documented, not hidden)
- **GraphQL query IDs** (the hash in `/graphql/<queryId>/<Op>`) rotate when X ships
  frontend builds. They are centralized in one constants module (`X_GQL`) so a
  refresh is a one-file edit. PROCESS.md §7 covers the refresh procedure.
- **Rate limits.** X's internal endpoints are rate-limited per session. We poll
  conservatively (same philosophy as BBSlack's poll intervals) and surface
  `429` as a user-facing "slow down" state.
- **This is a personal-use client for the user's own account**, on a niche device —
  the same posture as BBSlack against Slack's internal API.

---

## 3. Domain mapping: Slack → Twitter

The platform layer is copied. The domain layer is a systematic remap:

| BBSlack (Slack) | BBTwitter (X) | Notes |
| --- | --- | --- |
| Workspace / Team | Account (the signed-in user) | `accountManager` reused nearly as-is (multi-account = multiple X logins) |
| Channel | *(no direct analog)* | X's model is feeds, not rooms |
| ChannelList screen | **Home** timeline (For You / Following tabs) | The landing feed |
| Message (`MessageItem`) | **Tweet** (`TweetItem`) | Core render unit: text, media, quote, actions |
| Chat screen (message list) | Feed list (reused list infra) | Home / Profile / Search all render tweet lists |
| Thread screen | **TweetDetail** (conversation: tweet + replies) | Reply chain |
| Reaction | **Like** (+ Repost, Quote, Bookmark as tweet actions) | `reactionService` → `engagementService` |
| Search messages | **Search / Explore** (tweets, users, trends) | `SearchScreen` reused shape |
| ChannelInfo screen | *(repurposed)* Profile / conversation info | |
| Profile screen | **Profile** (user header + their tweets) | Follow/unfollow, tabs |
| Settings screen | **Settings** (theme, font, notifications, auth) | Reused nearly as-is |
| DMs (`conversationsOpen`) | **Messages** (DM inbox + conversation) | X DM endpoints |
| RTM websocket client | **Polling** (`timelinePoll`) | X has no easy client websocket; poll like BBSlack's non-RTM path |
| Mentions / unread counts | **Notifications** (mentions, likes, follows) | New screen; drives the unread badge |
| `SlackText` markup parser | `TweetText` parser | @handles, #hashtags, $cashtags, links, emoji |
| EmojiPicker | EmojiPicker (reused verbatim) | Compose reactions/tweets |
| Compose (inline input) | **Compose** tweet/reply/quote screen | New; media attach reuses `filePicker` |

### Screen set (9, vs BBSlack's 8)
`Login, Home, TweetDetail, Compose, Search, Notifications, Messages, Profile, Settings`

Rendered by the same `switch` in `renderScreen()` in **both** `App.tsx` files.
Navigation stays the manual stack. A lightweight bottom tab bar (Home / Search /
Notifications / Messages / Profile) sits above the stack for the primary
destinations — BB10-native look, D-pad reachable.

---

## 4. UI direction: BlackBerry 10 native, not X-web

BB10's design language (Cascades) is the target aesthetic, adapted to X's content:

- **Dark-first**, flat, high-contrast. BB10's signature deep charcoal/graphite
  surfaces with a single accent. We keep X's accent blue (`#1D9BF0`) so it still
  *reads* as Twitter, over BB10-style neutral surfaces.
- **Action bar at the bottom** (BB10 signature) for context actions (compose,
  reply, refresh) — not a top toolbar. Reachable by D-pad.
- **Tabs at the top** of a screen (BB10 tab strip) for For-You/Following, and
  profile sub-tabs.
- **No gratuitous animation.** BB10 felt instant; the Q20 JS thread is slow. Lists
  avoid re-renders, inline closures in `renderItem`, and heavy layout. Same list
  discipline as BBSlack (`keyExtractor`, memoized rows, no inline objects in JSX).
- **Hardware-first interaction.** Every row/action is `focusIndex`-navigable with
  the D-pad and actionable with Enter, in addition to touch.
- **Density.** Q20 screen is 720×720. Compact rows, 13/15/17px font scale
  (inherited), generous touch targets despite density.

---

## 5. Performance posture (Q20 is the constraint)

Same rules as BBSlack, restated because they gate every screen:

- Class components; no re-render storms. Root `App` owns state, passes minimal props.
- Lists: `FlatList` with `keyExtractor`, memoized `renderItem` component (`TweetItem`
  is a `PureComponent`/`shouldComponentUpdate`), no inline functions/objects per row.
- No heavy compute on render — tweet parsing (`TweetText`) is memoized per tweet id.
- Polling intervals are conservative and back off; no websocket churn.
- Images: lazy, capped, downloaded through the native bridge (auth + TLS), cached
  to disk via `react-native-fs`, exactly like BBSlack's authenticated file proxy.
- Bundle stays lean — no new heavy dependencies. Reuse what BBSlack already ships.

---

## 6. Build phases (roadmap & status)

Legend: ✅ done · 🚧 in progress · ⬜ todo

### Phase 0 — Platform clone (the proven layer)
- ✅ Clone BBSlack tree → BBTwitter (excl. node_modules/build/.git/bundle)
- ✅ Rename app identity: `BBSlack`→`BBTwitter`, `com.engtechnos.BBSlack`→`.BBTwitter`,
      `bb-slack`→`bb-twitter`, display name `BB Twitter`
- ✅ Generate matching release keystore (`BBTwitter.keystore`, alias `BBTwitter`)
- ✅ Native modules carried over verbatim (Http, KeyEvent, Notification, FilePicker,
      AudioRecorder, TLS12, Boot/PollService, MainActivity/Application)
- ⬜ `npm install` + `npm run typecheck` green on the platform layer

### Phase 1 — Domain foundation
- ✅ `utils/constants.ts` → X endpoints, GraphQL op registry, storage keys, timings
- ✅ `types/x.ts` → Tweet, XUser, Media, TimelinePage, DM, Notification models
- ✅ `types/theme.ts` → added `like`/`retweet` engagement colors
- ✅ `api/xapi.ts` → internal X client (GraphQL + v1.1/v2 ops), modeled on `slack.ts`
- ✅ `theme.ts` → BB10 charcoal surfaces + X accent (dark/light)
- ✅ `utils/storage.ts` → X session pair (auth_token + ct0) save/get/clear
- 🚧 `api/parse.ts` → flatten X GraphQL timeline instructions → `Tweet[]` (NEXT)
- ⬜ `services/authService.ts` → cookie/token + login-flow auth
- ⬜ `services/accountManager.ts` → adapt account entry to X identity
- ⬜ Remove/replace remaining Slack-domain files (slack.ts, message components, screens)

### Phase 2 — Read path (see your timeline)
- ✅ `services/authService.ts` → parse pasted session, verify via `verify_credentials`
- ✅ `services/timelineLoader.ts` → home/user/bookmarks/conversation loaders
- ✅ `utils/tweetFormat.ts` → relative time + count abbreviation
- ✅ `components/tweet/TweetText.tsx` → @/#/$/URL tokenizer
- ✅ `components/tweet/TweetItem.tsx` (+styles) → core PureComponent row with media,
      quote card, retweet attribution, engagement action bar
- ✅ `Icon` maps extended with X actions/tabs (repeat, bookmark, share, home, …)
- ✅ `services/engagementService.ts` (pure optimistic apply* + network commit*)
- ✅ `LoginScreen` (paste auth_token + ct0, D-pad focus nav)
- ✅ `components/tweet/TweetList.tsx` — reusable engageable feed (refresh, infinite
      scroll, optimistic engagement, Q20 list-perf tuning) reused by every tweet list
- ✅ `HomeScreen` (For you / Following tabs over `TweetList` + compose FAB)
- ✅ `Header` decoupled from Slack markup (plain subtitle)
- ✅ `components/ui/TabBar.tsx` (Home/Search/Notifications/Messages/Profile + badge)
- ✅ `TweetDetailScreen` (focal tweet + replies via `TweetList`)
- ✅ `ComposeScreen` (tweet/reply/quote, char counter)
- ✅ `ProfileScreen` (header card + user timeline), `SearchScreen` (Top/Latest/Media),
      `SettingsScreen` (theme/font/notifs/logout), `NotificationsScreen` + `MessagesScreen`
      (placeholders — real feeds in Phase 4)
- ✅ `types/app.ts`, `services/accountManager.ts` (X multi-account), storage → `XAccount`
- ✅ **Both `App.tsx` shells** wired: 9-screen manual stack + bottom `TabBar`,
      hardware-Back handling (android), theme/settings/auth/logout, shared tweet handlers

### Phase 2.5 — Compile & cut over ✅
- ✅ Deleted all Slack-domain files (api/slack|types|queryCache; message/ + workspace/;
      ChannelList/Chat/Thread/ChannelInfo + screens/types/*; rtm*/slackDataLoader/settingsManager/
      nativeNotification/messageService/reactionService/navigationManager; types slack/rtm/navigation;
      utils format/mentions/unread/slackMarkup/emoji/fileHelpers/openDocument; unused ui: EmojiPicker/
      InputBar/ActionSheet/NotificationBanner/GlobalUnreadBadge)
- ✅ Rewrote barrels (api/index → XAPI+http+parse; recreated minimal api/types; components/index,
      components/ui/index, utils/index, types/index) and trimmed avatar util
- ✅ `npm install --legacy-peer-deps` (2332 pkgs) + **`npm run typecheck` GREEN (0 errors)**
- ✅ **ESLint 0 errors** (9 naming-style warnings only), Prettier-formatted
- ✅ `setupProxy.js` → `/x-gql` `/x-v11` `/x-v2` `/x-upload` for the web dev loop
- ✅ Q20 runtime fix: TweetText tokenizer made ASCII-only (no `/u`/`\p{L}` — ancient JSC throws)

> **Web-target auth caveat (documented):** on web, `http.ts` falls back to `fetch()`, which
> forbids setting the `Cookie` header — so live X calls need the **Android** build (native
> `HttpModule` sets Cookie + forces TLS 1.2). Web remains the fast UI dev loop, exactly as in
> BBSlack where Android is the product. On-device APK build/run is the true smoke test.

### Phase 3 — Write path (engage)
- ⬜ Like / Unlike, Repost / Undo, Bookmark
- ⬜ `ComposeScreen` (tweet, reply, quote) + media attach
- ⬜ Delete own tweet
- ⬜ Follow / Unfollow

### Phase 4 — The other tabs
- ✅ `SearchScreen` (tweets — Top/Latest/Media) — done in Phase 2
- ✅ `NotificationsScreen` (real feed: mentions/likes/follows) + `api/parseNotifications.ts`
      (v2 globalObjects flattener) + `notificationsService.ts`
- ✅ Follow / Unfollow wired on `ProfileScreen` (optimistic, reverts on failure)
- ✅ `MessagesScreen` (real DM inbox) + `DMConversationScreen` (transcript + send) +
      `api/parseDM.ts` (inbox/conversation flattener) + `dmService.ts`; `dmConversation` route
      added to both App shells
- ✅ `ProfileScreen` sub-tabs (Posts / Replies / Media / Likes) — routes to existing loaders
- ✅ Bookmarks screen (`BookmarksScreen` over `TweetList`) reachable from Settings
- ✅ Unread badge — `api.badgeCount()` + `loadUnreadCount()` polled on the App's notif interval,
      feeds `TabBar`; cleared when the Notifications tab opens
- ✅ Media upload + attach in Compose — `xapi.uploadMediaSimple()` (single-shot via the generic
      `request()` path so cookie/csrf auth is sent) + `mediaService.pickAndUploadImage()` + Compose
      attach button, preview thumbnail, remove, media-only posts. Android-only (needs base64 + cookies)
- ⬜ Search: people/trends tabs (nice-to-have, not attempted)

**Feature coverage now:** Login · Home (For you/Following) · Tweet detail + replies · Compose
(tweet/reply/quote) · Search (Top/Latest/Media) · Notifications · Messages (inbox + conversation +
send) · Profile (4 sub-tabs + follow/unfollow) · Settings. Like/repost/bookmark all optimistic.
Build stays typecheck+lint GREEN throughout.

### Phase 5 — Polish & platform
- ✅ Settings (theme, font size, notifications, sound, logout) — done
- ✅ ErrorBoundary + user-facing error/empty/loading states on every async surface
- 🔜 **Needs the device** — Background `NotificationPollService.java` rewrite for X (it still
      contains Slack polling logic; harmless — it's only started by the removed native notif
      module, which the app no longer calls). Rewriting it blind is risky; do it against the Q20.
- 🔜 **Needs the device** — D-pad focus pass on the feed/list screens (Login is done; lists rely
      on touch + the RN focus system today)
- 🔜 **Needs the device** — Release APK build on temurin-8 + verify on Q20 (see §9)

### Phase 6 — Feature parity stretch (not attempted)
- Lists / Communities (read), Spaces (not feasible — audio), quote-tweet timeline,
  who-to-follow, mute/block, tweet analytics. Search people/trends tabs.

---

## 9. Building & running on the BlackBerry Q20 (hand-off)

Everything buildable and verifiable **without** the physical device is done and the code is
**typecheck-clean and lint-clean**. The remaining work is inherently on-device. To take it there:

```bash
cd React-Native-Apps/BBTwitter
npm install --legacy-peer-deps          # already done once; re-run if node_modules is fresh
npm run typecheck                        # expect 0 errors
# --- fast UI dev loop (desktop browser; live X calls won't auth — see the web caveat) ---
npm run web
# --- the real target: Android on the Q20 ---
npm start                                # Metro bundler (dev)
npm run android                          # build + install debug on the connected Q20
npm run build:android                    # release APK via temurin-8 (JAVA_HOME is set in the script)
```

**First-run on device:**
1. On a desktop browser, log in to `x.com`, open DevTools → Application → Cookies → x.com, copy
   the `auth_token` and `ct0` values.
2. Launch BBTwitter on the Q20, paste both into the login screen, Sign In.
3. If the home timeline 404s / errors with "missing features" or a bad-query error, X shipped a new
   web build → **refresh the GraphQL query IDs** in `src/utils/constants.ts#X_GQL` (procedure in §7).

**What's verified here vs. what needs the device:**
- ✅ Verified: full TypeScript typecheck, ESLint, Prettier; the entire screen/nav graph compiles;
      component logic and the parse layer are self-consistent.
- 🔜 Needs device + live session: actual X API responses (query IDs, feature flags, DM/notif shapes),
      TLS-1.2 path on Android 4.3, D-pad feel, media upload against the real upload host, and the APK.

---

## Appendix — original Phase 5/6 (superseded by §9)

## 7. Operational notes

### Refreshing GraphQL query IDs (when X ships a new frontend)
1. Log in to `x.com` in a desktop browser, open DevTools → Network → filter `graphql`.
2. Trigger the action (scroll home, open a tweet, like, etc.).
3. Copy the `<queryId>` and `<OperationName>` from the request URL.
4. Update the matching entry in `X_GQL` in `src/utils/constants.ts`. No other change.

### Where the credentials live
- `auth_token` + `ct0` are stored via the same `storage` abstraction as BBSlack's
  token (`AsyncStorage`/`localStorage`), keyed under `@BBTwitter:*`. Never logged,
  never committed. `.env` is git-ignored (inherited).

### Dual-entry sync rule (inherited, critical)
Any navigation/state/screen change goes into **both** `App.tsx` (android) and
`src/App.tsx` (web). Platform-only lifecycle (BackHandler, AppState, poll service)
stays platform-specific.

---

## 8. Decision log (chronological)

- **D1 — Clone, don't scaffold fresh.** The Q20-viable RN/Gradle/native combo is the
  product's moat. Starting from `react-native init` would reopen every solved
  problem. Cloned BBSlack and remapped the domain instead.
- **D2 — Internal X API over official API.** Official API can't read a timeline on
  any affordable tier. Internal API (web-session replay) is the only viable path and
  is the exact analog of BBSlack's internal-Slack-API approach.
- **D3 — Token/cookie paste as primary auth.** X's username/password onboarding flow
  changes often and adds challenges; the cookie method is stable and is the reliable
  path, with the login flow as a convenience layer — mirroring BBSlack's two methods.
- **D4 — Polling, not websockets.** X has no simple client push; BBSlack already has a
  battle-tested poll + background-service model. Reuse it.
- **D5 — Keep web target.** It's the fast dev loop, free from BBSlack. Q20 remains the
  real target.
- **D6 — BB10 aesthetic with X accent.** Native-feeling on the device, still legibly
  "Twitter." No heavy animation — respect the JS thread.
- **D7 — Centralize GraphQL op IDs.** Isolate X's frontend churn to one file.

*(This log is appended to as the build proceeds.)*
