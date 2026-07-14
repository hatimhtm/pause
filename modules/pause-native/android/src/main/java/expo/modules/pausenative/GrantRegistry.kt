package expo.modules.pausenative

import android.content.Context
import java.util.concurrent.ConcurrentHashMap

/**
 * "The user just chose to continue into this app — don't nag them again for a few minutes."
 * Write-through to SharedPreferences: a low-memory kill of the service process must not
 * re-pause someone mid-session they already paid the breath for.
 */
object GrantRegistry {
    private const val PREFS = "pause_grants"

    private val grantUntil = ConcurrentHashMap<String, Long>()

    @Volatile
    private var loaded = false

    private fun ensureLoaded(context: Context) {
        if (loaded) return
        synchronized(this) {
            if (loaded) return
            try {
                val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                val now = System.currentTimeMillis()
                for ((pkg, until) in prefs.all) {
                    (until as? Long)?.let { if (it > now) grantUntil[pkg] = it }
                }
            } catch (_: Exception) {
            }
            loaded = true
        }
    }

    fun isGranted(context: Context, pkg: String, now: Long): Boolean {
        ensureLoaded(context)
        return (grantUntil[pkg] ?: 0L) > now
    }

    fun grant(context: Context, pkg: String, until: Long) {
        ensureLoaded(context)
        grantUntil[pkg] = until
        try {
            context.applicationContext
                .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putLong(pkg, until)
                .apply()
        } catch (_: Exception) {
        }
    }
}
