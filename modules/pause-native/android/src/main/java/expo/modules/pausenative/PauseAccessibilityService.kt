package expo.modules.pausenative

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent

/**
 * The engine. Watches which app comes to the foreground and, for apps the user chose, shows a
 * short native breathing screen first. Never a hard block — you can always continue. Runs even
 * when the React Native layer is dead; it reads its config from [ConfigStore] and logs to
 * [EventLog], both of which the JS layer reads/writes.
 */
class PauseAccessibilityService : AccessibilityService() {

    private val main = Handler(Looper.getMainLooper())
    private lateinit var config: ConfigStore
    private lateinit var events: EventLog

    private var lastForegroundPkg: String? = null
    private var lastLaunchAt = 0L

    override fun onServiceConnected() {
        super.onServiceConnected()
        isRunning = true
        config = ConfigStore(this)
        events = EventLog(this)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg == packageName) return

        val isFreshOpen = pkg != lastForegroundPkg
        lastForegroundPkg = pkg
        if (!isFreshOpen) return

        val cfg = config.config()
        val app = cfg.apps[pkg] ?: return
        val now = System.currentTimeMillis()
        val downtime = cfg.quietActiveAt(now)
        val shouldPause = (app.enabled || downtime) && !GrantRegistry.isGranted(pkg, now)
        if (!shouldPause) return
        if (now - lastLaunchAt < LAUNCH_DEBOUNCE_MS) return
        lastLaunchAt = now

        events.log(pkg, EventType.SHOWN, now)
        launchBreathe(pkg, app, cfg, downtime)
    }

    private fun launchBreathe(pkg: String, app: AppCfg, cfg: Config, downtime: Boolean) {
        val intent = Intent(this, BreatheActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            putExtra(BreatheActivity.EXTRA_PACKAGE, pkg)
            putExtra(BreatheActivity.EXTRA_LABEL, app.label)
            putExtra(BreatheActivity.EXTRA_BREATH_SECONDS, app.breathSeconds)
            putExtra(BreatheActivity.EXTRA_REFLECTION, app.reflection)
            putExtra(BreatheActivity.EXTRA_SESSION_MINUTES, cfg.sessionMinutes)
            putExtra(BreatheActivity.EXTRA_DOWNTIME, downtime)
            putExtra(BreatheActivity.EXTRA_TITLE, if (downtime) "Quiet hours" else cfg.breath.title)
            putExtra(BreatheActivity.EXTRA_REFLECTION_TEXT, cfg.breath.reflection)
            putExtra(BreatheActivity.EXTRA_CONTINUE_LABEL, cfg.breath.continueLabel)
            putExtra(BreatheActivity.EXTRA_DISMISS_LABEL, cfg.breath.dismissLabel)
            putExtra(BreatheActivity.EXTRA_COLOR_TOP, cfg.breath.colorTop)
            putExtra(BreatheActivity.EXTRA_COLOR_BOTTOM, cfg.breath.colorBottom)
            putExtra(BreatheActivity.EXTRA_COLOR_ACCENT, cfg.breath.colorAccent)
        }
        main.post { startActivity(intent) }
    }

    override fun onInterrupt() {}

    override fun onUnbind(intent: Intent?): Boolean {
        isRunning = false
        return super.onUnbind(intent)
    }

    companion object {
        private const val LAUNCH_DEBOUNCE_MS = 800L

        @Volatile
        var isRunning: Boolean = false
            private set
    }
}
