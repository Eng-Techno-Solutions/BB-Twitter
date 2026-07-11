import { Dimensions, StyleSheet } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

const SCREEN_W: number = Dimensions.get("window").width;
const AVATAR = 40;
const H_PAD = 12;
const GUTTER = 10;
// Width available to the tweet content column (used to size media).
export const CONTENT_W: number = SCREEN_W - H_PAD * 2 - AVATAR - GUTTER;

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

	mediaWrap: {
		marginTop: 8,
		borderRadius: 14,
		overflow: "hidden",
		borderWidth: StyleSheet.hairlineWidth
	} as ViewStyle,
	mediaSingle: { width: CONTENT_W, height: Math.round(CONTENT_W * 0.56) } as ImageStyle,
	mediaGridRow: { flexDirection: "row" } as ViewStyle,
	mediaGridItem: {
		width: (CONTENT_W - 2) / 2,
		height: Math.round(CONTENT_W * 0.4),
		margin: 1
	} as ImageStyle,
	videoBadge: {
		position: "absolute",
		bottom: 8,
		left: 8,
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
		backgroundColor: "rgba(0,0,0,0.7)"
	} as ViewStyle,
	videoBadgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" } as TextStyle,

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
