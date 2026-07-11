declare module "react-native-vector-icons/Feather" {
	import { Component } from "react";
	interface IconProps {
		name: string;
		size?: number;
		color?: string;
		style?: object;
	}
	export default class Icon extends Component<IconProps> {}
}

declare module "lucide-react/dist/esm/icons/*" {
	import type { FC, SVGProps } from "react";
	const Icon: FC<SVGProps<SVGSVGElement>>;
	export default Icon;
}

declare module "react-native-sound" {
	class Sound {
		static setCategory(category: string): void;
		constructor(
			filename: string,
			basePath: string | undefined,
			callback?: (error: Error | null) => void
		);
		play(callback?: (success: boolean) => void): void;
		pause(): void;
		stop(): void;
		release(): void;
		setVolume(value: number): void;
		getDuration(): number;
		getCurrentTime(callback: (seconds: number) => void): void;
		setNumberOfLoops(loops: number): void;
	}
	export default Sound;
}

declare module "react-native-fs" {
	export const DocumentDirectoryPath: string;
	export const CachesDirectoryPath: string;
	export function writeFile(filepath: string, contents: string, encoding?: string): Promise<void>;
	export function readFile(filepath: string, encoding?: string): Promise<string>;
	export function exists(filepath: string): Promise<boolean>;
	export function unlink(filepath: string): Promise<void>;
	export function mkdir(filepath: string): Promise<void>;
}

declare module "*.jpg" {
	const value: number;
	export default value;
}

declare module "*.png" {
	const value: number;
	export default value;
}
