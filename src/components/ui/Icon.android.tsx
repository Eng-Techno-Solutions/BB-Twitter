import type { IconProps } from "./types";
import React from "react";
import FeatherIcon from "react-native-vector-icons/Feather";

const ICON_MAP: Record<string, string> = {
	"chevron-down": "chevron-down",
	"chevron-left": "chevron-left",
	"chevron-right": "chevron-right",
	close: "x",
	lock: "lock",
	search: "search",
	send: "send",
	hash: "hash",
	info: "info",
	"log-out": "log-out",
	"message-square": "message-square",
	reply: "corner-up-left",
	"thumbs-up": "thumbs-up",
	heart: "heart",
	eye: "eye",
	check: "check",
	edit: "edit-2",
	trash: "trash-2",
	play: "play",
	pause: "pause",
	smile: "smile",
	sun: "sun",
	moon: "moon",
	paperclip: "paperclip",
	mic: "mic",
	square: "square",
	settings: "settings",
	bell: "bell",
	"refresh-cw": "refresh-cw",
	globe: "globe",
	user: "user",
	coffee: "coffee",
	smartphone: "smartphone",
	"external-link": "external-link",
	menu: "menu",
	plus: "plus",
	x: "x",
	// X (Twitter) actions and tabs
	"message-circle": "message-circle",
	repeat: "repeat",
	bookmark: "bookmark",
	share: "share",
	"more-horizontal": "more-horizontal",
	"arrow-left": "arrow-left",
	home: "home",
	mail: "mail",
	"bar-chart": "bar-chart-2",
	image: "image",
	camera: "camera",
	"user-plus": "user-plus",
	"user-check": "user-check",
	"badge-check": "check-circle"
};

function Icon({ name, size, color }: IconProps): React.ReactElement | null {
	const s = size || 20;
	const c = color || "#D1D2D3";
	const iconName = ICON_MAP[name];

	if (!iconName) return null;

	return (
		<FeatherIcon
			name={iconName}
			size={s}
			color={c}
		/>
	);
}

export default Icon;
