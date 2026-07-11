import { Component } from "react";

interface IconProps {
	name: string;
	size?: number;
	color?: string;
	style?: object;
}

declare class Icon extends Component<IconProps> {}
export default Icon;
