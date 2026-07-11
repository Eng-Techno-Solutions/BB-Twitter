export interface KeyEvent {
	keyCode?: number;
	action: string;
	[key: string]: unknown;
}

export type KeyEventCallback = (event: KeyEvent) => void;

export interface KeySub {
	remove(): void;
}
