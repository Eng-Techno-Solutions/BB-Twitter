import { getColors } from "../../theme";
import Icon from "../ui/Icon";
import React, { Component } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

export interface RepostMenuProps {
	// When true the tweet is already reposted, so the primary action becomes "Undo repost".
	retweeted: boolean;
	onRepost: () => void;
	onQuote: () => void;
	onClose: () => void;
}

// The Repost/Quote chooser shown when the repeat icon is tapped — mirrors X's
// repost menu. Presentational only: it renders a BB10-style bottom sheet and
// reports the picked action upward, so the same control serves the feed row and
// the focal tweet. Mounted only while open (parent gates it), so it costs nothing
// idle and keeps TweetItem's PureComponent guard untouched (no per-row state).
export default class RepostMenu extends Component<RepostMenuProps> {
	render(): React.ReactNode {
		const { retweeted, onRepost, onQuote, onClose } = this.props;
		const c = getColors();
		return (
			<Modal
				visible={true}
				transparent={true}
				animationType="fade"
				onRequestClose={onClose}>
				<TouchableOpacity
					style={styles.backdrop}
					activeOpacity={1}
					onPress={onClose}>
					<View style={[styles.sheet, { backgroundColor: c.bg, borderTopColor: c.border }]}>
						<TouchableOpacity
							style={styles.row}
							onPress={onRepost}
							activeOpacity={0.6}
							data-type="btn">
							<Icon
								name="repeat"
								size={20}
								color={retweeted ? c.retweet : c.textPrimary}
							/>
							<Text style={[styles.label, { color: c.textPrimary }]}>
								{retweeted ? "Undo repost" : "Repost"}
							</Text>
						</TouchableOpacity>

						<View style={[styles.divider, { backgroundColor: c.border }]} />

						<TouchableOpacity
							style={styles.row}
							onPress={onQuote}
							activeOpacity={0.6}
							data-type="btn">
							<Icon
								name="edit"
								size={20}
								color={c.textPrimary}
							/>
							<Text style={[styles.label, { color: c.textPrimary }]}>Quote</Text>
						</TouchableOpacity>
					</View>
				</TouchableOpacity>
			</Modal>
		);
	}
}

const styles = StyleSheet.create<{
	backdrop: ViewStyle;
	sheet: ViewStyle;
	row: ViewStyle;
	label: TextStyle;
	divider: ViewStyle;
}>({
	backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
	sheet: { borderTopWidth: StyleSheet.hairlineWidth, paddingBottom: 24, paddingTop: 8 },
	row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 22, height: 54 },
	label: { fontSize: 16, fontWeight: "600", marginLeft: 18 },
	divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 }
});
