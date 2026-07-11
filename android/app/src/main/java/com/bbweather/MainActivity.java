package com.engtechnos.BBTwitter;

import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import com.facebook.react.ReactActivity;
import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.ReactContext;

public class MainActivity extends ReactActivity {

    private static volatile boolean sIsForeground = false;
    private static volatile boolean sMouseEnabled = true;

    public static boolean isForeground() {
        return sIsForeground;
    }

    // Toggled from JS (KeyEventModule) so screens like Login can force
    // hardware D-pad navigation only, ignoring the BlackBerry trackpad cursor.
    public static void setMouseEnabled(boolean enabled) {
        sMouseEnabled = enabled;
    }

    // The trackpad ("bb mouse") reports as a mouse/touchpad pointer, unlike
    // finger input (SOURCE_TOUCHSCREEN) or the D-pad (delivered as key events).
    private static boolean isMousePointer(MotionEvent event) {
        int source = event.getSource();
        return (source & InputDevice.SOURCE_MOUSE) == InputDevice.SOURCE_MOUSE
            || (source & InputDevice.SOURCE_TOUCHPAD) == InputDevice.SOURCE_TOUCHPAD;
    }

    @Override
    public boolean dispatchTouchEvent(MotionEvent event) {
        // Swallow trackpad clicks while disabled; finger touches still pass.
        if (!sMouseEnabled && isMousePointer(event)) return true;
        return super.dispatchTouchEvent(event);
    }

    @Override
    public boolean dispatchGenericMotionEvent(MotionEvent event) {
        // Swallow trackpad hover/scroll while disabled.
        if (!sMouseEnabled && isMousePointer(event)) return true;
        return super.dispatchGenericMotionEvent(event);
    }

    @Override
    protected String getMainComponentName() {
        return "BBTwitter";
    }

    @Override
    protected void onResume() {
        super.onResume();
        sIsForeground = true;
    }

    @Override
    protected void onPause() {
        super.onPause();
        sIsForeground = false;
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_DPAD_UP ||
            keyCode == KeyEvent.KEYCODE_DPAD_DOWN ||
            keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
            keyCode == KeyEvent.KEYCODE_DPAD_RIGHT ||
            keyCode == KeyEvent.KEYCODE_DPAD_CENTER ||
            keyCode == KeyEvent.KEYCODE_ENTER) {

            ReactInstanceManager mgr = getReactNativeHost().getReactInstanceManager();
            ReactContext ctx = mgr.getCurrentReactContext();
            if (ctx != null) {
                KeyEventModule mod = ctx.getNativeModule(KeyEventModule.class);
                if (mod != null) {
                    mod.onKeyDown(keyCode);
                    if (keyCode != KeyEvent.KEYCODE_BACK) {
                        return true;
                    }
                }
            }
        }
        return super.onKeyDown(keyCode, event);
    }
}
