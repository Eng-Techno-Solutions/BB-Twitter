import type XAPI from "../api/xapi";
import { Header } from "../components";
import Icon from "../components/ui/Icon";
import { loadConversation, sendMessage } from "../services/dmService";
import { getColors } from "../theme";
import type { ThemeMode } from "../theme";
import type { DMConversation, DMMessage } from "../types/x";
import { errorMessage } from "../utils/error";
import { logger } from "../utils/logger";
import React, { Component } from "react";
import {
	ActivityIndicator,
	FlatList,
	StyleSheet,
	Text,
	TextInput,
	TouchableOpacity,
	View
} from "react-native";
import type { ListRenderItemInfo, TextStyle, ViewStyle } from "react-native";

export interface DMConversationProps {
	themeMode: ThemeMode;
	api: XAPI;
	conversation: DMConversation;
	currentUserId: string;
	onBack: () => void;
}

interface DMConversationState {
	messages: DMMessage[];
	loading: boolean;
	error: string | null;
	draft: string;
	sending: boolean;
}

// A single DM thread: message bubbles (mine right/accent, theirs left/muted) over
// a send bar. Sends optimistically append and reconcile on the next load.
export default class DMConversationScreen extends Component<
	DMConversationProps,
	DMConversationState
> {
	_mounted: boolean;
	_list: FlatList<DMMessage> | null;

	constructor(props: DMConversationProps) {
		super(props);
		this.state = { messages: [], loading: true, error: null, draft: "", sending: false };
		this._mounted = false;
		this._list = null;
		this._renderItem = this._renderItem.bind(this);
	}

	componentDidMount(): void {
		this._mounted = true;
		this._load();
	}

	componentWillUnmount(): void {
		this._mounted = false;
	}

	async _load(): Promise<void> {
		try {
			const messages = await loadConversation(this.props.api, this.props.conversation.id);
			if (!this._mounted) return;
			this.setState({ messages: messages, loading: false, error: null });
		} catch (err: unknown) {
			if (!this._mounted) return;
			this.setState({ loading: false, error: errorMessage(err, "Couldn't load conversation") });
		}
	}

	async _send(): Promise<void> {
		const text = this.state.draft.trim();
		if (!text || this.state.sending) return;
		this.setState({ sending: true });
		try {
			await sendMessage(this.props.api, this.props.conversation.id, text);
			if (!this._mounted) return;
			this.setState({ draft: "", sending: false });
			this._load();
		} catch (err: unknown) {
			if (!this._mounted) return;
			this.setState({ sending: false });
			logger.warn("DM.send", "send failed", err);
		}
	}

	_renderItem(info: ListRenderItemInfo<DMMessage>): React.ReactElement {
		const msg = info.item;
		const c = getColors();
		const mine = msg.senderId === this.props.currentUserId;
		return (
			<View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
				<View
					style={[
						styles.bubble,
						mine
							? { backgroundColor: c.accent, borderBottomRightRadius: 4 }
							: { backgroundColor: c.bgTertiary, borderBottomLeftRadius: 4 }
					]}>
					<Text style={[styles.bubbleText, { color: mine ? "#FFFFFF" : c.textPrimary }]}>
						{msg.text}
					</Text>
				</View>
			</View>
		);
	}

	render(): React.ReactNode {
		const c = getColors();
		const self = this;
		const { messages, loading, error, draft, sending } = this.state;
		const other = this.props.conversation.participants[0];
		const title = other ? other.name || "@" + other.handle : "Conversation";

		return (
			<View style={{ flex: 1, backgroundColor: c.bg }}>
				<Header
					title={title}
					subtitle={other && other.handle ? "@" + other.handle : undefined}
					onBack={this.props.onBack}
				/>
				{loading ? (
					<View style={styles.center}>
						<ActivityIndicator
							size="large"
							color={c.accent}
						/>
					</View>
				) : error ? (
					<View style={styles.center}>
						<Text style={{ color: c.textTertiary, fontSize: 15 }}>{error}</Text>
					</View>
				) : (
					<FlatList
						ref={function (r: FlatList<DMMessage> | null) {
							self._list = r;
						}}
						style={{ flex: 1 }}
						contentContainerStyle={styles.listContent}
						data={messages}
						keyExtractor={function (m: DMMessage) {
							return m.id;
						}}
						renderItem={this._renderItem}
						ListHeaderComponent={
							<Text style={[styles.encNotice, { color: c.textTertiary }]}>
								🔒 End-to-end encrypted (X Chat) messages can’t be shown here.
							</Text>
						}
						onContentSizeChange={function () {
							if (self._list && messages.length) self._list.scrollToEnd({ animated: false });
						}}
						initialNumToRender={20}
						windowSize={11}
					/>
				)}

				<View style={[styles.sendBar, { backgroundColor: c.bgHeader, borderTopColor: c.border }]}>
					<TextInput
						style={[
							styles.input,
							{ backgroundColor: c.bgTertiary, color: c.textPrimary, borderColor: c.borderInput }
						]}
						placeholder="Start a message"
						placeholderTextColor={c.textPlaceholder}
						value={draft}
						onChangeText={function (t: string) {
							self.setState({ draft: t });
						}}
						multiline={true}
						data-type="input"
					/>
					<TouchableOpacity
						style={[styles.sendBtn, { backgroundColor: c.accent }, !draft.trim() && styles.sendDisabled]}
						onPress={function () {
							self._send();
						}}
						disabled={!draft.trim() || sending}
						data-type="btn">
						<Icon
							name="send"
							size={18}
							color="#FFFFFF"
						/>
					</TouchableOpacity>
				</View>
			</View>
		);
	}
}

const styles = StyleSheet.create<{
	center: ViewStyle;
	encNotice: TextStyle;
	listContent: ViewStyle;
	bubbleRow: ViewStyle;
	rowMine: ViewStyle;
	rowTheirs: ViewStyle;
	bubble: ViewStyle;
	bubbleText: TextStyle;
	sendBar: ViewStyle;
	input: TextStyle;
	sendBtn: ViewStyle;
	sendDisabled: ViewStyle;
}>({
	center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
	encNotice: {
		fontSize: 12,
		textAlign: "center",
		paddingHorizontal: 24,
		paddingTop: 4,
		paddingBottom: 14,
		lineHeight: 17
	},
	listContent: { paddingVertical: 10, paddingHorizontal: 10 },
	bubbleRow: { flexDirection: "row", marginVertical: 3 },
	rowMine: { justifyContent: "flex-end" },
	rowTheirs: { justifyContent: "flex-start" },
	bubble: { maxWidth: "78%", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18 },
	bubbleText: { fontSize: 15, lineHeight: 20 },
	sendBar: {
		flexDirection: "row",
		alignItems: "flex-end",
		paddingHorizontal: 10,
		paddingVertical: 8,
		borderTopWidth: StyleSheet.hairlineWidth
	},
	input: {
		flex: 1,
		borderRadius: 20,
		borderWidth: StyleSheet.hairlineWidth,
		paddingHorizontal: 14,
		paddingVertical: 8,
		maxHeight: 100,
		fontSize: 15,
		marginRight: 8
	},
	sendBtn: {
		width: 40,
		height: 40,
		borderRadius: 20,
		alignItems: "center",
		justifyContent: "center"
	},
	sendDisabled: { opacity: 0.5 }
});
