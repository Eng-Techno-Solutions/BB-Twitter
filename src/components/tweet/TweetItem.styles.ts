import { StyleSheet } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

const AVATAR = 40;
const H_PAD = 12;
const GUTTER = 10;

export const styles = StyleSheet.create({
	container: {
		paddingHorizontal: H_PAD,
		paddingTop: 8,
		paddingBottom: 6,
		borderBottomWidth: StyleSheet.hairlineWidth
	} as ViewStyle,
	repostAttr: {
		flexDirection: "row",
		alignItems: "center",
		marginLeft: AVATAR + GUTTER - 4,
		marginBottom: 2
	} as ViewStyle,
	repostAttrText: { fontSize: 12, fontWeight: "600", marginLeft: 6 } as TextStyle,

	row: { flexDirection: "row" } as ViewStyle,
	avatarCol: { width: AVATAR, marginRight: GUTTER } as ViewStyle,
	avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2 } as ImageStyle,
	avatarFallback: { justifyContent: "center", alignItems: "center" } as ViewStyle,
	avatarInitial: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" } as TextStyle,

	contentCol: { flex: 1 } as ViewStyle,
	headerRow: { flexDirection: "row", alignItems: "center" } as ViewStyle,
	name: { fontSize: 15, fontWeight: "700" } as TextStyle,
	verified: { marginLeft: 3 } as ViewStyle,
	handle: { fontSize: 15, marginLeft: 5, flexShrink: 1 } as TextStyle,
	dot: { fontSize: 15, marginHorizontal: 4 } as TextStyle,
	time: { fontSize: 15 } as TextStyle,
	moreBtn: { marginLeft: "auto", paddingLeft: 8, paddingVertical: 2 } as ViewStyle,

	replyingTo: { fontSize: 14, marginTop: 1 } as TextStyle,
	text: { fontSize: 15, lineHeight: 20, marginTop: 2 } as TextStyle,

	quote: {
		marginTop: 8,
		borderWidth: StyleSheet.hairlineWidth,
		borderRadius: 14,
		padding: 10
	} as ViewStyle,
	quoteHeader: { flexDirection: "row", alignItems: "center", marginBottom: 2 } as ViewStyle,
	quoteAvatar: { width: 18, height: 18, borderRadius: 9, marginRight: 5 } as ImageStyle,
	quoteName: { fontSize: 14, fontWeight: "700" } as TextStyle,
	quoteHandle: { fontSize: 14, marginLeft: 4 } as TextStyle,
	quoteText: { fontSize: 14, lineHeight: 19 } as TextStyle,

	actionRow: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 10,
		paddingRight: 12
	} as ViewStyle,
	action: { flexDirection: "row", alignItems: "center", minWidth: 44, minHeight: 32 } as ViewStyle,
	actionCount: { fontSize: 13, marginLeft: 6 } as TextStyle
});
