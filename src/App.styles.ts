import type { AppStyles as Styles } from "./types";
import { StyleSheet } from "react-native";

export const styles = StyleSheet.create<Styles>({
	app: {
		flex: 1
	},
	splash: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center"
	}
});
