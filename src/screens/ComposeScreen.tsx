import type XAPI from "../api/xapi";
import { TweetText } from "../components/tweet";
import Icon from "../components/ui/Icon";
import { pickAndUploadImage } from "../services/mediaService";
import type { AttachedMedia } from "../services/mediaService";
import { getColors } from "../theme";
import type { ThemeMode } from "../theme";
import type { Tweet, XUser } from "../types/x";
import { getAvatarColor } from "../utils/avatar";
import { errorMessage } from "../utils/error";
import { logger } from "../utils/logger";
import React, { Component } from "react";
import {
	ActivityIndicator,
	Image,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View
} from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

export type ComposeMode = "tweet" | "reply" | "quote";

export interface ComposeProps {
	themeMode: ThemeMode;
	api: XAPI;
	currentUser: XUser | null;
	mode: ComposeMode;
	target?: Tweet;
	onClose: () => void;
	onPosted: () => void;
}

interface ComposeState {
	text: string;
	posting: boolean;
	error: string | null;
	media: AttachedMedia | null;
	attaching: boolean;
}

const MAX_LEN = 280;
// Turn amber as the user nears the limit, red past it — X's counter behavior.
const WARN_REMAINING = 20;

export default class ComposeScreen extends Component<ComposeProps, ComposeState> {
	constructor(props: ComposeProps) {
		super(props);
		this.state = { text: "", posting: false, error: null, media: null, attaching: false };
	}

	// A post is valid with text OR an attached image (X allows media-only posts).
	_canPost(): boolean {
		const len = this.state.text.trim().length;
		const hasContent = (len > 0 || this.state.media !== null) && len <= MAX_LEN;
		return hasContent && !this.state.posting && !this.state.attaching;
	}

	async _attach(): Promise<void> {
		if (this.state.attaching || this.state.media) return;
		this.setState({ attaching: true, error: null });
		try {
			const media = await pickAndUploadImage(this.props.api);
			this.setState({ media: media, attaching: false });
		} catch (err: unknown) {
			logger.warn("Compose.attach", "attach failed", err);
			this.setState({ attaching: false, error: errorMessage(err, "Couldn't attach image.") });
		}
	}

	_removeMedia = (): void => {
		this.setState({ media: null });
	};

	async _post(): Promise<void> {
		if (!this._canPost()) return;
		const { api, mode, target } = this.props;
		const text = this.state.text.trim();
		this.setState({ posting: true, error: null });
		try {
			const replyToId = mode === "reply" && target ? target.id : undefined;
			const quoteId = mode === "quote" && target ? target.id : undefined;
			const mediaIds = this.state.media ? [this.state.media.mediaId] : undefined;
			await api.createTweet(text, replyToId, quoteId, mediaIds);
			this.props.onPosted();
		} catch (err: unknown) {
			this.setState({ posting: false, error: errorMessage(err, "Couldn't post. Try again.") });
		}
	}

	_counterColor(remaining: number, c: ReturnType<typeof getColors>): string {
		if (remaining < 0) return c.error;
		if (remaining <= WARN_REMAINING) return "#FFD400";
		return c.textTertiary;
	}

