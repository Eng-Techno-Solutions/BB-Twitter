import type { XMedia } from "../../types/x";
import { logger } from "../../utils/logger";
import React, { Component } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import type { TextStyle, ViewStyle } from "react-native";

interface VideoViewProps {
	media: XMedia;
	width: number;
	height: number;
}

// Web plays inline through the browser's native HTML5 <video>, streaming straight from
// video.twimg.com. That CDN 403s a non-x.com Referer, so the page sets a no-referrer
// policy (public/index.html) — the browser then sends no Referer and the CDN serves
// 206, giving native range/seek/buffering with no dev proxy in the path. We only ever
// hand <video> a progressive mp4 (media.videoUrl) — never the poster image, which would
// trip the "no supported format" error. GIFs (X serves them as silent looping mp4)
// autoplay muted; real videos show controls. Tweets X offers only as HLS have no mp4
// variant, so we show the poster with a note instead of a broken player.
export default class VideoView extends Component<VideoViewProps> {
	// MEDIA_ERR_ABORTED (code 1) fires when a fetch is cancelled (e.g. a transient
	// remount). It's benign — ignore it so it doesn't surface as an uncaught error;
	// log anything genuinely broken.
	_onError = (e: React.SyntheticEvent<HTMLVideoElement>): void => {
		const err = e.currentTarget.error;
		if (err && err.code === 1) return;
		logger.warn("VideoView.web", "media error", err ? err.code : null);
	};

	render(): React.ReactNode {
		const { media, width, height } = this.props;
		const src = media.videoUrl;
		const isGif = media.type === "animated_gif";

		if (!src) {
			return (
				<View style={[styles.fallback, { width: width, height: height }]}>
					{media.url ? (
						<Image
							source={{ uri: media.url }}
							style={{ width: width, height: height, opacity: 0.4 }}
							resizeMode="contain"
						/>
					) : null}
					<Text style={styles.fallbackText}>This video can’t be played here.</Text>
				</View>
			);
		}

		return (
			<video
				src={src}
				poster={media.url}
				controls={!isGif}
				autoPlay={isGif}
				loop={isGif}
				muted={isGif}
				playsInline={true}
				preload="metadata"
				onError={this._onError}
				style={{ width: width, height: height, backgroundColor: "#000", objectFit: "contain" }}
			/>
		);
	}
}

const styles = StyleSheet.create<{ fallback: ViewStyle; fallbackText: TextStyle }>({
	fallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
	fallbackText: {
		position: "absolute",
		color: "#FFFFFF",
		fontSize: 14,
		textAlign: "center",
		paddingHorizontal: 20
	}
});
