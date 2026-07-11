import type XAPI from "../api/xapi";
import { Header } from "../components";
import Icon from "../components/ui/Icon";
import { loadInbox } from "../services/dmService";
import { getView, saveView, setScrollOffset } from "../services/viewCache";
import { getColors } from "../theme";
import type { ThemeMode } from "../theme";
import type { DMConversation, XUser } from "../types/x";
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

export interface MessagesProps {
	themeMode: ThemeMode;
	api: XAPI;
	currentUser: XUser | null;
	onBack: (() => void) | null;
	onOpenConversation: (conversation: DMConversation) => void;
}

interface MessagesState {
	conversations: DMConversation[];
	loading: boolean;
	refreshing: boolean;
	error: string | null;
	nowMs: number;
}

// DM inbox — one row per conversation (other party's avatar + name + last-message
// preview + time). Tapping opens the conversation. Best-effort against X's DM
// inbox endpoint; degrades to an empty state.
// Cache key: the DM inbox is per-account and single-page, so one key suffices.
const CACHE_KEY = "messages";

export default class MessagesScreen extends Component<MessagesProps, MessagesState> {
	_mounted: boolean;
	_listRef: FlatList<DMConversation> | null;
	_restoreOffset: number;

	constructor(props: MessagesProps) {
		super(props);
		// Warm cache → render synchronously, no spinner, no refetch, position kept.
		const cached = getView<DMConversation>(CACHE_KEY);
		this.state = {
			conversations: cached ? cached.data : [],
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
		// Cache hit: restore scroll, no refetch (pull to refresh gets new messages).
		if (this.state.conversations.length > 0) {
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
		const selfId = this.props.currentUser ? this.props.currentUser.id : "";
		try {
			const conversations = await loadInbox(this.props.api, selfId);
			if (!this._mounted) return;
			saveView(CACHE_KEY, conversations);
			this.setState({
				conversations: conversations,
				loading: false,
				refreshing: false,
				error: null,
				nowMs: Date.now()
			});
		} catch (err: unknown) {
			if (!this._mounted) return;
			if (isRefresh) {
				this.setState({ refreshing: false });
				logger.warn("Messages.refresh", "refresh failed", err);
			} else {
				this.setState({ loading: false, error: errorMessage(err, "Couldn't load messages") });
			}
		}
	}

	_refresh(): void {
		this.setState({ refreshing: true });
		this._load(true);
	}

	_renderItem(info: ListRenderItemInfo<DMConversation>): React.ReactElement {
		const conv = info.item;
		const c = getColors();
		const self = this;
		const other = conv.participants[0];
		const title = other ? other.name || "@" + other.handle : "Conversation";
		const preview = conv.lastMessage ? conv.lastMessage.text : "";

		return (
			<TouchableHighlight
				underlayColor={c.messageUnderlay}
				onPress={function () {
					self.props.onOpenConversation(conv);
				}}
				data-type="dm-row">
				<View style={[styles.row, { backgroundColor: c.bg, borderBottomColor: c.border }]}>
					{other && other.avatarUrl ? (
						<Image
							source={{ uri: other.avatarUrl }}
							style={styles.avatar}
						/>
					) : (
						<View
							style={[
								styles.avatar,
								styles.avatarFallback,
								{ backgroundColor: getAvatarColor(other ? other.id : "0") }
							]}>
							<Text style={styles.avatarInitial}>{title.charAt(0).toUpperCase()}</Text>
						</View>
					)}
					<View style={styles.body}>
						<View style={styles.topLine}>
							<Text
								style={[styles.name, { color: c.textPrimary }, conv.unread && { fontWeight: "800" }]}
								numberOfLines={1}>
								{title}
							</Text>
							{conv.lastMessage ? (
								<Text style={[styles.time, { color: c.textTertiary }]}>
									{relativeTime(conv.lastMessage.createdAt * 1000, this.state.nowMs)}
								</Text>
							) : null}
						</View>
						<Text
							style={[styles.preview, { color: conv.unread ? c.textPrimary : c.textTertiary }]}
							numberOfLines={1}>
							{preview}
						</Text>
					</View>
					{conv.unread ? <View style={[styles.unreadDot, { backgroundColor: c.accent }]} /> : null}
				</View>
			</TouchableHighlight>
		);
	}

	render(): React.ReactNode {
		const c = getColors();
		const { loading, error, conversations, refreshing } = this.state;
		return (
			<View style={{ flex: 1, backgroundColor: c.bg }}>
				<Header
					title="Messages"
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
						data={conversations}
						keyExtractor={function (conv: DMConversation) {
							return conv.id;
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
									name="mail"
									size={40}
									color={c.textTertiary}
								/>
								<Text style={[styles.emptyText, { color: c.textTertiary }]}>
									{error || "No messages yet."}
								</Text>
							</View>
						}
						initialNumToRender={12}
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
	avatar: ImageStyle;
	avatarFallback: ViewStyle;
	avatarInitial: TextStyle;
	body: ViewStyle;
	topLine: ViewStyle;
	name: TextStyle;
	time: TextStyle;
	preview: TextStyle;
	unreadDot: ViewStyle;
}>({
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
	emptyText: { fontSize: 15, textAlign: "center", marginTop: 14, lineHeight: 21 },
	row: {
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 14,
		paddingVertical: 12,
		borderBottomWidth: StyleSheet.hairlineWidth
	},
	avatar: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
	avatarFallback: { alignItems: "center", justifyContent: "center" },
	avatarInitial: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
	body: { flex: 1 },
	topLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
	name: { fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
	time: { fontSize: 13 },
	preview: { fontSize: 14, marginTop: 2 },
	unreadDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 }
});
