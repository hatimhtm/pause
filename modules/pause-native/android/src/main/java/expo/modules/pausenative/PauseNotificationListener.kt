package expo.modules.pausenative

import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification

/**
 * Cancels notifications from apps the user muted, or from any watched app during quiet hours.
 * Only the source package is inspected — notification content is never read.
 */
class PauseNotificationListener : NotificationListenerService() {

    private lateinit var config: ConfigStore

    override fun onListenerConnected() {
        super.onListenerConnected()
        connected = true
        config = ConfigStore(this)
    }

    override fun onListenerDisconnected() {
        connected = false
        super.onListenerDisconnected()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return
        if (sbn.isOngoing) return
        if (!::config.isInitialized) config = ConfigStore(this)
        val pkg = sbn.packageName ?: return
        val cfg = config.config()
        val muted = pkg in cfg.mutedPackages ||
            (cfg.apps.containsKey(pkg) && cfg.quietActiveAt(System.currentTimeMillis()))
        if (muted) {
            try {
                cancelNotification(sbn.key)
            } catch (_: Exception) {
            }
        }
    }

    companion object {
        @Volatile
        var connected: Boolean = false
            private set
    }
}
