package com.engtechnos.BBTwitter;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

// Hands an X video stream to a native OS video player. Linking.openURL fires a
// bare ACTION_VIEW that Android resolves by URI scheme, so an https .mp4 with a
// "?tag=" query (no .mp4 extension to sniff) falls through to the browser. Setting
// an explicit video/mp4 MIME type lets a real video player claim the intent.
public class VideoIntentModule extends ReactContextBaseJavaModule {

    public VideoIntentModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "VideoIntentModule";
    }

    @ReactMethod
    public void openVideo(String url, Promise promise) {
        if (url == null || url.length() == 0) {
            promise.reject("NO_URL", "Empty video url");
            return;
        }

        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(Uri.parse(url), "video/mp4");

        Activity activity = getCurrentActivity();
        Context target = activity != null ? activity : getReactApplicationContext();
        if (activity == null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        }

        try {
            target.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            // No app registered for video/mp4 — fall back to a plain untyped
            // VIEW so the browser can still stream it rather than failing hard.
            try {
                Intent fallback = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                if (activity == null) fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                target.startActivity(fallback);
                promise.resolve(true);
            } catch (Exception inner) {
                promise.reject("NO_HANDLER", inner.getMessage());
            }
        }
    }
}
