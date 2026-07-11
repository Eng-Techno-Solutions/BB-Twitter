import type XAPI from "../api/xapi";
import { Header } from "../components";
import { TweetText } from "../components/tweet";
import Icon from "../components/ui/Icon";
import { loadNotifications } from "../services/notificationsService";
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
export default class NotificationsScreen extends Component<NotificationsProps, NotificationsState> {
	_mounted: boolean;

	constructor(props: NotificationsProps) {
		super(props);
		this.state = { items: [], loading: true, refreshing: false, error: null, nowMs: Date.now() };
		this._mounted = false;
		this._renderItem = this._renderItem.bind(this);
		this._refresh = this._refresh.bind(this);
	}

	componentDidMount(): void {
		this._mounted = true;
		this._load(false);
	}

	componentWillUnmount(): void {
		this._mounted = false;
	}

	async _load(isRefresh: boolean): Promise<void> {
		try {
			const page = await loadNotifications(this.props.api);
			if (!this._mounted) return;
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
						{item.tweet && item.tweet.text ? (
							<TweetText
								text={item.tweet.text}
								style={[styles.preview, { color: c.textTertiary }]}
								numberOfLines={2}
							/>
						) : null}
					</View>
				</View>
			</TouchableHighlight>
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
	preview: { fontSize: 14, lineHeight: 19, marginTop: 4 }
});
