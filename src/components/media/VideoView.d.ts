import type { XMedia } from "../../types/x";
import { Component } from "react";

// Platform-split video surface (VideoView.web.tsx / VideoView.android.tsx) with one
// shared type, mirroring the Icon module. Web plays inline; Android hands off to the
// OS player.
export interface VideoViewProps {
	media: XMedia;
	width: number;
	height: number;
}

declare class VideoView extends Component<VideoViewProps> {}
export default VideoView;
