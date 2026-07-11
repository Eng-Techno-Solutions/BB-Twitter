import { StyleSheet } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

export const styles = StyleSheet.create({
	container: { flex: 1 } as ViewStyle,

	tabStrip: {
		flexDirection: "row",
		borderBottomWidth: StyleSheet.hairlineWidth
	} as ViewStyle,
	tab: {
		flex: 1,
		alignItems: "center",
		paddingVertical: 12
	} as ViewStyle,
	tabLabel: { fontSize: 14, fontWeight: "600" } as TextStyle,
	tabUnderline: {
		position: "absolute",
		bottom: 0,
		height: 3,
		width: 56,
		borderRadius: 2
	} as ViewStyle,

	listContent: { paddingBottom: 72 } as ViewStyle,

	centerFill: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 } as ViewStyle,
	emptyText: { fontSize: 15, textAlign: "center", marginTop: 12 } as TextStyle,
	footerLoader: { paddingVertical: 20, alignItems: "center" } as ViewStyle,

	// Floating compose button (BB10 action-bar accent), bottom-right above tabs.
	fab: {
		position: "absolute",
		right: 16,
		bottom: 84,
		width: 52,
		height: 52,
		borderRadius: 26,
		alignItems: "center",
		justifyContent: "center",
		elevation: 4
	} as ViewStyle
});
