package app.pembacanovel;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

public class MediaService extends Service {
  public interface Cb { void on(String action); }
  public static Cb cb;
  public static MediaService inst;
  static final String CH = "novel_tts";
  static final String A_SHOW = "SHOW";
  private MediaSession ms;
  private PowerManager.WakeLock wl;

  @Override public IBinder onBind(Intent i) { return null; }

  @Override
  public void onCreate() {
    super.onCreate();
    inst = this;
    if (Build.VERSION.SDK_INT >= 26) {
      NotificationChannel c = new NotificationChannel(CH, "Pembacaan suara", NotificationManager.IMPORTANCE_LOW);
      c.setShowBadge(false);
      ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(c);
    }
    ms = new MediaSession(this, "NovelTTS");
    ms.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
    ms.setCallback(new MediaSession.Callback() {
      @Override public void onPlay() { send("play"); }
      @Override public void onPause() { send("pause"); }
      @Override public void onStop() { send("stop"); }
      @Override public void onSkipToNext() { send("next"); }
      @Override public void onSkipToPrevious() { send("prev"); }
    });
    ms.setActive(true);
    PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
    wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "novel:tts");
    wl.acquire(6 * 60 * 60 * 1000L);
  }

  @Override
  public int onStartCommand(Intent i, int flags, int startId) {
    String a = i == null ? null : i.getAction();
    if (a == null || A_SHOW.equals(a)) {
      String t = i == null ? null : i.getStringExtra("title");
      String x = i == null ? null : i.getStringExtra("text");
      boolean p = i == null || i.getBooleanExtra("playing", true);
      render(t == null ? "" : t, x == null ? "" : x, p, true);
    } else if (a.startsWith("ACT_")) {
      send(a.substring(4).toLowerCase());
    }
    return START_NOT_STICKY;
  }

  private void send(String k) {
    if (cb != null) cb.on(k); else stopSelf();
  }

  void render(String t, String x, boolean pl, boolean fg) {
    ms.setMetadata(new MediaMetadata.Builder()
      .putString(MediaMetadata.METADATA_KEY_TITLE, t)
      .putString(MediaMetadata.METADATA_KEY_ARTIST, x).build());
    ms.setPlaybackState(new PlaybackState.Builder()
      .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_STOP
        | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS)
      .setState(pl ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED, PlaybackState.PLAYBACK_POSITION_UNKNOWN, 1f).build());
    Notification n = build(t, x, pl);
    if (fg) {
      if (Build.VERSION.SDK_INT >= 29) startForeground(7, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
      else startForeground(7, n);
    } else {
      ((NotificationManager) getSystemService(NOTIFICATION_SERVICE)).notify(7, n);
    }
  }

  private Notification build(String t, String x, boolean pl) {
    Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CH) : new Notification.Builder(this);
    Intent li = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent open = PendingIntent.getActivity(this, 0, li, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    b.setSmallIcon(android.R.drawable.ic_media_play)
      .setContentTitle(t).setContentText(x).setContentIntent(open)
      .setOngoing(true).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PUBLIC)
      .addAction(act(android.R.drawable.ic_media_previous, "Sebelumnya", "ACT_PREV"))
      .addAction(act(pl ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play, pl ? "Jeda" : "Putar", pl ? "ACT_PAUSE" : "ACT_PLAY"))
      .addAction(act(android.R.drawable.ic_media_next, "Berikutnya", "ACT_NEXT"))
      .addAction(act(android.R.drawable.ic_menu_close_clear_cancel, "Berhenti", "ACT_STOP"))
      .setStyle(new Notification.MediaStyle().setMediaSession(ms.getSessionToken()).setShowActionsInCompactView(0, 1, 2));
    return b.build();
  }

  private Notification.Action act(int icon, String label, String a) {
    Intent i = new Intent(this, MediaService.class).setAction(a);
    PendingIntent pi = PendingIntent.getService(this, a.hashCode(), i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    return new Notification.Action.Builder(icon, label, pi).build();
  }

  @Override
  public void onDestroy() {
    inst = null;
    if (ms != null) { ms.setActive(false); ms.release(); }
    if (wl != null && wl.isHeld()) wl.release();
    stopForeground(true);
    super.onDestroy();
  }
}
