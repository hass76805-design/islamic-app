package com.alzahabi.adhan.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SystemPermissions")
public class SystemPermissionsPlugin extends Plugin {

    private JSObject buildSnapshot() {
        Context ctx = getContext();
        String pkg = ctx.getPackageName();

        boolean notifGranted;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notifGranted =
                ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                    == PackageManager.PERMISSION_GRANTED
                && NotificationManagerCompat.from(ctx).areNotificationsEnabled();
        } else {
            notifGranted = NotificationManagerCompat.from(ctx).areNotificationsEnabled();
        }

        boolean fineLocationGranted =
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;
        boolean coarseLocationGranted =
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION)
                == PackageManager.PERMISSION_GRANTED;

        boolean exactAlarmGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            exactAlarmGranted = am != null && am.canScheduleExactAlarms();
        }

        boolean overlayGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            overlayGranted = Settings.canDrawOverlays(ctx);
        }

        boolean batteryGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            batteryGranted = pm != null && pm.isIgnoringBatteryOptimizations(pkg);
        }

        boolean dndGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            dndGranted = nm != null && nm.isNotificationPolicyAccessGranted();
        }

        JSObject ret = new JSObject();
        ret.put("notifications", notifGranted ? "granted" : "prompt");
        ret.put("location", (fineLocationGranted || coarseLocationGranted) ? "granted" : "prompt");
        ret.put("exactAlarm", exactAlarmGranted ? "granted" : "prompt");
        ret.put("overlay", overlayGranted ? "granted" : "prompt");
        ret.put("battery", batteryGranted ? "granted" : "prompt");
        ret.put("doNotDisturb", dndGranted ? "granted" : "prompt");
        return ret;
    }

    @PluginMethod
    public void checkSpecialPermissions(PluginCall call) {
        call.resolve(buildSnapshot());
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext())) {
            call.resolve(buildSnapshot());
            return;
        }
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            Uri.parse("package:" + getContext().getPackageName())
        );
        startActivityForResult(call, intent, "onSystemSettingsResult");
    }

    @PluginMethod
    public void requestBatteryOptimization(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.resolve(buildSnapshot());
            return;
        }
        PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        if (pm != null && pm.isIgnoringBatteryOptimizations(getContext().getPackageName())) {
            call.resolve(buildSnapshot());
            return;
        }
        Intent intent = new Intent(
            Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
            Uri.parse("package:" + getContext().getPackageName())
        );
        startActivityForResult(call, intent, "onSystemSettingsResult");
    }

    @PluginMethod
    public void requestExactAlarmPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            call.resolve(buildSnapshot());
            return;
        }
        AlarmManager am = (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);
        if (am != null && am.canScheduleExactAlarms()) {
            call.resolve(buildSnapshot());
            return;
        }
        Intent intent = new Intent(
            Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
            Uri.parse("package:" + getContext().getPackageName())
        );
        startActivityForResult(call, intent, "onSystemSettingsResult");
    }

    @PluginMethod
    public void requestDoNotDisturbPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            call.resolve(buildSnapshot());
            return;
        }
        NotificationManager nm = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && nm.isNotificationPolicyAccessGranted()) {
            call.resolve(buildSnapshot());
            return;
        }
        Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
        startActivityForResult(call, intent, "onSystemSettingsResult");
    }

    @PluginMethod
    public void openAppSettings(PluginCall call) {
        Intent intent = new Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.parse("package:" + getContext().getPackageName())
        );
        startActivityForResult(call, intent, "onSystemSettingsResult");
    }

    @ActivityCallback
    private void onSystemSettingsResult(PluginCall call, ActivityResult result) {
        if (call != null) {
            call.resolve(buildSnapshot());
        }
    }
}
