package com.engtechnos.BBTwitter;

import android.view.KeyEvent;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class KeyEventModule extends ReactContextBaseJavaModule {

    public KeyEventModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "KeyEventModule";
    }

    // Lets screens disable the BlackBerry trackpad cursor so only the
    // hardware D-pad drives navigation (e.g. on the login screen).
    @ReactMethod
    public void setMouseEnabled(boolean enabled) {
        MainActivity.setMouseEnabled(enabled);
    }

    public void onKeyDown(int keyCode) {
        ReactApplicationContext ctx = getReactApplicationContext();
        if (!ctx.hasActiveCatalystInstance()) return;

        String action = null;
        switch (keyCode) {
            case KeyEvent.KEYCODE_DPAD_UP:
                action = "up";
                break;
            case KeyEvent.KEYCODE_DPAD_DOWN:
                action = "down";
                break;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
                action = "select";
                break;
            case KeyEvent.KEYCODE_DPAD_LEFT:
            case KeyEvent.KEYCODE_BACK:
                action = "back";
                break;
            case KeyEvent.KEYCODE_DPAD_RIGHT:
                action = "right";
                break;
        }

        if (action != null) {
            WritableMap params = Arguments.createMap();
            params.putString("action", action);
            params.putInt("keyCode", keyCode);
            ctx.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("onKeyEvent", params);
        }
    }
}
