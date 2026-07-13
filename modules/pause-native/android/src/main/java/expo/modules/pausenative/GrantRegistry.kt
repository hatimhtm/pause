package expo.modules.pausenative

import java.util.concurrent.ConcurrentHashMap

/**
 * "The user just chose to continue into this app — don't nag them again for a few minutes."
 * Process-lifetime only; a reboot clears it, which is fine.
 */
object GrantRegistry {
    private val grantUntil = ConcurrentHashMap<String, Long>()

    fun isGranted(pkg: String, now: Long): Boolean = (grantUntil[pkg] ?: 0L) > now

    fun grant(pkg: String, until: Long) {
        grantUntil[pkg] = until
    }

    fun clearAll() = grantUntil.clear()
}
