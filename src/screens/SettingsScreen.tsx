import { Header, Icon } from "../components";
import { getColors } from "../theme";
import type { FontSizeKey, ThemeMode } from "../theme";
import React, { Component } from "react";
import { ScrollView, StyleSheet, Switch, Text, TouchableHighlight, View } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

export interface SettingsProps {
	themeMode: ThemeMode;
	notifEnabled: boolean;
	soundEnabled: boolean;
	fontSize: FontSizeKey;
	onToggleTheme: () => void;
	onToggleNotif: () => void;
	onToggleSound: () => void;
	onChangeFontSize: (size: FontSizeKey) => void;
	onBookmarks: () => void;
	onLogout: () => void;
	onBack: () => void;
}

const FONT_SIZES: FontSizeKey[] = ["small", "medium", "large"];

// Settings: theme, font size, notifications, sound, and sign out. Pure
// presentation — every change is delegated up to App, which owns the state and
// persistence (Separation of Concerns).
export default class SettingsScreen extends Component<SettingsProps> {
	_renderToggleRow(
		label: string,
		value: boolean,
		onToggle: () => void,
		c: ReturnType<typeof getColors>
	): React.ReactNode {
		return (
			<View style={[styles.row, { borderBottomColor: c.border }]}>
				<Text style={[styles.rowLabel, { color: c.textPrimary }]}>{label}</Text>
				<Switch
					value={value}
					onValueChange={onToggle}
					trackColor={{ true: c.accent, false: c.border }}
				/>
			</View>
		);
	}

	render(): React.ReactNode {
		const c = getColors();
		const self = this;
		const { themeMode, notifEnabled, soundEnabled, fontSize } = this.props;

		return (
			<View style={{ flex: 1, backgroundColor: c.bg }}>
				<Header
					title="Settings"
					onBack={this.props.onBack}
				/>
				<ScrollView style={{ flex: 1 }}>
					<Text style={[styles.section, { color: c.textTertiary }]}>DISPLAY</Text>
					<View style={[styles.row, { borderBottomColor: c.border }]}>
						<Text style={[styles.rowLabel, { color: c.textPrimary }]}>Dark mode</Text>
						<Switch
							value={themeMode === "dark"}
							onValueChange={this.props.onToggleTheme}
							trackColor={{ true: c.accent, false: c.border }}
						/>
					</View>

					<View style={[styles.rowColumn, { borderBottomColor: c.border }]}>
						<Text style={[styles.rowLabel, { color: c.textPrimary, marginBottom: 10 }]}>Font size</Text>
						<View style={styles.segment}>
							{FONT_SIZES.map(function (size: FontSizeKey) {
								const active = size === fontSize;
								return (
									<TouchableHighlight
										key={size}
										style={[
											styles.segmentItem,
											{ borderColor: c.border },
											active && { backgroundColor: c.accent, borderColor: c.accent }
										]}
										underlayColor={c.messageUnderlay}
										onPress={function () {
											self.props.onChangeFontSize(size);
										}}
										data-type="btn">
										<Text style={[styles.segmentText, { color: active ? "#FFFFFF" : c.textSecondary }]}>
											{size.charAt(0).toUpperCase() + size.slice(1)}
										</Text>
									</TouchableHighlight>
								);
							})}
						</View>
					</View>

					<Text style={[styles.section, { color: c.textTertiary }]}>NOTIFICATIONS</Text>
					{this._renderToggleRow("Enable notifications", notifEnabled, this.props.onToggleNotif, c)}
					{this._renderToggleRow("Notification sound", soundEnabled, this.props.onToggleSound, c)}

					<Text style={[styles.section, { color: c.textTertiary }]}>ACCOUNT</Text>
					<TouchableHighlight
						style={[styles.row, { borderBottomColor: c.border }]}
						underlayColor={c.messageUnderlay}
						onPress={this.props.onBookmarks}
						data-type="btn">
						<View style={styles.logoutRow}>
							<Icon
								name="bookmark"
								size={18}
								color={c.textSecondary}
							/>
							<Text style={[styles.rowLabel, { color: c.textPrimary, marginLeft: 10 }]}>Bookmarks</Text>
						</View>
					</TouchableHighlight>
					<TouchableHighlight
						style={[styles.row, { borderBottomColor: c.border }]}
						underlayColor={c.messageUnderlay}
						onPress={this.props.onLogout}
						data-type="btn">
						<View style={styles.logoutRow}>
							<Icon
								name="log-out"
								size={18}
								color={c.error}
							/>
							<Text style={[styles.rowLabel, { color: c.error, marginLeft: 10 }]}>Sign out</Text>
						</View>
					</TouchableHighlight>
				</ScrollView>
			</View>
		);
	}
}

const styles = StyleSheet.create<{
	section: TextStyle;
	row: ViewStyle;
	rowColumn: ViewStyle;
	rowLabel: TextStyle;
	segment: ViewStyle;
	segmentItem: ViewStyle;
	segmentText: TextStyle;
	logoutRow: ViewStyle;
}>({
	section: {
		fontSize: 12,
		fontWeight: "700",
		marginTop: 20,
		marginBottom: 6,
		marginHorizontal: 16,
		letterSpacing: 0.5
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: StyleSheet.hairlineWidth
	},
	rowColumn: {
		paddingHorizontal: 16,
		paddingVertical: 14,
		borderBottomWidth: StyleSheet.hairlineWidth
	},
	rowLabel: { fontSize: 15 },
	segment: { flexDirection: "row" },
	segmentItem: {
		flex: 1,
		alignItems: "center",
		paddingVertical: 9,
		borderWidth: 1,
		marginRight: 8,
		borderRadius: 8
	},
	segmentText: { fontSize: 14, fontWeight: "600" },
	logoutRow: { flexDirection: "row", alignItems: "center" }
});
