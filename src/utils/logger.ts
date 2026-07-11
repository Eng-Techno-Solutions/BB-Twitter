import { errorMessage } from "./error";

type LogLevel = "warn" | "error" | "info";

function emit(level: LogLevel, scope: string, message: string, err?: unknown): void {
	const detail = err === undefined ? "" : ` :: ${errorMessage(err, "unknown")}`;
	const line = `[${scope}] ${message}${detail}`;
	if (level === "error") {
		console.error(line);
	} else if (level === "warn") {
		console.warn(line);
	} else {
		console.info(line);
	}
}

export const logger = {
	warn(scope: string, message: string, err?: unknown): void {
		emit("warn", scope, message, err);
	},
	error(scope: string, message: string, err?: unknown): void {
		emit("error", scope, message, err);
	},
	info(scope: string, message: string): void {
		emit("info", scope, message);
	}
};
