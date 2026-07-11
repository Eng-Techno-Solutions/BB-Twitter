package com.engtechnos.BBTwitter;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import org.json.JSONObject;

public class NotificationModule extends ReactContextBaseJavaModule {

    private static final String PREFS_NAME = "BBTwitterNotifPrefs";
    private static final String KEY_ACCOUNTS = "accounts";
    private static final String KEY_LAST_UNREADS = "lastUnreads";
    private static final String KEY_SERVICE_STARTED_AT = "serviceStartedAt";
    private static final String KEY_LAST_POLL_DIAG = "lastPollDiag";
    private static final String KEY_CHANNELS_MENTION_ONLY = "channelsMentionOnly";
    private static final String KEY_USER_NAMES = "userNames";
    private static final int TEST_NOTIF_ID = 8999;

    public NotificationModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "NotificationModule";
    }

    @ReactMethod
    public void setAccounts(String accountsJson) {
        Context context = getReactApplicationContext();
        getPrefs().edit()
            .putString(KEY_ACCOUNTS, accountsJson)
            .apply();
        // Tie the poll service lifetime to having at least one account.
        // Starting here means a fresh login covers the swipe-kill case (where
        // AppState=background is never delivered before the process dies).
        if (accountsJson == null || accountsJson.equals("[]")) {
            stopPollService(context);
        } else {
            startPollService(context);
        }
    }

    @ReactMethod
    public void startBackgroundPolling() {
        startPollService(getReactApplicationContext());
    }

    @ReactMethod
    public void stopBackgroundPolling() {
        stopPollService(getReactApplicationContext());
    }

    // When enabled, background polls only notify for channels on @mentions;
    // DMs and group DMs always notify on any new message.
    @ReactMethod
    public void setChannelsMentionOnly(boolean enabled) {
        getPrefs().edit().putBoolean(KEY_CHANNELS_MENTION_ONLY, enabled).apply();
    }

    // Posts a notification through the exact same path the poll service uses,
    // so the user can verify the notification → BB10 Hub pipeline on-device.
    @ReactMethod
    public void sendTestNotification() {
        NotificationPollService.postNotification(
            getReactApplicationContext(), TEST_NOTIF_ID,
            "BB Twitter test", "If you can read this, notifications reach the OS."
        );
    }

    // Returns the poll service's self-reported status. The BB10 device can't
    // be attached to adb in the field, so Settings surfaces this instead.
    @ReactMethod
    public void getDiagnostics(Promise promise) {
        try {
            Context context = getReactApplicationContext();
            SharedPreferences prefs =
                context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            JSONObject diag = new JSONObject();
            diag.put("serviceStartedAt", prefs.getLong(KEY_SERVICE_STARTED_AT, 0));
            diag.put("lastPoll", new JSONObject(prefs.getString(KEY_LAST_POLL_DIAG, "{}")));
            diag.put("now", System.currentTimeMillis());
            promise.resolve(diag.toString());
        } catch (Exception e) {
            promise.reject("DIAG_ERROR", e.getMessage());
        }
    }

    static void startPollService(Context context) {
        context.startService(new Intent(context, NotificationPollService.class));
    }

    static void stopPollService(Context context) {
        context.stopService(new Intent(context, NotificationPollService.class));
    }

    private SharedPreferences getPrefs() {
        return getReactApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    public static String getAccounts(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_ACCOUNTS, "[]");
    }

    public static String getLastUnreads(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_LAST_UNREADS, "{}");
    }

    public static void setLastUnreads(Context context, String unreadsJson) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(KEY_LAST_UNREADS, unreadsJson).apply();
    }

    public static boolean isChannelsMentionOnly(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_CHANNELS_MENTION_ONLY, false);
    }

    // userId -> display name cache so message previews don't re-hit users.info
    // for senders we've already resolved.
    public static String getUserNames(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_USER_NAMES, "{}");
    }

    public static void setUserNames(Context context, String namesJson) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(KEY_USER_NAMES, namesJson).apply();
    }

    public static void setServiceStartedAt(Context context, long timestamp) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putLong(KEY_SERVICE_STARTED_AT, timestamp).apply();
    }

    public static void setLastPollDiag(Context context, String diagJson) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(KEY_LAST_POLL_DIAG, diagJson).apply();
    }
}
