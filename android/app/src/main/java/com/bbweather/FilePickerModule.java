package com.engtechnos.BBTwitter;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import android.util.Base64;

import com.facebook.react.bridge.ActivityEventListener;
import com.facebook.react.bridge.BaseActivityEventListener;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;

public class FilePickerModule extends ReactContextBaseJavaModule {

    private static final int PICK_FILE_REQUEST = 9001;
    private Promise mPickerPromise;

    private final ActivityEventListener mActivityEventListener = new BaseActivityEventListener() {
        @Override
        public void onActivityResult(Activity activity, int requestCode, int resultCode, Intent data) {
            if (requestCode != PICK_FILE_REQUEST) return;

            if (mPickerPromise == null) return;

            if (resultCode != Activity.RESULT_OK || data == null || data.getData() == null) {
                mPickerPromise.resolve("cancelled");
                mPickerPromise = null;
                return;
            }

            try {
                Uri uri = data.getData();
                ReactApplicationContext ctx = getReactApplicationContext();

                String fileName = "file";
                String mimeType = ctx.getContentResolver().getType(uri);
                if (mimeType == null) mimeType = "application/octet-stream";
                long fileSize = 0;

                Cursor cursor = ctx.getContentResolver().query(uri, null, null, null, null);
                if (cursor != null) {
                    int nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    int sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE);
                    cursor.moveToFirst();
                    if (nameIndex >= 0) fileName = cursor.getString(nameIndex);
                    if (sizeIndex >= 0) fileSize = cursor.getLong(sizeIndex);
                    cursor.close();
                }

                InputStream is = ctx.getContentResolver().openInputStream(uri);
                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                int len;
                while ((len = is.read(buffer)) != -1) {
                    baos.write(buffer, 0, len);
                }
                is.close();
                byte[] bytes = baos.toByteArray();
                if (fileSize == 0) fileSize = bytes.length;

                String base64 = Base64.encodeToString(bytes, Base64.NO_WRAP);

                org.json.JSONObject result = new org.json.JSONObject();
                result.put("name", fileName);
                result.put("type", mimeType);
                result.put("size", fileSize);
                result.put("base64", base64);

                mPickerPromise.resolve(result.toString());
            } catch (Exception e) {
                mPickerPromise.reject("FILE_PICK_ERROR", e.getMessage());
            }
            mPickerPromise = null;
        }
    };

    public FilePickerModule(ReactApplicationContext reactContext) {
        super(reactContext);
        reactContext.addActivityEventListener(mActivityEventListener);
    }

    @Override
    public String getName() {
        return "FilePickerModule";
    }

    @ReactMethod
    public void pickFile(Promise promise) {
        Activity activity = getCurrentActivity();
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity");
            return;
        }
        mPickerPromise = promise;
        Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
        intent.setType("*/*");
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        activity.startActivityForResult(Intent.createChooser(intent, "Select File"), PICK_FILE_REQUEST);
    }
}
