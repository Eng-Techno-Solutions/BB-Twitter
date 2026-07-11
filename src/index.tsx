import App from "./App";
import { AppRegistry } from "react-native";

AppRegistry.registerComponent("BBTwitter", () => App);
AppRegistry.runApplication("BBTwitter", {
	rootTag: document.getElementById("root")
});
