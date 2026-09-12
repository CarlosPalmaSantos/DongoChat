package top.magin.dongochat;

import android.content.Context;
import android.os.Build;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "DynamicColor")
public class DynamicColorPlugin extends Plugin {

    @PluginMethod
    public void getSystemColor(PluginCall call) {
        Log.d("DynamicColor", "getSystemColor llamado");
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            try {
                Context context = getActivity().getApplicationContext();
                int colorResId = android.R.color.system_accent1_500;
                int color = context.getResources().getColor(colorResId, context.getTheme());
                
                String hexColor = String.format("#%06X", (0xFFFFFF & color));
                Log.d("DynamicColor", "Color obtenido: " + hexColor);
                
                JSObject result = new JSObject();
                result.put("color", hexColor);
                call.resolve(result);
            } catch (Exception e) {
                Log.e("DynamicColor", "Error: " + e.getMessage());
                call.reject("Error getting system color: " + e.getMessage());
            }
        } else {
            Log.d("DynamicColor", "Android version: " + Build.VERSION.SDK_INT);
            call.reject("Dynamic colors require Android 12+");
        }
    }
}
