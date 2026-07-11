package com.engtechnos.BBTwitter;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.support.v4.app.NotificationCompat;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Iterator;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLSocketFactory;

// Long-lived, self-scheduling poll service. Unlike an AlarmManager-driven
// one-shot, this keeps its own process alive and polls on a fixed cadence, so
// it survives the app being swiped from recents on BlackBerry 10's Android
// runtime (which does not reliably wake a dead process for alarms).
//
// Mirrors BBSlack's NotificationPollService one-to-one — same HandlerThread
// loop, foreground suppression, per-account diff-against-baseline, and Settings
// diagnostics — retargeted from Slack's unread-count model to X's two feeds:
// the activity notifications timeline and the DM inbox.
public class NotificationPollService extends Service {

    // X's public web-app bearer (shipped in x.com's JS, identical for every
    // user — NOT a secret). The per-user credential is the auth_token + ct0
    // pair carried in the Cookie header. Kept in sync with X_WEB_BEARER in
    // src/utils/constants.ts.
    private static final String X_BEARER =
        "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
    // Direct hosts (the web dev proxy is web-only). v2 hosts the notifications
    // timeline; v1.1 hosts the DM inbox — same split as xapi.ts.
    private static final String V2_API = "https://x.com/i/api/2/";
    private static final String V11_API = "https://api.x.com/1.1/";
    // Enrichment params for notifications/all.json, mirroring NOTIFICATION_TWEET_PARAMS
    // in xapi.ts (pre-URL-encoded). Without them X returns skeletal tweets.
    private static final String NOTIF_PARAMS =
        "include_profile_interstitial_type=1&include_blocking=1&include_blocked_by=1"
        + "&include_followed_by=1&include_want_retweets=1&include_mute_edge=1&include_can_dm=1"
        + "&include_can_media_tag=1&include_ext_is_blue_verified=1&include_ext_verified_type=1"
        + "&skip_status=1&cards_platform=Web-12&include_cards=1&include_ext_alt_text=true"
        + "&include_quote_count=true&include_reply_count=1&tweet_mode=extended"
        + "&include_ext_views=true&include_entities=true&include_user_entities=true"
        + "&include_ext_media_availability=true&send_error_codes=true&simple_quoted_tweet=true"
        + "&count=40&ext=mediaStats%2ChighlightedLabel%2CvoiceInfo%2CbirdwatchPivot"
        + "%2CsuperFollowMetadata%2CeditControl";

    private static final int BASE_NOTIF_ID = 9000;
    private static final String CHANNEL_ID = "bbtwitter_activity";
    private static final String CHANNEL_NAME = "Activity";
    private static final String TAG = "BBTwitterNotif";
    private static final long POLL_INTERVAL_MS = 2 * 60 * 1000;
    private static final int MAX_POSTS_PER_POLL = 6;
    private static final int MAX_PREVIEW_CHARS = 160;

    // lastUnreads keys are namespaced by type so the feed high-water mark and
    // per-conversation DM high-water marks share one SharedPreferences blob
    // without colliding (BBSlack used userId:channelId; we add a type prefix).
    private static final String NOTIF_HWM_PREFIX = "n:";   // n:<userId>       -> max timestampMs seen
    private static final String DM_HWM_PREFIX = "d:";       // d:<userId>:<conv> -> max entry id seen

    private HandlerThread pollThread;
    private Handler pollHandler;
    private Runnable pollLoop;
    private boolean started = false;

