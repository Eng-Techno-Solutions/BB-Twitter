import { getColors } from "../../theme";
import type { TabKey } from "../../types/app";
import Icon from "./Icon";
import React, { Component } from "react";
import { StyleSheet, Text, TouchableHighlight, View } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

export interface TabBarProps {
	activeTab: TabKey;
	unreadNotifications: number;
	onSelect: (tab: TabKey) => void;
}

const TABS: Array<{ key: TabKey; icon: string }> = [
	{ key: "home", icon: "home" },
	{ key: "search", icon: "search" },
	{ key: "notifications", icon: "bell" },
	{ key: "messages", icon: "mail" },
	{ key: "profile", icon: "user" }
];

// The five primary destinations as a bottom action bar — the BB10 signature
// placement (actions at the bottom, thumb-reachable), also D-pad reachable.
// Presentational; re-renders only when the active tab or badge changes.
export default class TabBar extends Component<TabBarProps> {
	shouldComponentUpdate(next: TabBarProps): boolean {
		return (
			this.props.activeTab !== next.activeTab ||
			this.props.unreadNotifications !== next.unreadNotifications
		);
	}

	render(): React.ReactNode {
		const c = getColors();
		const self = this;
		const { activeTab, unreadNotifications } = this.props;
		return (
			<View style={[styles.bar, { backgroundColor: c.bgHeader, borderTopColor: c.border }]}>
				{TABS.map(function (t: { key: TabKey; icon: string }) {
					const active = t.key === activeTab;
					const showBadge = t.key === "notifications" && unreadNotifications > 0;
					return (
						<TouchableHighlight
							key={t.key}
							style={styles.tab}
							underlayColor={c.messageUnderlay}
							onPress={function () {
								self.props.onSelect(t.key);
							}}
							data-type="tab-btn">
							<View style={styles.tabInner}>
								<Icon
									name={t.icon}
									size={23}
									color={active ? c.accent : c.tabText}
								/>
								{showBadge ? (
									<View style={[styles.badge, { backgroundColor: c.badgeBg }]}>
										<Text style={styles.badgeText}>
											{unreadNotifications > 99 ? "99+" : String(unreadNotifications)}
										</Text>
									</View>
								) : null}
							</View>
						</TouchableHighlight>
					);
				})}
			</View>
		);
	}
}

const styles = StyleSheet.create<{
	bar: ViewStyle;
	tab: ViewStyle;
	tabInner: ViewStyle;
	badge: ViewStyle;
	badgeText: TextStyle;
}>({
	bar: {
		flexDirection: "row",
		borderTopWidth: StyleSheet.hairlineWidth,
		paddingBottom: 2
	},
	tab: { flex: 1, alignItems: "center", paddingVertical: 10 },
	tabInner: { alignItems: "center", justifyContent: "center" },
	badge: {
		position: "absolute",
		top: -4,
		right: -10,
		minWidth: 16,
		height: 16,
		borderRadius: 8,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: 3
	},
	badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" }
});
