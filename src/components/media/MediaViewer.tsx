import type { XMedia } from "../../types/x";
import Icon from "../ui/Icon";
import VideoView from "./VideoView";
import React, { Component } from "react";
import {
	Dimensions,
	Image,
	Modal,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View
} from "react-native";
import type {
	ImageStyle,
	NativeScrollEvent,
	NativeSyntheticEvent,
	TextStyle,
	ViewStyle
} from "react-native";

export interface MediaViewerProps {
	media: XMedia[];
	index: number;
	onClose: () => void;
}

interface MediaViewerState {
	current: number;
}

const SCREEN = Dimensions.get("window");
const PAGE_W: number = SCREEN.width;
const PAGE_H: number = SCREEN.height;

// Fullscreen media preview: a horizontal paged strip over a black backdrop. Photos
// render contained; videos delegate to the platform VideoView (inline on web, OS
// player on the Q20). Mounted only while open, so the Modal has zero cost when idle.
//
// Deliberately a plain ScrollView, NOT a FlatList: react-native-web's VirtualizedList
// recycles cells on re-render (e.g. when the page counter updates), which remounts an
// in-flight <video> and resets playback. A viewer holds at most 4 items, so rendering
// them all once keeps each media element's identity stable.
export default class MediaViewer extends Component<MediaViewerProps, MediaViewerState> {
	_scroll: ScrollView | null;

	constructor(props: MediaViewerProps) {
		super(props);
		this.state = { current: props.index || 0 };
		this._scroll = null;
		this._onScrollEnd = this._onScrollEnd.bind(this);
	}

	componentDidMount(): void {
		// Jump to the tapped item without animation (contentOffset isn't reliable on
		// first paint across platforms; an imperative scroll is).
		const index = this.props.index || 0;
		if (index > 0 && this._scroll) {
			this._scroll.scrollTo({ x: PAGE_W * index, y: 0, animated: false });
		}
	}

	_onScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>): void {
		const x = e.nativeEvent.contentOffset.x;
		const current = Math.round(x / PAGE_W);
		if (current !== this.state.current) this.setState({ current: current });
	}

	_renderPage(m: XMedia, i: number): React.ReactElement {
		const isVideo = m.type === "video" || m.type === "animated_gif";
		return (
			<View
				key={i}
				style={styles.page}>
				{isVideo ? (
					<VideoView
						media={m}
						width={PAGE_W}
						height={PAGE_H}
					/>
				) : (
					<Image
						source={{ uri: m.url }}
						style={styles.image}
						resizeMode="contain"
					/>
				)}
			</View>
		);
	}

	render(): React.ReactNode {
		const { media, onClose } = this.props;
		const hasMultiple = media.length > 1;
		const self = this;
		return (
			<Modal
				visible={true}
				transparent={false}
				animationType="none"
				onRequestClose={onClose}>
				<View style={styles.backdrop}>
					<ScrollView
						ref={function (r: ScrollView | null) {
							self._scroll = r;
						}}
						horizontal={true}
						pagingEnabled={true}
						showsHorizontalScrollIndicator={false}
						onMomentumScrollEnd={this._onScrollEnd}>
						{media.map(function (m: XMedia, i: number) {
							return self._renderPage(m, i);
						})}
					</ScrollView>

					<View style={styles.topBar}>
						<TouchableOpacity
							style={styles.closeBtn}
							onPress={onClose}
							activeOpacity={0.7}
							data-type="btn">
							<Icon
								name="close"
								size={24}
								color="#FFFFFF"
							/>
						</TouchableOpacity>
						{hasMultiple ? (
							<View style={styles.counter}>
								<Text style={styles.counterText}>
									{this.state.current + 1} / {media.length}
								</Text>
							</View>
						) : null}
					</View>
				</View>
			</Modal>
		);
	}
}

const styles = StyleSheet.create<{
	backdrop: ViewStyle;
	page: ViewStyle;
	image: ImageStyle;
	topBar: ViewStyle;
	closeBtn: ViewStyle;
	counter: ViewStyle;
	counterText: TextStyle;
}>({
	backdrop: { flex: 1, backgroundColor: "#000", justifyContent: "center" },
	page: { width: PAGE_W, height: PAGE_H, alignItems: "center", justifyContent: "center" },
	image: { width: PAGE_W, height: PAGE_H },
	topBar: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		height: 56,
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 8
	},
	closeBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
	counter: { marginLeft: "auto", marginRight: 12 },
	counterText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" }
});
