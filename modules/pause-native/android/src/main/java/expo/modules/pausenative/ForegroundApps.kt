package expo.modules.pausenative

import android.content.Context
import android.content.Intent

/**
 * Which packages count as "an app came to the foreground"? Real launchable apps and launchers.
 * Everything else — keyboards, system UI, permission controllers, share sheets, setup wizards —
 * is an overlay: it appears over an app without replacing it, and must never reset the
 * foreground-app tracking (that's what caused mid-session re-pauses).
 */
object ForegroundApps {
    private const val REFRESH_MS = 5 * 60_000L

    @Volatile private var allowed: Set<String> = emptySet()
    @Volatile private var loadedAt = 0L

    fun isRealApp(context: Context, pkg: String, now: Long): Boolean {
        if (now - loadedAt > REFRESH_MS) {
            allowed = try {
                val pm = context.packageManager
                val launchable = pm.queryIntentActivities(
                    Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0,
                ).map { it.activityInfo.packageName }
                val homes = pm.queryIntentActivities(
                    Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME), 0,
                ).map { it.activityInfo.packageName }
                (launchable + homes).toSet()
            } catch (_: Exception) {
                emptySet()
            }
            loadedAt = now
        }
        // Fail open: if the query broke, behave like before rather than going silent.
        return allowed.isEmpty() || pkg in allowed
    }
}
