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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLSocketFactory;

// Long-lived, self-scheduling poll service. Unlike an AlarmManager-driven
// one-shot, this keeps its own process alive and polls on a fixed cadence, so
// it survives the app being swiped from recents on BlackBerry 10's Android
// runtime (which does not reliably wake a dead process for alarms).
public class NotificationPollService extends Service {

    private static final String SLACK_API = "https://slack.com/api/";
    private static final int BASE_NOTIF_ID = 9000;
    private static final String CHANNEL_ID = "bbslack_messages";
    private static final String CHANNEL_NAME = "Messages";
    private static final String TAG = "BBTwitterNotif";
    private static final long POLL_INTERVAL_MS = 2 * 60 * 1000;
    // conversations.info is Tier 3 (50+/min); this cap keeps one poll cycle
    // inside a single minute's budget.
    private static final int MAX_DMS_PER_POLL = 40;
    private static final int MAX_PREVIEW_CHARS = 160;
    private static final Pattern MENTION_PATTERN = Pattern.compile("<@([A-Z0-9]+)(\\|[^>]*)?>");

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

        // While the app is in the foreground, the in-app JS poller and RTM
        // socket already deliver updates. Skip notifications to avoid duplicates,
        // but still refresh the baseline so the first post-background tick has
        // an accurate diff.
        boolean foreground = MainActivity.isForeground();
        Log.d(TAG, "foreground=" + foreground);

        JSONObject newUnreads = new JSONObject();
        int notifIndex = 0;
        JSONArray results = new JSONArray();

        JSONObject nameCache;
        try {
            nameCache = new JSONObject(NotificationModule.getUserNames(this));
        } catch (Exception e) {
            nameCache = new JSONObject();
        }

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
                String token = account.optString("token", "");
                String teamName = account.optString("teamName", "");
                userId = account.optString("userId", "");

                if (token.isEmpty()) {
                    results.put(userId + ": ERROR empty token");
                    continue;
                }

                JSONArray channels = fetchConversations(token);
                Log.d(TAG, "Fetched " + channels.length() + " conversations for " + userId);

                // users.counts (the endpoint Slack's own mobile clients used —
                // same undocumented family as the auth.signin login this app
                // already relies on) returns unread counts for channels,
                // groups, and DMs in a single call. If the token is rejected,
                // fall back to per-DM conversations.info, which is documented
                // but covers DMs only.
                JSONObject countsById;
                String mode;
                try {
                    countsById = fetchAllCounts(token);
                    mode = NotificationModule.isChannelsMentionOnly(this)
                        ? "counts/mentions" : "counts";
                } catch (Exception countsError) {
                    countsById = fetchDmCounts(token, channels);
                    mode = "dm-only (counts: " + countsError.getMessage() + ")";
                }

                int unreadConvos = 0;
                int postedBefore = notifIndex;

                for (int j = 0; j < channels.length(); j++) {
                    JSONObject ch = channels.getJSONObject(j);
                    String channelId = ch.optString("id", "");
                    int unreadCount = countsById.optInt(channelId, 0);
                    if (unreadCount <= 0) continue;

                    boolean isIm = ch.optBoolean("is_im", false);
                    boolean isMpim = ch.optBoolean("is_mpim", false);
                    if (!isIm && !isMpim && !ch.optBoolean("is_member", false)) continue;

                    unreadConvos++;
                    String key = userId + ":" + channelId;
                    int prevCount = lastUnreads.optInt(key, 0);

                    try {
                        newUnreads.put(key, unreadCount);
                    } catch (Exception e) {
                        // ignore
                    }

                    if (!foreground && unreadCount > prevCount) {
                        int newMessages = unreadCount - prevCount;
                        String channelName = "#" + ch.optString("name", channelId);
                        String title = isIm ? "New DM" : (isMpim ? "Group DM" : channelName);
                        String body = newMessages + " new message" + (newMessages > 1 ? "s" : "");

                        // Best-effort: show who wrote what instead of a bare
                        // count. Only runs for conversations that just gained
                        // unreads, so it adds at most a couple of calls per poll.
                        String[] preview = fetchMessagePreview(token, channelId, nameCache);
                        if (preview != null) {
                            String sender = preview[0];
                            String text = preview[1];
                            if (isIm || isMpim) {
                                if (!sender.isEmpty()) title = sender + (isMpim ? " (group)" : "");
                                body = text;
                            } else {
                                body = sender.isEmpty() ? text : sender + ": " + text;
                            }
                            if (newMessages > 1) {
                                body += " (+" + (newMessages - 1) + " more)";
                            }
                        }

                        if (!teamName.isEmpty()) title += " — " + teamName;
                        postNotification(this, BASE_NOTIF_ID + notifIndex, title, body);
                        notifIndex++;
                    }
                }

