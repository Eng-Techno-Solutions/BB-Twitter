package com.engtechnos.BBTwitter;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class BootReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction())) return;

        String accounts = NotificationModule.getAccounts(context);
        if (accounts == null || accounts.equals("[]")) return;

        // Re-launch the poll service after a reboot so notifications resume
        // without the user having to reopen the app.
        NotificationModule.startPollService(context);
    }
}
