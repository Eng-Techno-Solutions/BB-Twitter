import { getColors } from "../../theme";
import React from "react";
import { StyleSheet, Text, TouchableHighlight, View } from "react-native";

type Props = {
	title?: string;
	message: string;
	retryLabel?: string;
	onRetry?: () => void;
};

export default function ErrorView(props: Props): React.ReactElement {
	const colors = getColors();
	const title = props.title || "Something went wrong";
	const retryLabel = props.retryLabel || "Try again";
	return (
		<View style={[styles.container, { backgroundColor: colors.bgSplash }]}>
			<Text style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
			<Text style={[styles.message, { color: colors.textTertiary }]}>{props.message}</Text>
			{props.onRetry ? (
				<TouchableHighlight
					style={[styles.button, { backgroundColor: colors.accent }]}
					underlayColor={colors.accentLight}
					onPress={props.onRetry}>
					<Text style={styles.buttonText}>{retryLabel}</Text>
				</TouchableHighlight>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 24
	},
	title: {
		fontSize: 18,
		fontWeight: "600",
		marginBottom: 8
	},
	message: {
		fontSize: 14,
		textAlign: "center",
		marginBottom: 24
	},
	button: {
		paddingHorizontal: 20,
		paddingVertical: 10,
		borderRadius: 6
	},
	buttonText: {
		color: "#FFFFFF",
		fontSize: 14,
		fontWeight: "600"
	}
});
