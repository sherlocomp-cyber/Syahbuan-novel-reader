package app.pembacanovel;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(MediaPlugin.class);
    super.onCreate(savedInstanceState);
    keepRenderer();
  }

  @Override
  public void onPause() {
    super.onPause();
    keepRenderer();
  }

  // Jaga proses WebView tetap berprioritas tinggi walau aplikasi tidak tampil, agar JavaScript tidak dihentikan Android
  private void keepRenderer() {
    try {
      if (Build.VERSION.SDK_INT >= 26 && getBridge() != null && getBridge().getWebView() != null) {
        getBridge().getWebView().setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
      }
    } catch (Exception e) {
    }
  }
}
