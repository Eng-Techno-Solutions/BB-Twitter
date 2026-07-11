import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
	container: {
		justifyContent: "center",
		padding: 24,
		paddingTop: 40,
		paddingBottom: 40,
		minHeight: "100%"
	},
	backBtn: {
		alignSelf: "flex-start",
		borderRadius: 6,
		marginBottom: 12
	},
	backBtnInner: {
		flexDirection: "row",
		alignItems: "center",
		padding: 6
	},
	backBtnText: {
		fontSize: 15,
		marginLeft: 4
	},
	logo: {
		fontSize: 32,
		fontWeight: "bold",
		textAlign: "center"
	},
	subtitle: {
		fontSize: 13,
		textAlign: "center",
		marginTop: 4,
		marginBottom: 24
	},
	tabs: {
		flexDirection: "row",
		marginBottom: 20
	},
	tab: {
		flex: 1,
		paddingVertical: 10,
		alignItems: "center",
		borderWidth: 1,
		borderRadius: 4,
		marginHorizontal: 4
	},
	tabText: {
		fontSize: 14,
		fontWeight: "bold"
	},
	form: {},
	label: {
		fontSize: 14,
		fontWeight: "bold",
		marginBottom: 6
	},
	workspaceRow: {
		flexDirection: "row",
		alignItems: "center",
		marginBottom: 14
	},
	workspaceInput: {
		flex: 1,
		marginBottom: 0
	},
	workspaceSuffix: {
		fontSize: 14,
		marginLeft: 8
	},
	input: {
		fontSize: 15,
		paddingHorizontal: 14,
		paddingVertical: 12,
		borderRadius: 4,
		borderWidth: 1,
		marginBottom: 14
	},
	button: {
		paddingVertical: 14,
		borderRadius: 4,
		alignItems: "center"
	},
	buttonDisabled: {
		opacity: 0.5
	},
	buttonFocused: {
		borderWidth: 2,
		borderColor: "#1264A3"
	},
	buttonText: {
		color: "#ffffff",
		fontSize: 16,
		fontWeight: "bold"
	},
	hint: {
		fontSize: 12,
		lineHeight: 18
	},
	instructions: {
		marginTop: 20,
		padding: 14,
		borderWidth: 1,
		borderRadius: 4
	},
	instructionsTitle: {
		fontSize: 14,
		fontWeight: "bold",
		marginBottom: 10
	},
	step: {
		fontSize: 12,
		lineHeight: 20,
		marginBottom: 4
	},
	linkButton: {
		marginTop: 12,
		paddingVertical: 10,
		borderRadius: 4,
		borderWidth: 1,
		alignItems: "center"
	},
	linkButtonText: {
		fontSize: 14,
		fontWeight: "bold"
	},
	error: {
		color: "#E01E5A",
		fontSize: 13,
		textAlign: "center",
		marginTop: 12
	},
	footer: {
		fontSize: 11,
		textAlign: "center",
		marginTop: 24
	}
});
