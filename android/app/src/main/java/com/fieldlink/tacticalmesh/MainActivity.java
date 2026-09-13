package com.fieldlink.tacticalmesh;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FieldlinkBlePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