    @Override
    public void onCreate() {
        super.onCreate();
        pollThread = new HandlerThread("NotifPoll");
        pollThread.start();
        pollHandler = new Handler(pollThread.getLooper());
        pollLoop = new Runnable() {
            @Override
            public void run() {
                pollOnce();
                pollHandler.postDelayed(this, POLL_INTERVAL_MS);
            }
        };
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // START_STICKY re-delivers a null intent after a system kill; guard so
        // the loop is only armed once per live process.
        if (!started) {
            started = true;
            Log.d(TAG, "Poll service started");
            NotificationModule.setServiceStartedAt(this, System.currentTimeMillis());
            pollHandler.post(pollLoop);
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        Log.d(TAG, "Poll service destroyed");
        if (pollHandler != null && pollLoop != null) pollHandler.removeCallbacks(pollLoop);
        if (pollThread != null) pollThread.quit();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void pollOnce() {
        String accountsJson = NotificationModule.getAccounts(this);
        String lastUnreadsJson = NotificationModule.getLastUnreads(this);

        JSONArray accounts;
        JSONObject lastUnreads;
        try {
            accounts = new JSONArray(accountsJson);
            lastUnreads = new JSONObject(lastUnreadsJson);
        } catch (Exception e) {
            saveDiag(false, 0, new JSONArray().put("ERROR parsing stored accounts"));
            return;
        }

        Log.d(TAG, "Poll start: accounts=" + accounts.length());

        if (accounts.length() == 0) {
            saveDiag(false, 0, new JSONArray());
            return;
        }

        // While the app is in the foreground, the in-app JS badge poller already
        // refreshes counts. Skip posting to avoid duplicates, but still advance
        // the baseline so the first post-background tick has an accurate diff.
        boolean foreground = MainActivity.isForeground();
        Log.d(TAG, "foreground=" + foreground);
        boolean mentionsOnly = NotificationModule.isChannelsMentionOnly(this);
        boolean multiAccount = accounts.length() > 1;

        JSONObject newUnreads = new JSONObject();
        int[] notifIndex = new int[] { 0 };
        JSONArray results = new JSONArray();

        NotificationManager notifManager = (NotificationManager)
            getSystemService(Context.NOTIFICATION_SERVICE);
        if (notifManager == null) return;

        // Android 8.0+ silently drops any notification posted without a
        // registered channel. Register once before posting.
        ensureChannel(notifManager);

        for (int i = 0; i < accounts.length(); i++) {
            String userId = "";
            try {
                JSONObject account = accounts.getJSONObject(i);
                String authToken = account.optString("authToken", "");
                String csrf = account.optString("csrf", "");
                userId = account.optString("userId", "");
                String handle = account.optString("handle", "");
                String label = multiAccount && !handle.isEmpty() ? " — @" + handle : "";

                if (authToken.isEmpty() || csrf.isEmpty()) {
                    results.put(userId + ": ERROR missing session");
                    continue;
                }

                int postedBefore = notifIndex[0];
                // Poll each feed independently so a failure in one (endpoint down,
                // rate limit) neither blocks the other nor sinks the whole account.
                String feedResult;
                try {
                    int feedNew = pollFeed(authToken, csrf, userId, label, mentionsOnly,
                        foreground, lastUnreads, newUnreads, notifIndex);
                    feedResult = "feedNew=" + feedNew;
                } catch (Exception feedErr) {
                    feedResult = "feedERR=" + feedErr.getMessage();
                }
                String dmResult;
                try {
                    int dmNew = pollDms(authToken, csrf, userId, label,
                        foreground, lastUnreads, newUnreads, notifIndex);
                    dmResult = "dmNew=" + dmNew;
                } catch (Exception dmErr) {
                    dmResult = "dmERR=" + dmErr.getMessage();
                }

                results.put(userId + ": " + feedResult + ", " + dmResult
                    + ", posted=" + (notifIndex[0] - postedBefore)
                    + (mentionsOnly ? ", mentionsOnly" : ""));
            } catch (Exception e) {
                Log.w(TAG, "Poll failed for account " + userId, e);
                results.put(userId + ": ERROR " + e.getClass().getSimpleName()
                    + ": " + e.getMessage());
            }
        }

        saveDiag(foreground, accounts.length(), results);
        NotificationModule.setLastUnreads(this, newUnreads.toString());
    }

    // ---- Activity feed (notifications/all.json) -----------------------------

    // Diffs the notifications timeline against the per-account high-water mark
    // (max timestampMs seen). First poll seeds the baseline and posts nothing,
    // so a fresh login doesn't dump the whole backlog. Returns the count of new
    // entries seen (posted only when backgrounded).
    private int pollFeed(String authToken, String csrf, String userId, String label,
                         boolean mentionsOnly, boolean foreground,
                         JSONObject lastUnreads, JSONObject newUnreads, int[] notifIndex)
                         throws Exception {
        JSONObject response = xGet(V2_API, "notifications/all.json?" + NOTIF_PARAMS, authToken, csrf);
        JSONObject globals = response.optJSONObject("globalObjects");
        if (globals == null) return 0;
        JSONObject notifications = globals.optJSONObject("notifications");
        JSONObject tweets = globals.optJSONObject("tweets");
        if (notifications == null) notifications = new JSONObject();
        if (tweets == null) tweets = new JSONObject();

        String hwmKey = NOTIF_HWM_PREFIX + userId;
        long prevHwm = lastUnreads.optLong(hwmKey, -1);
        boolean seeding = prevHwm < 0;
        long maxSeen = prevHwm < 0 ? 0 : prevHwm;
        int newCount = 0;

        Iterator<String> ids = notifications.keys();
        while (ids.hasNext()) {
            String notifId = ids.next();
            JSONObject notif = notifications.optJSONObject(notifId);
            if (notif == null) continue;

            long ts = parseLongSafe(notif.optString("timestampMs", "0"));
            if (ts <= 0) continue;
            if (ts > maxSeen) maxSeen = ts;
            if (seeding || ts <= prevHwm) continue; // already seen (or baseline)

            String iconId = notif.optJSONObject("icon") != null
                ? notif.optJSONObject("icon").optString("id", "") : "";
            boolean isMention = iconId.contains("mention") || iconId.contains("reply");
            if (mentionsOnly && !isMention) continue;

            newCount++;
            if (foreground || notifIndex[0] >= MAX_POSTS_PER_POLL) continue;

            String title = notif.optJSONObject("message") != null
                ? notif.optJSONObject("message").optString("text", "") : "";
            if (title.isEmpty()) title = "New activity";
            String body = tweetTextFor(notif, tweets);
            if (label != null && !label.isEmpty()) title += label;

            postNotification(this, BASE_NOTIF_ID + notifIndex[0], title, body);
            notifIndex[0]++;
        }

        putLong(newUnreads, hwmKey, maxSeen);
        return newCount;
    }

    // Resolves a notification's target tweet text for the notification body.
    // The tweet id lives in template.aggregateUserActionsV1.targetObjects (or the
    // template directly); the text is the legacy tweet's full_text/text. Returns
    // "" when there's no associated tweet (e.g. a bare follow).
    private String tweetTextFor(JSONObject notif, JSONObject tweets) {
        JSONObject template = notif.optJSONObject("template");
        if (template == null) return "";
        JSONObject agg = template.optJSONObject("aggregateUserActionsV1");
        JSONObject actions = agg != null ? agg : template;
        JSONArray targets = actions.optJSONArray("targetObjects");
        String tweetId = "";
        if (targets != null) {
            for (int i = 0; i < targets.length(); i++) {
                JSONObject t = targets.optJSONObject(i);
                JSONObject tw = t != null ? t.optJSONObject("tweet") : null;
                if (tw != null && !tw.optString("id", "").isEmpty()) {
                    tweetId = tw.optString("id", "");
                    break;
                }
            }
        }
        if (tweetId.isEmpty()) return "";
        JSONObject tweet = tweets.optJSONObject(tweetId);
        if (tweet == null) return "";
        String text = tweet.optString("full_text", tweet.optString("text", ""));
        return truncate(text.trim());
    }

    // ---- Direct messages (dm/inbox_initial_state.json) ----------------------

    // Diffs each conversation's max_entry_id against its stored high-water mark.
    // Posts the newest inbound message when a conversation advances. First sight
    // of a conversation seeds silently. Returns the count of conversations that
    // advanced (posted only when backgrounded).
    private int pollDms(String authToken, String csrf, String userId, String label,
                        boolean foreground, JSONObject lastUnreads,
                        JSONObject newUnreads, int[] notifIndex) throws Exception {
        JSONObject response = xGet(V11_API,
            "dm/inbox_initial_state.json?include_conversation_info=true&dm_users=false",
            authToken, csrf);
        JSONObject root = response.optJSONObject("inbox_initial_state");
        if (root == null) return 0;
        JSONObject users = root.optJSONObject("users");
        JSONObject conversations = root.optJSONObject("conversations");
        JSONArray entries = root.optJSONArray("entries");
        if (conversations == null) return 0;
        if (users == null) users = new JSONObject();

        int newCount = 0;
        Iterator<String> convIds = conversations.keys();
        while (convIds.hasNext()) {
            String convId = convIds.next();
            JSONObject conv = conversations.optJSONObject(convId);
            if (conv == null) continue;

            long maxEntry = parseLongSafe(conv.optString("max_entry_id", "0"));
            if (maxEntry <= 0) continue;

            String hwmKey = DM_HWM_PREFIX + userId + ":" + convId;
            long prevHwm = lastUnreads.optLong(hwmKey, -1);
            putLong(newUnreads, hwmKey, maxEntry);
            if (prevHwm < 0 || maxEntry <= prevHwm) continue; // seeding or unchanged

            newCount++;
            if (foreground || notifIndex[0] >= MAX_POSTS_PER_POLL) continue;

            JSONObject latest = latestInboundMessage(entries, convId, userId);
            if (latest == null) continue;
            JSONObject data = latest.optJSONObject("message_data");
            if (data == null) continue;

            String senderId = data.optString("sender_id", "");
            String title = senderDisplayName(users, senderId);
            if (title.isEmpty()) title = "New message";
            String body = truncate(data.optString("text", "").trim());
            if (body.isEmpty()) body = "Sent a message";
            if (label != null && !label.isEmpty()) title += label;

            postNotification(this, BASE_NOTIF_ID + notifIndex[0], title, body);
            notifIndex[0]++;
        }
        return newCount;
    }

    // Newest message in a conversation authored by someone other than us. The
    // inbox entries stream is flat across all conversations, so filter by
    // conversation_id and skip our own sends (self-echo shouldn't notify).
    private JSONObject latestInboundMessage(JSONArray entries, String convId, String selfId) {
        if (entries == null) return null;
        JSONObject best = null;
        long bestTime = -1;
        for (int i = 0; i < entries.length(); i++) {
            JSONObject entry = entries.optJSONObject(i);
            JSONObject message = entry != null ? entry.optJSONObject("message") : null;
            if (message == null) continue;
            JSONObject data = message.optJSONObject("message_data");
            if (data == null) continue;
            if (!convId.equals(message.optString("conversation_id", ""))) continue;
            if (selfId.equals(data.optString("sender_id", ""))) continue;
            long time = parseLongSafe(data.optString("time", "0"));
            if (time >= bestTime) {
                bestTime = time;
                best = message;
            }
        }
        return best;
    }

    private String senderDisplayName(JSONObject users, String senderId) {
        if (senderId.isEmpty()) return "";
        JSONObject user = users.optJSONObject(senderId);
        if (user == null) return "";
        String name = user.optString("name", "");
        if (!name.isEmpty()) return name;
        String handle = user.optString("screen_name", "");
        return handle.isEmpty() ? "" : "@" + handle;
    }

    // ---- Shared helpers -----------------------------------------------------

    private String truncate(String text) {
        if (text == null) return "";
        if (text.length() > MAX_PREVIEW_CHARS) {
            return text.substring(0, MAX_PREVIEW_CHARS - 1) + "…";
        }
        return text;
    }

    private long parseLongSafe(String value) {
        try {
            return Long.parseLong(value.trim());
        } catch (Exception e) {
            return 0;
        }
    }

    private void putLong(JSONObject obj, String key, long value) {
        try {
            obj.put(key, value);
        } catch (Exception e) {
            // ignore — a single lost high-water mark just re-seeds next poll
        }
    }

    // Persist a one-line-per-account poll report so the Settings screen can
    // show what the last poll actually did — the BB10 device has no adb access,
    // so this is the only way to see failures in the field.
    private void saveDiag(boolean foreground, int accountCount, JSONArray results) {
        try {
            JSONObject diag = new JSONObject();
            diag.put("at", System.currentTimeMillis());
            diag.put("foreground", foreground);
            diag.put("accounts", accountCount);
            diag.put("results", results);
            NotificationModule.setLastPollDiag(this, diag.toString());
        } catch (Exception e) {
            // Diagnostics must never break polling
        }
    }

    // X's cookie-authed GET, mirroring xapi.ts#_headers on native (static bearer
    // + ct0 csrf header + auth_token/ct0 cookie). Throws with a specific reason
    // (TLS failure, HTTP code) so pollOnce can surface it in diagnostics.
    private JSONObject xGet(String base, String pathAndQuery, String authToken, String csrf)
            throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(base + pathAndQuery);
            conn = (HttpURLConnection) url.openConnection();

            if (conn instanceof HttpsURLConnection) {
                SSLSocketFactory factory = Tls12SocketFactory.create();
                if (factory != null) {
                    ((HttpsURLConnection) conn).setSSLSocketFactory(factory);
                }
            }

            conn.setRequestMethod("GET");
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(15000);
            conn.setRequestProperty("Authorization", X_BEARER);
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("x-csrf-token", csrf);
            conn.setRequestProperty("x-twitter-auth-type", "OAuth2Session");
            conn.setRequestProperty("x-twitter-active-user", "yes");
            conn.setRequestProperty("x-twitter-client-language", "en");
            conn.setRequestProperty("Cookie", "auth_token=" + authToken + "; ct0=" + csrf);

            int code = conn.getResponseCode();
            if (code != 200) throw new Exception("HTTP " + code);

            BufferedReader reader = new BufferedReader(
                new InputStreamReader(conn.getInputStream(), "UTF-8")
            );
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
            reader.close();

            return new JSONObject(sb.toString());
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    static void ensureChannel(NotificationManager manager) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_HIGH
        );
        channel.enableVibration(true);
        manager.createNotificationChannel(channel);
    }

    // Static so NotificationModule's "send test notification" goes through the
    // exact same posting path as real polls.
    static void postNotification(Context context, int id, String title, String body) {
        NotificationManager manager = (NotificationManager)
            context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        ensureChannel(manager);

        Intent launchIntent = new Intent(context, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            context, id, launchIntent, PendingIntent.FLAG_UPDATE_CURRENT
        );

        Notification notification = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .build();

        manager.notify(id, notification);
    }
}
