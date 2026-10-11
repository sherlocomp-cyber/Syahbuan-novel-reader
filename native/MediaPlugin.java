package app.pembacanovel;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Locale;

@CapacitorPlugin(name = "NovelMedia", permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notif") })
public class MediaPlugin extends Plugin {
  private TextToSpeech tts;
  private boolean ready = false;

  @Override
  public void load() {
    tts = new TextToSpeech(getContext(), status -> {
      ready = status == TextToSpeech.SUCCESS;
      if (ready) {
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
          @Override public void onStart(String id) {}
          @Override public void onDone(String id) { JSObject o = new JSObject(); o.put("id", id); notifyListeners("ttsDone", o); }
          @Override public void onError(String id) { JSObject o = new JSObject(); o.put("id", id); notifyListeners("ttsError", o); }
        });
      }
    });
    MediaService.cb = action -> { JSObject o = new JSObject(); o.put("action", action); notifyListeners("mediaAction", o); };
  }

  @Override
  protected void handleOnDestroy() {
    getContext().stopService(new Intent(getContext(), MediaService.class));
    if (tts != null) tts.shutdown();
  }

  @PluginMethod
  public void speak(PluginCall call) {
    if (!ready) { call.reject("Mesin TTS perangkat belum siap"); return; }
    String text = call.getString("text", "");
    String lang = call.getString("lang", "");
    String id = call.getString("id", "u");
    float rate = call.getFloat("rate", 1.0f);
    if (!lang.isEmpty()) tts.setLanguage(Locale.forLanguageTag(lang));
    tts.setSpeechRate(rate);
    int r = tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id);
    if (r == TextToSpeech.SUCCESS) call.resolve(); else call.reject("speak gagal");
  }

  @PluginMethod
  public void stopSpeak(PluginCall call) {
    if (tts != null) tts.stop();
    call.resolve();
  }

  @PluginMethod
  public void ask(PluginCall call) {
    if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notif") != PermissionState.GRANTED) requestPermissionForAlias("notif", call, "askDone");
    else call.resolve();
  }

  @PermissionCallback
  private void askDone(PluginCall call) { call.resolve(); }

  @PluginMethod
  public void show(PluginCall call) {
    String title = call.getString("title", "");
    String text = call.getString("text", "");
    boolean playing = call.getBoolean("playing", true);
    try {
      if (MediaService.inst != null) {
        MediaService.inst.render(title, text, playing, false);
      } else {
        Intent i = new Intent(getContext(), MediaService.class).setAction(MediaService.A_SHOW);
        i.putExtra("title", title);
        i.putExtra("text", text);
        i.putExtra("playing", playing);
        if (Build.VERSION.SDK_INT >= 26) getContext().startForegroundService(i); else getContext().startService(i);
      }
      call.resolve();
    } catch (Exception e) {
      call.reject(String.valueOf(e.getMessage()));
    }
  }

  @PluginMethod
  public void hide(PluginCall call) {
    getContext().stopService(new Intent(getContext(), MediaService.class));
    call.resolve();
  }
}
