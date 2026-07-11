import type XAPI from "../api/xapi";
import { Header } from "../components";
import { TweetMedia } from "../components/media";
import { TweetText } from "../components/tweet";
import Icon from "../components/ui/Icon";
import { loadNotifications } from "../services/notificationsService";
import { getView, saveView, setScrollOffset } from "../services/viewCache";
import { getColors } from "../theme";
import type { ThemeMode } from "../theme";
import type { NotificationKind, Tweet, XNotification, XUser } from "../types/x";
import { getAvatarColor } from "../utils/avatar";
import { errorMessage } from "../utils/error";
import { logger } from "../utils/logger";
import { relativeTime } from "../utils/tweetFormat";
import React, { Component } from "react";
import {
	ActivityIndicator,
	FlatList,
	Image,
	RefreshControl,
	StyleSheet,
	Text,
	TouchableHighlight,
	View
} from "react-native";
import type { ImageStyle, ListRenderItemInfo, TextStyle, ViewStyle } from "react-native";

export interface NotificationsProps {
	themeMode: ThemeMode;
	api: XAPI;
	onBack: (() => void) | null;
	onOpenTweet: (tweet: Tweet) => void;
	onOpenAuthor: (user: XUser) => void;
}

interface NotificationsState {
	items: XNotification[];
	loading: boolean;
	refreshing: boolean;
	error: string | null;
	nowMs: number;
}

// Icon + tint per notification kind (the leading glyph X shows on each row).
const KIND_ICON: Record<NotificationKind, string> = {
	like: "heart",
	retweet: "repeat",
	follow: "user",
	mention: "message-circle",
	reply: "message-circle",
	other: "bell"
};

// Notifications feed. A flat list of notification rows (leading kind icon +
// actor avatars + text, with an optional tweet preview). Best-effort against X's
// v2 notifications endpoint; degrades to an empty state on shape drift.
// Cache key: notifications are per-account and single-page, so one key suffices.
const CACHE_KEY = "notifications";

export default class NotificationsScreen extends Component<NotificationsProps, NotificationsState> {
	_mounted: boolean;
	_listRef: FlatList<XNotification> | null;
	_restoreOffset: number;

	constructor(props: NotificationsProps) {
		super(props);
		// Warm cache → render synchronously, no spinner, no refetch, position kept.
		const cached = getView<XNotification>(CACHE_KEY);
		this.state = {
			items: cached ? cached.data : [],
			loading: cached ? false : true,
			refreshing: false,
			error: null,
			nowMs: Date.now()
		};
		this._mounted = false;
		this._listRef = null;
		this._restoreOffset = cached ? cached.scrollOffset : 0;
		this._renderItem = this._renderItem.bind(this);
		this._refresh = this._refresh.bind(this);
	}

	componentDidMount(): void {
		this._mounted = true;
		// Cache hit: data already in state — restore scroll, no refetch (pull to
		// refresh gets new notifications). Otherwise cold load.
		if (this.state.items.length > 0) {
			this._restoreScroll();
		} else {
			this._load(false);
		}
	}

	componentWillUnmount(): void {
		this._mounted = false;
	}

	_restoreScroll(): void {
		const offset = this._restoreOffset;
		if (!offset) return;
		const self = this;
		const apply = function () {
			if (self._mounted && self._listRef) {
				self._listRef.scrollToOffset({ offset: offset, animated: false });
			}
		};
		setTimeout(apply, 0);
		setTimeout(apply, 200);
	}

	_onScroll = (e: { nativeEvent: { contentOffset: { y: number } } }): void => {
		setScrollOffset(CACHE_KEY, e.nativeEvent.contentOffset.y);
	};

