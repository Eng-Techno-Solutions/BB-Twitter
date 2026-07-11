// Normalized X (Twitter) domain models. X's internal GraphQL responses are deeply
// nested and verbose; the api/parse layer flattens them into these shapes so the
// UI never touches raw GraphQL. Keep these small and focused (ISP).

export interface XUser {
	id: string; // rest_id
	handle: string; // screen_name, without @
	name: string; // display name
	avatarUrl: string;
	verified: boolean;
	bio?: string;
	followersCount?: number;
	followingCount?: number;
	tweetsCount?: number;
	bannerUrl?: string;
	following?: boolean; // whether the current user follows them
	protected?: boolean;
}

export type XMediaType = "photo" | "video" | "animated_gif";

export interface XMedia {
	type: XMediaType;
	url: string; // display image (photo) or video poster
	videoUrl?: string; // best-bitrate mp4 for video/gif
	width?: number;
	height?: number;
	altText?: string;
}

// A single tweet, normalized. Retweets carry the original in `retweetOf`;
// quotes carry it in `quoted`.
export interface Tweet {
	id: string; // rest_id
	author: XUser;
	createdAt: number; // epoch ms
	text: string;
	media: XMedia[];
	replyCount: number;
	retweetCount: number;
	likeCount: number;
	quoteCount: number;
	viewCount?: number;
	liked: boolean;
	retweeted: boolean;
	bookmarked: boolean;
	inReplyToHandle?: string;
	quoted?: Tweet;
	retweetOf?: Tweet;
	// The account that retweeted this into the viewer's timeline, if any.
	retweetedBy?: XUser;
	conversationId?: string;
}

export interface TimelinePage {
	tweets: Tweet[];
	topCursor?: string;
	bottomCursor?: string;
}

export type NotificationKind = "mention" | "reply" | "like" | "retweet" | "follow" | "other";

export interface XNotification {
	id: string;
	kind: NotificationKind;
	createdAt: number;
	text: string; // e.g. "Alice liked your post"
	users: XUser[]; // actors
	tweet?: Tweet; // the target tweet, when applicable
}

export interface NotificationsPage {
	items: XNotification[];
	cursor?: string;
	unreadCount: number;
}

export interface DMMessage {
	id: string;
	conversationId: string;
	senderId: string;
	text: string;
	createdAt: number;
	media?: XMedia;
}

export interface DMConversation {
	id: string;
	participants: XUser[];
	lastMessage?: DMMessage;
	unread: boolean;
}

export interface Trend {
	name: string;
	url?: string;
	tweetVolume?: number;
	context?: string; // e.g. "Trending in Technology"
}

// Uniform result envelope from the api layer, mirroring BBSlack's SlackResponse
// posture (throw on hard failure, otherwise return typed data).
export interface XResult<T> {
	data: T;
}
