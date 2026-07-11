# Real-Time Notifications: RTM + Background Polling

## Overview

BBTwitter uses two notification mechanisms:

- **Foreground (app open):** Slack RTM WebSocket for instant message delivery
- **Background (app closed):** Native Android service polls Slack API directly, shows system notifications

No external server, no Firebase, no third-party app required. The device talks to Slack directly.

```
FOREGROUND (app open)
  BBTwitter App ←──WebSocket──→ Slack RTM API

BACKGROUND (app closed)
  AlarmManager (every 2 min)
      │
      ▼
  NotificationPollService
      │ polls Slack conversations.list per account
      ▼
  Compares with last known unread state
      │ new unreads detected
      ▼
  Android system notification
```

Works with all workspaces automatically — polls every registered account.

## Part 1: In-App RTM (automatic)

RTM connects automatically after login. No setup required. The Settings screen shows the RTM connection status under "About > Real-time".

When RTM is connected:
- Messages arrive instantly in open chats
- Channel polling slows to 5 minutes (safety net)
- Chat/thread polling slows to 60 seconds (safety net)

When RTM disconnects (network issues), the app automatically:
- Reverts to normal polling intervals
- Attempts reconnection with exponential backoff (1s → 2s → 4s → ... → 30s max)

On Android, RTM disconnects when the app goes to background and reconnects on foreground.

## Part 2: Background Push Notifications

### How It Works

1. **App goes to background** → `AlarmManager` starts, fires every 2 minutes
2. **Each alarm** → triggers `NotificationPollService` (IntentService)
3. **Service reads accounts** from `SharedPreferences` (synced from RN on login/logout)
4. **For each account** → calls `conversations.list` Slack API with the user's token
5. **Compares unread counts** with last stored state
6. **New unreads detected** → shows native Android notification with channel name and count
7. **App returns to foreground** → AlarmManager stops, RTM reconnects
8. **Device reboot** → `BootReceiver` re-registers the AlarmManager

### Setup

**No setup required.** Background notifications work automatically after login.

- Login to one or more workspaces
- Background the app
- Notifications appear within ~2 minutes of new messages

### Settings

In the app's Settings screen:
- **Push Notifications** toggle — enables/disables background polling
- **Notification Sound** toggle — enables/disables notification sound
- **Check Interval** — controls foreground polling interval (background always uses 2 min)

## Android Native Components

| File | Purpose |
|------|---------|
| `NotificationModule.java` | RN bridge — syncs account tokens to SharedPreferences, starts/stops AlarmManager |
| `NotificationAlarmReceiver.java` | BroadcastReceiver triggered by AlarmManager every 2 minutes |
| `NotificationPollService.java` | IntentService — polls Slack API per account, compares unreads, shows notifications |
| `BootReceiver.java` | Re-registers AlarmManager on device reboot |

### Data Flow

```
RN App.tsx (login)
  │ syncAccountsToNative(accounts)
  ▼
SharedPreferences (BBTwitterNotifPrefs)
  │ accounts: JSON array of {token, teamName, userId, ...}
  │ lastUnreads: JSON map of "userId:channelId" → unreadCount
  ▼
NotificationPollService reads on each alarm tick
```

### Manifest Permissions

```xml
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.VIBRATE" />
```

## Troubleshooting

### Background notifications not appearing
- Check Settings > Push Notifications is enabled
- Verify you're logged into at least one workspace
- On some devices, battery optimization kills background services — whitelist BBTwitter in battery settings
- Check that the device has internet connectivity in background

### Notifications delayed
- AlarmManager fires every 2 minutes — this is the expected maximum delay
- Android may batch alarms for battery efficiency
- On BB Q20 (Android 4.x), `setRepeating` is exact — no batching

### Duplicate notifications after reboot
- BootReceiver re-registers AlarmManager automatically
- If you see duplicates, the previous alarm wasn't properly cancelled — restart the app once to reset

### RTM not connecting
- RTM requires the `rtm:stream` scope — this is available on classic Slack apps
- If using a new-style Slack app, RTM may not be available; the app falls back to polling
- Check Settings > About > Real-time for connection status

### RTM keeps disconnecting
- This is normal on unreliable networks — the client reconnects automatically
- On Android, RTM intentionally disconnects in background to save battery
