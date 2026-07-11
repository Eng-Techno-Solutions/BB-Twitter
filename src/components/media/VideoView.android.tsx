import type { XMedia } from "../../types/x";
import { logger } from "../../utils/logger";
import Icon from "../ui/Icon";
import React, { Component } from "react";
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

interface VideoViewProps {
	media: XMedia;
	width: number;
	height: number;
}

// The Q20 (Android 4.3) has no in-app H.264 surface we can reach — react-native-video
// won't build against RN 0.53.3 — so we hand the stream to the OS video player. Light,
// reliable, and native. The poster + play button is the in-app affordance.
export default class VideoView extends Component<VideoViewProps> {
	_open = (): void => {
		// Only ever open a real video stream — never the poster image.
		const url = this.props.media.videoUrl;
		if (!url) return;
		Linking.openURL(url).catch(function (err: unknown) {
			logger.warn("VideoView.open", "could not open video", err);
		});
	};

	render(): React.ReactNode {
		const { media, width, height } = this.props;
		return (
			<TouchableOpacity
				activeOpacity={0.85}
				onPress={this._open}
				style={[styles.wrap, { width: width, height: height }]}>
				{media.url ? (
					<Image
						source={{ uri: media.url }}
						style={{ width: width, height: height } as ImageStyle}
						resizeMode="contain"
					/>
				) : null}
				<View style={styles.overlay}>
					<View style={styles.playCircle}>
						<Icon
							name="play"
							size={30}
							color="#FFFFFF"
						/>
					</View>
					<Text style={styles.hint}>Tap to play</Text>
				</View>
			</TouchableOpacity>
		);
	}
}

const styles = StyleSheet.create<{
	wrap: ViewStyle;
	overlay: ViewStyle;
	playCircle: ViewStyle;
	hint: TextStyle;
}>({
	wrap: { alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
	overlay: {
		position: "absolute",
		left: 0,
		right: 0,
		top: 0,
		bottom: 0,
		alignItems: "center",
		justifyContent: "center"
	},
	playCircle: {
		width: 64,
		height: 64,
		borderRadius: 32,
		backgroundColor: "rgba(0,0,0,0.6)",
		alignItems: "center",
		justifyContent: "center"
	},
	hint: { color: "#FFFFFF", fontSize: 13, marginTop: 10, opacity: 0.85 }
});