	async _load(isRefresh: boolean): Promise<void> {
		try {
			const page = await loadNotifications(this.props.api);
			if (!this._mounted) return;
			saveView(CACHE_KEY, page.items);
			this.setState({
				items: page.items,
				loading: false,
				refreshing: false,
				error: null,
				nowMs: Date.now()
			});
		} catch (err: unknown) {
			if (!this._mounted) return;
			if (isRefresh) {
				this.setState({ refreshing: false });
				logger.warn("Notifications.refresh", "refresh failed", err);
			} else {
				this.setState({ loading: false, error: errorMessage(err, "Couldn't load notifications") });
			}
		}
	}

	_refresh(): void {
		this.setState({ refreshing: true });
		this._load(true);
	}

	_tintFor(kind: NotificationKind, c: ReturnType<typeof getColors>): string {
		if (kind === "like") return c.like;
		if (kind === "retweet") return c.retweet;
		return c.accent;
	}

	_renderItem(info: ListRenderItemInfo<XNotification>): React.ReactElement {
		const item = info.item;
		const c = getColors();
		const self = this;
		const actor = item.users && item.users[0];
		return (
			<TouchableHighlight
				underlayColor={c.messageUnderlay}
				onPress={function () {
					if (item.tweet) self.props.onOpenTweet(item.tweet);
					else if (actor) self.props.onOpenAuthor(actor);
				}}
				data-type="notif-row">
				<View style={[styles.row, { backgroundColor: c.bg, borderBottomColor: c.border }]}>
					<View style={styles.iconCol}>
						<Icon
							name={KIND_ICON[item.kind] || "bell"}
							size={20}
							color={this._tintFor(item.kind, c)}
						/>
					</View>
					<View style={styles.body}>
						<View style={styles.avatarRow}>
							{item.users.slice(0, 6).map(function (u: XUser, i: number) {
								return u.avatarUrl ? (
									<Image
										key={i}
										source={{ uri: u.avatarUrl }}
										style={styles.avatar}
									/>
								) : (
									<View
										key={i}
										style={[styles.avatar, styles.avatarFallback, { backgroundColor: getAvatarColor(u.id) }]}>
										<Text style={styles.avatarInitial}>{(u.name || "?").charAt(0).toUpperCase()}</Text>
									</View>
								);
							})}
							{item.createdAt ? (
								<Text style={[styles.time, { color: c.textTertiary }]}>
									{relativeTime(item.createdAt, this.state.nowMs)}
								</Text>
							) : null}
						</View>
						{item.text ? (
							<Text style={[styles.text, { color: c.textPrimary }]}>{item.text}</Text>
						) : actor ? (
							<Text style={[styles.text, { color: c.textPrimary }]}>
								<Text style={{ fontWeight: "700" }}>{actor.name}</Text> {this._verb(item.kind)}
							</Text>
						) : null}
						{item.tweet ? this._renderTweet(item.tweet, c) : null}
					</View>
				</View>
			</TouchableHighlight>
		);
	}

	// The embedded post — the enrichment the real app shows: full text, media, and
	// a nested quoted tweet. Tapping the row opens the tweet detail (with the full
	// engagement bar), so this stays a read-only preview.
	_renderTweet(tweet: Tweet, c: ReturnType<typeof getColors>): React.ReactNode {
		return (
			<View>
				{tweet.text ? (
					<TweetText
						text={tweet.text}
						style={[styles.preview, { color: c.textPrimary }]}
						numberOfLines={6}
					/>
				) : null}
				<TweetMedia media={tweet.media} />
				{tweet.quoted ? this._renderQuote(tweet.quoted, c) : null}
			</View>
		);
	}

	_renderQuote(quoted: Tweet, c: ReturnType<typeof getColors>): React.ReactNode {
		return (
			<View style={[styles.quote, { borderColor: c.border }]}>
				<View style={styles.quoteHeader}>
					{quoted.author.avatarUrl ? (
						<Image
							source={{ uri: quoted.author.avatarUrl }}
							style={styles.quoteAvatar}
						/>
					) : null}
					<Text
						style={[styles.quoteName, { color: c.textPrimary }]}
						numberOfLines={1}>
						{quoted.author.name}
					</Text>
					<Text
						style={[styles.quoteHandle, { color: c.textTertiary }]}
						numberOfLines={1}>
						@{quoted.author.handle}
					</Text>
				</View>
				{quoted.text ? (
					<TweetText
						text={quoted.text}
						style={[styles.quoteText, { color: c.textSecondary }]}
						numberOfLines={4}
					/>
				) : null}
				<TweetMedia media={quoted.media} />
			</View>
		);
	}

