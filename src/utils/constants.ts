// Storage keys — same abstraction as BBSlack, namespaced to BBTwitter.
export const STORAGE_KEYS = {
	AUTH_TOKEN: "@BBTwitter:authToken",
	CSRF_TOKEN: "@BBTwitter:ct0",
	THEME: "@BBTwitter:theme",
	NOTIF_INTERVAL: "@BBTwitter:notifInterval",
	NOTIF_ENABLED: "@BBTwitter:notifEnabled",
	SOUND_ENABLED: "@BBTwitter:soundEnabled",
	FONT_SIZE: "@BBTwitter:fontSize",
	ACCOUNTS: "@BBTwitter:accounts",
	ACTIVE_ACCOUNT: "@BBTwitter:activeAccount",
	HOME_TAB: "@BBTwitter:homeTab"
} as const;

export const TIMING = {
	NOTIF_POLL_DEFAULT: 120000,
	CACHE_STALE_TIME: 30000,
	CACHE_GC_TIME: 300000,
	CACHE_GC_INTERVAL: 60000,
	// X has no simple client push — we poll, conservatively, like BBSlack's
	// non-RTM path. Home refreshes on demand; background notif poll is slower.
	TIMELINE_POLL: 60000,
	NOTIF_BG_POLL: 120000
} as const;

export const SCREENS = {
	LOGIN: "login",
	HOME: "home",
	TWEET_DETAIL: "tweetDetail",
	COMPOSE: "compose",
	SEARCH: "search",
	NOTIFICATIONS: "notifications",
	MESSAGES: "messages",
	PROFILE: "profile",
	SETTINGS: "settings"
} as const;

// X's public web-app bearer token. This is a constant shipped in x.com's JS and
// is the SAME for every user — it is not a user secret. The per-user credential
// is the auth_token + ct0 session pair (see authService / storage).
export const X_WEB_BEARER =
	"Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";

// Endpoint bases. On web we route through the dev proxy (setupProxy.js) to dodge
// CORS; on Android the native HttpModule hits X directly (with forced TLS 1.2).
export const API = {
	// GraphQL: <GQL_BASE><queryId>/<OperationName>
	GQL_WEB: "https://x.com/i/api/graphql/",
	GQL_PROXY: "/x-gql/",
	V11_WEB: "https://api.x.com/1.1/",
	V11_PROXY: "/x-v11/",
	V2_WEB: "https://x.com/i/api/2/",
	V2_PROXY: "/x-v2/",
	MEDIA_UPLOAD_WEB: "https://upload.twitter.com/1.1/media/upload.json",
	MEDIA_UPLOAD_PROXY: "/x-upload/media/upload.json"
} as const;

// GraphQL operation registry — the ONE place X's frontend churn is isolated.
// queryIds rotate when X ships a new web build; refresh via PROCESS.md §7.
// Shape: [queryId, OperationName].
export const X_GQL = {
	// Identity of the logged-in session. This is what x.com's own web client uses
	// (cookie/OAuth2Session auth) — the legacy REST /1.1/account/verify_credentials
	// endpoint returns 404 code 34 under cookie auth, so it is NOT usable here.
	Viewer: ["okNaf-6AQWu2DD2H_MAoVw", "Viewer"],
	HomeTimeline: ["HCosKfLNW1AcOo3la3mMgg", "HomeTimeline"],
	HomeLatestTimeline: ["zhX91JE87mWvfprhYE97xA", "HomeLatestTimeline"],
	TweetDetail: ["QuBlQ6SxNAQCt6-kBiCXCQ", "TweetDetail"],
	UserByScreenName: ["G3KGOASz96M-Qu0nwmGXNg", "UserByScreenName"],
	UserTweets: ["V7H0Ap3_Hh2FyS75OCDO3Q", "UserTweets"],
	UserTweetsAndReplies: ["E4wA5vo2sjVyvpliUffSCw", "UserTweetsAndReplies"],
	UserMedia: ["dexO_2tohK86JDudXXd3Wg", "UserMedia"],
	Likes: ["9s8V6sUI8fZLDiN-REkAxA", "Likes"],
	SearchTimeline: ["nK1dw4oV3k4w5TdtcAdSww", "SearchTimeline"],
	Bookmarks: ["QUjXNEsMb9YHZ7uZmMPQug", "Bookmarks"],
	CreateTweet: ["a1p9RWpkYKBjWv_I3WzS-A", "CreateTweet"],
	DeleteTweet: ["VaenaVgh5q5ih7kvyVjgtg", "DeleteTweet"],
	FavoriteTweet: ["lI07N6Otwv1PhnEgXILM7A", "FavoriteTweet"],
	UnfavoriteTweet: ["ZYKSe-w7KEslx3JhSIk5LA", "UnfavoriteTweet"],
	CreateRetweet: ["ojPdsZsimiJrUGLR1sjUtA", "CreateRetweet"],
	DeleteRetweet: ["iQtK4dl5hBmXewYZuEOKVw", "DeleteRetweet"],
	CreateBookmark: ["aoDbu3RHznuiSkQ9aNM67Q", "CreateBookmark"],
	DeleteBookmark: ["Wlmlj2-xzyS1GN3a6cj-mQ", "DeleteBookmark"]
} as const;

export type XGqlOp = keyof typeof X_GQL;
