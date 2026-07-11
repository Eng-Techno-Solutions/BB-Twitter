export function errorMessage(err: unknown, fallback: string): string {
	if (err instanceof Error) return err.message || fallback;
	if (typeof err === "string") return err || fallback;
	return fallback;
}
