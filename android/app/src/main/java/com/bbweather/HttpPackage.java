package com.engtechnos.BBTwitter;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class HttpPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext reactContext) {
        List<NativeModule> modules = new ArrayList<>();
        modules.add(new HttpModule(reactContext));
        modules.add(new FilePickerModule(reactContext));
        modules.add(new AudioRecorderModule(reactContext));
        modules.add(new KeyEventModule(reactContext));
        modules.add(new NotificationModule(reactContext));
        modules.add(new VideoIntentModule(reactContext));

        return modules;
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext reactContext) {
        return Collections.emptyList();
    }
}