                results.put(userId + ": " + channels.length() + " convos, mode="
                    + mode + ", unread=" + unreadConvos
                    + ", posted=" + (notifIndex - postedBefore));
            } catch (Exception e) {
                Log.w(TAG, "Poll failed for account " + userId, e);
                results.put(userId + ": ERROR " + e.getClass().getSimpleName()
                    + ": " + e.getMessage());
            }
        }

        saveDiag(foreground, accounts.length(), results);
        NotificationModule.setLastUnreads(this, newUnreads.toString());
        NotificationModule.setUserNames(this, nameCache.toString());
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

    private JSONArray fetchConversations(String token) throws Exception {
        JSONObject response = slackGet(token,
            "conversations.list?types=public_channel,private_channel,mpim,im"
            + "&exclude_archived=true&limit=200");
        JSONArray channels = response.optJSONArray("channels");
        if (channels == null) throw new Exception("Slack API: no channels array");
        return channels;
    }

    private JSONObject fetchConversationInfo(String token, String channelId) throws Exception {
        JSONObject response = slackGet(token, "conversations.info?channel=" + channelId);
        JSONObject channel = response.optJSONObject("channel");
        if (channel == null) throw new Exception("Slack API: no channel object");
        return channel;
    }

    // users.counts is undocumented; parse defensively. Returns a flat map of
    // conversation id -> unread count across channels, groups, mpims, and ims.
    // When the user enables mentions-only, channels and groups count only
    // @mentions; DMs and group DMs always count every message.
    private JSONObject fetchAllCounts(String token) throws Exception {
        JSONObject response = slackGet(token, "users.counts?mpim_aware=true");
        boolean mentionOnly = NotificationModule.isChannelsMentionOnly(this);
        JSONObject countsById = new JSONObject();
        mergeCounts(countsById, response.optJSONArray("channels"), mentionOnly);
        mergeCounts(countsById, response.optJSONArray("groups"), mentionOnly);
        mergeCounts(countsById, response.optJSONArray("mpims"), false);
        mergeCounts(countsById, response.optJSONArray("ims"), false);
        return countsById;
    }

    private void mergeCounts(JSONObject countsById, JSONArray entries, boolean mentionOnly) {
        if (entries == null) return;
        for (int i = 0; i < entries.length(); i++) {
            JSONObject entry = entries.optJSONObject(i);
            if (entry == null) continue;
            String id = entry.optString("id", "");
            if (id.isEmpty()) continue;
            int count;
            if (mentionOnly) {
                count = entry.optInt("mention_count_display", entry.optInt("mention_count", 0));
            } else {
                // Field name varies by conversation type: channels/groups use
                // unread_count_display, ims use dm_count.
                count = entry.optInt("unread_count_display",
                    entry.optInt("dm_count", entry.optInt("mention_count_display", 0)));
            }
            if (count <= 0) continue;
            try {
                countsById.put(id, count);
            } catch (Exception e) {
                // ignore
            }
        }
    }

    // Documented fallback: conversations.info exposes unread_count_display for
    // DMs/group DMs only, one call per conversation.
    private JSONObject fetchDmCounts(String token, JSONArray channels) {
        JSONObject countsById = new JSONObject();
        int checked = 0;
        for (int i = 0; i < channels.length(); i++) {
            JSONObject ch = channels.optJSONObject(i);
            if (ch == null) continue;
            if (!ch.optBoolean("is_im", false) && !ch.optBoolean("is_mpim", false)) continue;
            if (checked >= MAX_DMS_PER_POLL) break;
            checked++;

            String channelId = ch.optString("id", "");
            try {
                JSONObject info = fetchConversationInfo(token, channelId);
                int count = info.optInt("unread_count_display", 0);
                if (count > 0) countsById.put(channelId, count);
            } catch (Exception e) {
                // One bad conversation must not sink the poll
            }
        }
        return countsById;
    }

    // Fetches the newest message of a conversation so the notification can say
    // who wrote what. Returns {senderName, text} or null; any failure means the
    // caller keeps the plain "N new messages" body.
    private String[] fetchMessagePreview(String token, String channelId, JSONObject nameCache) {
        try {
            JSONObject response = slackGet(token,
                "conversations.history?channel=" + channelId + "&limit=1");
            JSONArray messages = response.optJSONArray("messages");
            if (messages == null || messages.length() == 0) return null;
            JSONObject message = messages.getJSONObject(0);

            String sender = resolveSenderName(token, message, nameCache);
            String text = cleanSlackText(message.optString("text", ""), token, nameCache);
            if (text.isEmpty()) text = describeNonTextMessage(message);
            if (text.isEmpty()) return null;
            if (text.length() > MAX_PREVIEW_CHARS) {
                text = text.substring(0, MAX_PREVIEW_CHARS - 1) + "…";
            }
            return new String[] { sender, text };
        } catch (Exception e) {
            Log.w(TAG, "Preview fetch failed for " + channelId + ": " + e.getMessage());
            return null;
        }
    }

    private String resolveSenderName(String token, JSONObject message, JSONObject nameCache) {
        String senderId = message.optString("user", "");
        // Bot/app messages carry a username instead of a user id.
        if (senderId.isEmpty()) return message.optString("username", "");
        return resolveUserName(token, senderId, nameCache);
    }

    // Resolves a user id to a display name via the persistent cache, falling
    // back to one users.info call. Returns "" when the name can't be resolved.
    private String resolveUserName(String token, String userId, JSONObject nameCache) {
        String cached = nameCache.optString(userId, "");
        if (!cached.isEmpty()) return cached;
        try {
            JSONObject response = slackGet(token, "users.info?user=" + userId);
            JSONObject user = response.optJSONObject("user");
            if (user == null) return "";
            JSONObject profile = user.optJSONObject("profile");
            String name = profile != null ? profile.optString("display_name", "") : "";
            if (name.isEmpty() && profile != null) name = profile.optString("real_name", "");
            if (name.isEmpty()) name = user.optString("real_name", "");
            if (name.isEmpty()) name = user.optString("name", "");
            if (!name.isEmpty()) nameCache.put(userId, name);
            return name;
        } catch (Exception e) {
            return "";
        }
    }

    // Strips Slack's message markup (<@U..>, <#C..|name>, <url|label>, HTML
    // entities) down to plain text fit for a one-line notification.
    private String cleanSlackText(String raw, String token, JSONObject nameCache) {
        if (raw == null) return "";
        Matcher mention = MENTION_PATTERN.matcher(raw);
        StringBuffer resolved = new StringBuffer();
        while (mention.find()) {
            String name = resolveUserName(token, mention.group(1), nameCache);
            mention.appendReplacement(resolved,
                Matcher.quoteReplacement("@" + (name.isEmpty() ? "user" : name)));
        }
        mention.appendTail(resolved);
        String text = resolved.toString();
        text = text.replaceAll("<#[A-Z0-9]+\\|([^>]*)>", "#$1");
        text = text.replaceAll("<[^>|]+\\|([^>]*)>", "$1");
        text = text.replaceAll("<([^>]+)>", "$1");
        text = text.replace("&lt;", "<").replace("&gt;", ">").replace("&amp;", "&");
        return text.trim();
    }

    private String describeNonTextMessage(JSONObject message) {
        if (message.optJSONArray("files") != null) return "Sent a file";
        if (message.optJSONArray("attachments") != null) return "Sent an attachment";
        return "New message";
    }

    // Throws with a specific reason (TLS failure, HTTP code, Slack API error)
    // so pollOnce can surface it in the diagnostics report instead of failing
    // silently.
    private JSONObject slackGet(String token, String pathAndQuery) throws Exception {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(SLACK_API + pathAndQuery);
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
            conn.setRequestProperty("Authorization", "Bearer " + token);

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

            JSONObject response = new JSONObject(sb.toString());
            if (!response.optBoolean("ok", false)) {
                throw new Exception("Slack API: " + response.optString("error", "unknown"));
            }
            return response;
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