	_verb(kind: NotificationKind): string {
		if (kind === "like") return "liked your post";
		if (kind === "retweet") return "reposted your post";
		if (kind === "follow") return "followed you";
		if (kind === "mention") return "mentioned you";
		return "interacted with you";
	}

	render(): React.ReactNode {
		const c = getColors();
		const { loading, error, items, refreshing } = this.state;

		return (
			<View style={{ flex: 1, backgroundColor: c.bg }}>
				<Header
					title="Notifications"
					onBack={this.props.onBack || undefined}
				/>
				{loading ? (
					<View style={styles.center}>
						<ActivityIndicator
							size="large"
							color={c.accent}
						/>
					</View>
				) : (
					<FlatList
						ref={(ref) => {
							this._listRef = ref;
						}}
						onScroll={this._onScroll}
						scrollEventThrottle={100}
						data={items}
						keyExtractor={function (n: XNotification) {
							return n.id;
						}}
						renderItem={this._renderItem}
						refreshControl={
							<RefreshControl
								refreshing={refreshing}
								onRefresh={this._refresh}
								tintColor={c.accent}
								colors={[c.accent]}
							/>
						}
						ListEmptyComponent={
							<View style={styles.center}>
								<Icon
									name="bell"
									size={40}
									color={c.textTertiary}
								/>
								<Text style={[styles.emptyText, { color: c.textTertiary }]}>
									{error || "Nothing here yet. Mentions, likes, and follows will appear here."}
								</Text>
							</View>
						}
						initialNumToRender={10}
						maxToRenderPerBatch={10}
						windowSize={9}
						removeClippedSubviews={true}
					/>
				)}
			</View>
		);
	}
}

const styles = StyleSheet.create<{
	center: ViewStyle;
	emptyText: TextStyle;
	row: ViewStyle;
	iconCol: ViewStyle;
	body: ViewStyle;
	avatarRow: ViewStyle;
	avatar: ImageStyle;
	avatarFallback: ViewStyle;
	avatarInitial: TextStyle;
	time: TextStyle;
	text: TextStyle;
	preview: TextStyle;
	quote: ViewStyle;
	quoteHeader: ViewStyle;
	quoteAvatar: ImageStyle;
	quoteName: TextStyle;
	quoteHandle: TextStyle;
	quoteText: TextStyle;
}>({
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
	emptyText: { fontSize: 15, textAlign: "center", marginTop: 14, lineHeight: 21 },
	row: {
		flexDirection: "row",
		paddingHorizontal: 14,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth
	},
	iconCol: { width: 32, alignItems: "center", paddingTop: 2 },
	body: { flex: 1 },
	avatarRow: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
	avatar: { width: 30, height: 30, borderRadius: 15, marginRight: 6 },
	avatarFallback: { alignItems: "center", justifyContent: "center" },
	avatarInitial: { color: "#FFFFFF", fontSize: 13, fontWeight: "bold" },
	time: { fontSize: 13, marginLeft: "auto" },
	text: { fontSize: 15, lineHeight: 20 },
	preview: { fontSize: 15, lineHeight: 20, marginTop: 4 },
	quote: {
		marginTop: 8,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 14,
		padding: 10
	},
	quoteHeader: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
	quoteAvatar: { width: 18, height: 18, borderRadius: 9, marginRight: 5 },
	quoteName: { fontSize: 14, fontWeight: "700" },
	quoteHandle: { fontSize: 14, marginLeft: 4 },
	quoteText: { fontSize: 14, lineHeight: 19 }
});
