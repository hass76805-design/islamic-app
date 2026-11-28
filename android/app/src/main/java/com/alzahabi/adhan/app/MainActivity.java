package com.alzahabi.adhan.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemPermissionsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
