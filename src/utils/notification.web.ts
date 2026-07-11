export function startNotificationService(
	_token: string,
	_userId: string,
	_usersMap: Record<string, unknown>,
	_intervalMs?: number
): void {}
export function stopNotificationService(): void {}
export function setAppForeground(_foreground?: boolean): void {}
export function showNotification(_title?: string, _body?: string, _channelId?: string): void {}
export function cancelAllNotifications(): void {}
export function clearUnreadTracking(): void {}