	render(): React.ReactNode {
		const c = getColors();
		const self = this;
		const { mode, target, currentUser } = this.props;
		const { text, posting, error } = this.state;
		const remaining = MAX_LEN - text.length;
		const postLabel = mode === "reply" ? "Reply" : "Post";

		return (
			<View style={{ flex: 1, backgroundColor: c.bg }}>
				<View style={[styles.bar, { backgroundColor: c.bgHeader, borderBottomColor: c.border }]}>
					<TouchableOpacity
						onPress={this.props.onClose}
						style={styles.barBtn}
						data-type="header-btn">
						<Text style={[styles.cancel, { color: c.textSecondary }]}>Cancel</Text>
					</TouchableOpacity>
					<TouchableOpacity
						onPress={function () {
							self._post();
						}}
						disabled={!this._canPost()}
						style={[
							styles.postBtn,
							{ backgroundColor: c.accent },
							!this._canPost() && styles.postBtnDisabled
						]}
						data-type="btn">
						{posting ? (
							<ActivityIndicator
								size="small"
								color="#FFFFFF"
							/>
						) : (
							<Text style={styles.postLabel}>{postLabel}</Text>
						)}
					</TouchableOpacity>
				</View>

				<ScrollView
					style={{ flex: 1 }}
					contentContainerStyle={styles.body}
					keyboardShouldPersistTaps="handled">
					{mode === "reply" && target ? (
						<Text style={[styles.replyingTo, { color: c.textTertiary }]}>
							Replying to <Text style={{ color: c.accent }}>@{target.author.handle}</Text>
						</Text>
					) : null}

					<View style={styles.inputRow}>
						{currentUser && currentUser.avatarUrl ? (
							<Image
								source={{ uri: currentUser.avatarUrl }}
								style={styles.avatar}
							/>
						) : (
							<View
								style={[
									styles.avatar,
									styles.avatarFallback,
									{ backgroundColor: getAvatarColor(currentUser ? currentUser.id : "0") }
								]}>
								<Text style={styles.avatarInitial}>
									{(currentUser ? currentUser.name || currentUser.handle : "?").charAt(0).toUpperCase()}
								</Text>
							</View>
						)}
						<TextInput
							style={[styles.input, { color: c.textPrimary }]}
							placeholder={mode === "reply" ? "Post your reply" : "What's happening?"}
							placeholderTextColor={c.textPlaceholder}
							value={text}
							onChangeText={function (t: string) {
								self.setState({ text: t });
							}}
							multiline={true}
							autoFocus={true}
							textAlignVertical="top"
							data-type="input"
						/>
					</View>

					{mode === "quote" && target ? (
						<View style={[styles.quote, { borderColor: c.border }]}>
							<Text
								style={[styles.quoteName, { color: c.textPrimary }]}
								numberOfLines={1}>
								{target.author.name}{" "}
								<Text style={{ color: c.textTertiary, fontWeight: "400" }}>@{target.author.handle}</Text>
							</Text>
							<TweetText
								text={target.text}
								style={[styles.quoteText, { color: c.textSecondary }]}
								numberOfLines={4}
							/>
						</View>
					) : null}

					{this.state.media ? (
						<View style={styles.mediaWrap}>
							<Image
								source={{ uri: this.state.media.previewUri }}
								style={[styles.mediaPreview, { borderColor: c.border }]}
								resizeMode="cover"
							/>
							<TouchableOpacity
								style={styles.mediaRemove}
								onPress={this._removeMedia}
								data-type="icon-btn">
								<Icon
									name="close"
									size={16}
									color="#FFFFFF"
								/>
							</TouchableOpacity>
						</View>
					) : null}

					{error ? <Text style={[styles.error, { color: c.error }]}>{error}</Text> : null}
				</ScrollView>

				<View style={[styles.footer, { borderTopColor: c.border, backgroundColor: c.bgHeader }]}>
					<TouchableOpacity
						style={styles.attachBtn}
						onPress={function () {
							self._attach();
						}}
						disabled={this.state.attaching || this.state.media !== null}
						data-type="icon-btn">
						{this.state.attaching ? (
							<ActivityIndicator
								size="small"
								color={c.accent}
							/>
						) : (
							<Icon
								name="image"
								size={22}
								color={this.state.media ? c.textTertiary : c.accent}
							/>
						)}
					</TouchableOpacity>
					<Text style={[styles.counter, { color: this._counterColor(remaining, c) }]}>{remaining}</Text>
				</View>
			</View>
		);
	}
}

const styles = StyleSheet.create<{
	bar: ViewStyle;
	barBtn: ViewStyle;
	cancel: TextStyle;
	postBtn: ViewStyle;
	postBtnDisabled: ViewStyle;
	postLabel: TextStyle;
	body: ViewStyle;
	replyingTo: TextStyle;
	inputRow: ViewStyle;
	avatar: ImageStyle;
	avatarFallback: ViewStyle;
	avatarInitial: TextStyle;
	input: TextStyle;
	quote: ViewStyle;
	quoteName: TextStyle;
	quoteText: TextStyle;
	mediaWrap: ViewStyle;
	mediaPreview: ImageStyle;
	mediaRemove: ViewStyle;
	error: TextStyle;
	footer: ViewStyle;
	attachBtn: ViewStyle;
	counter: TextStyle;
}>({
	bar: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderBottomWidth: StyleSheet.hairlineWidth
	},
	barBtn: { padding: 4 },
	cancel: { fontSize: 15 },
	postBtn: {
		paddingHorizontal: 16,
		paddingVertical: 7,
		borderRadius: 18,
		minWidth: 64,
		alignItems: "center"
	},
	postBtnDisabled: { opacity: 0.5 },
	postLabel: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
	body: { padding: 14 },
	replyingTo: { fontSize: 14, marginBottom: 10 },
	inputRow: { flexDirection: "row" },
	avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 10 },
	avatarFallback: { alignItems: "center", justifyContent: "center" },
	avatarInitial: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
	input: { flex: 1, fontSize: 18, lineHeight: 24, minHeight: 120, paddingTop: 8 },
	quote: { marginTop: 12, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 10 },
	quoteName: { fontSize: 14, fontWeight: "700" },
	quoteText: { fontSize: 14, lineHeight: 19, marginTop: 2 },
	mediaWrap: { marginTop: 12, alignSelf: "flex-start" },
	mediaPreview: { width: 160, height: 160, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
	mediaRemove: {
		position: "absolute",
		top: 6,
		right: 6,
		width: 26,
		height: 26,
		borderRadius: 13,
		backgroundColor: "rgba(0,0,0,0.7)",
		alignItems: "center",
		justifyContent: "center"
	},
	error: { fontSize: 14, marginTop: 12 },
	footer: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 8,
		borderTopWidth: StyleSheet.hairlineWidth
	},
	attachBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
	counter: { fontSize: 14, fontWeight: "600" }
});
