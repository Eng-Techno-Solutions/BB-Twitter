import { getColors } from "../../theme";
import type { XMedia } from "../../types/x";
import MediaViewer from "./MediaViewer";
import React, { Component } from "react";
import { Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { ImageStyle, TextStyle, ViewStyle } from "react-native";

export interface TweetMediaProps {
	media: XMedia[];
	// Available content width. Defaults to the feed-row content column; the focal
	// tweet passes a wider value.
	width?: number;
}

interface TweetMediaState {
	open: boolean;
	index: number;
}

const SCREEN_W: number = Dimensions.get("window").width;
const FEED_CONTENT_W: number = SCREEN_W - 12 * 2 - 40 - 10; // matches TweetItem layout

// Tappable media thumbnails that own their own fullscreen viewer. Self-contained so
// any surface (feed row, focal tweet, quote) gets preview + playback with no state
// wiring. The MediaViewer Modal mounts only while open, so idle rows stay cheap — the
// parent row's PureComponent guard is unaffected because this manages its own state.
export default class TweetMedia extends Component<TweetMediaProps, TweetMediaState> {
	constructor(props: TweetMediaProps) {
		super(props);
		this.state = { open: false, index: 0 };
		this._close = this._close.bind(this);
	}

	_openAt(index: number): void {
		this.setState({ open: true, index: index });
	}

	_close(): void {
		this.setState({ open: false });
	}

	_renderBadge(m: XMedia): React.ReactNode {
		if (m.type !== "video" && m.type !== "animated_gif") return null;
		return (
			<View style={styles.badge}>
				<Text style={styles.badgeText}>{m.type === "animated_gif" ? "GIF" : "▶"}</Text>
			</View>
		);
	}

	_renderThumb(m: XMedia, index: number, style: ImageStyle, border: string): React.ReactElement {
		const self = this;
		return (
			<TouchableOpacity
				key={index}
				activeOpacity={0.85}
				onPress={function () {
					self._openAt(index);
				}}
				data-type="tweet-media">
				<View style={[styles.tile, { borderColor: border }]}>
					<Image
						source={{ uri: m.url }}
						style={style}
						resizeMode="cover"
					/>
					{self._renderBadge(m)}
				</View>
			</TouchableOpacity>
		);
	}

	render(): React.ReactNode {
		const { media } = this.props;
		if (!media || media.length === 0) return null;
		const c = getColors();
		const width = this.props.width || FEED_CONTENT_W;
		const single: ImageStyle = { width: width, height: Math.round(width * 0.56) };
		const gridItem: ImageStyle = {
			width: (width - 2) / 2,
			height: Math.round(width * 0.4),
			margin: 1
		};

		let body: React.ReactNode;
		if (media.length === 1) {
			body = this._renderThumb(media[0], 0, single, c.border);
		} else {
			const shown = media.slice(0, 4);
			const rows: XMedia[][] = [];
			for (let i = 0; i < shown.length; i += 2) rows.push(shown.slice(i, i + 2));
			const self = this;
			body = rows.map(function (pair: XMedia[], r: number) {
				return (
					<View
						key={r}
						style={styles.gridRow}>
						{pair.map(function (m: XMedia, i: number) {
							return self._renderThumb(m, r * 2 + i, gridItem, c.border);
						})}
					</View>
				);
			});
		}

		return (
			<View style={styles.wrap}>
				{body}
				{this.state.open ? (
					<MediaViewer
						media={media}
						index={this.state.index}
						onClose={this._close}
					/>
				) : null}
			</View>
		);
	}
}

const styles = StyleSheet.create<{
	wrap: ViewStyle;
	tile: ViewStyle;
	gridRow: ViewStyle;
	badge: ViewStyle;
	badgeText: TextStyle;
}>({
	wrap: { marginTop: 8 },
	tile: { borderRadius: 14, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
	gridRow: { flexDirection: "row" },
	badge: {
		position: "absolute",
		bottom: 8,
		left: 8,
		paddingHorizontal: 6,
		paddingVertical: 2,
		borderRadius: 4,
		backgroundColor: "rgba(0,0,0,0.7)"
	},
	badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "600" }
});
