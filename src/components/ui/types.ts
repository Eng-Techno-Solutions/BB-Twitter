import type { TextStyle, ViewStyle } from "react-native";

export interface HeaderProps {
	title: string;
	subtitle?: string;
	onBack?: () => void;
	rightLabel?: string;
	rightIcon?: string;
	onRight?: () => void;
}

export interface HeaderStyles {
	header: ViewStyle;
	left: ViewStyle;
	center: ViewStyle;
	right: ViewStyle;
	backBtn: ViewStyle;
	title: TextStyle;
	subtitle: TextStyle;
	rightBtn: ViewStyle;
	rightText: TextStyle;
}

export interface IconProps {
	name: string;
	size?: number;
	color?: string;
	style?: object;
}
