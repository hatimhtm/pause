package expo.modules.pausenative

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.os.Build
import android.os.Process
import java.util.Calendar

/** Wrapper over UsageStatsManager for per-app foreground time and open counts. */
class UsageQuery(context: Context) {
    private val appContext = context.applicationContext

    fun hasPermission(): Boolean {
        val appOps = appContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), appContext.packageName)
        } else {
            @Suppress("DEPRECATION")
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), appContext.packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }

    /**
     * Foreground time (ms) per package between [start] and [end]. Sessions already running at
     * [start] (the past-midnight doomscroll) are found by looking back up to 12h and clipping
     * each session's contribution to the requested range.
     */
    fun usageBetween(start: Long, end: Long): Map<String, Long> {
        val usm = appContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val totals = HashMap<String, Long>()
        val lastForeground = HashMap<String, Long>()
        val events = usm.queryEvents(start - TWELVE_HOURS, end)
        val event = UsageEvents.Event()
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            val pkg = event.packageName ?: continue
            when (event.eventType) {
                UsageEvents.Event.ACTIVITY_RESUMED -> lastForeground[pkg] = event.timeStamp
                UsageEvents.Event.ACTIVITY_PAUSED -> {
                    val startedAt = lastForeground.remove(pkg) ?: continue
                    val overlap = minOf(event.timeStamp, end) - maxOf(startedAt, start)
                    if (overlap in 1..TWELVE_HOURS) totals[pkg] = (totals[pkg] ?: 0L) + overlap
                }
            }
        }
        for ((pkg, startedAt) in lastForeground) {
            val overlap = end - maxOf(startedAt, start)
            if (overlap in 1..TWELVE_HOURS) totals[pkg] = (totals[pkg] ?: 0L) + overlap
        }
        return totals
    }

    /**
     * Long-range history via the system's pre-aggregated buckets. Retention is tiered by the OS
     * (roughly: daily ≈1 week, weekly ≈4 weeks, monthly ≈6 months, yearly ≈2 years), so callers
     * should render whatever comes back rather than assume a full range.
     */
    fun history(interval: String, start: Long, end: Long): List<Map<String, Any>> {
        val usm = appContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val bucket = when (interval) {
            "daily" -> UsageStatsManager.INTERVAL_DAILY
            "weekly" -> UsageStatsManager.INTERVAL_WEEKLY
            "monthly" -> UsageStatsManager.INTERVAL_MONTHLY
            "yearly" -> UsageStatsManager.INTERVAL_YEARLY
            else -> UsageStatsManager.INTERVAL_BEST
        }
        val stats = try {
            usm.queryUsageStats(bucket, start, end) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
        return stats.filter { it.totalTimeInForeground > 0 }.map {
            mapOf(
                "packageName" to it.packageName,
                "start" to it.firstTimeStamp.toDouble(),
                "end" to it.lastTimeStamp.toDouble(),
                "totalMs" to it.totalTimeInForeground.toDouble(),
            )
        }
    }

    /** Number of times each package was brought to the foreground between [start] and [end]. */
    fun opensBetween(start: Long, end: Long): Map<String, Int> {
        val usm = appContext.getSystemService(Context.USAGE_STATS_SERVICE) as UsageStatsManager
        val counts = HashMap<String, Int>()
        val events = usm.queryEvents(start, end)
        val event = UsageEvents.Event()
        var lastPkg: String? = null
        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.eventType == UsageEvents.Event.ACTIVITY_RESUMED) {
                val pkg = event.packageName ?: continue
                if (pkg != lastPkg) {
                    counts[pkg] = (counts[pkg] ?: 0) + 1
                    lastPkg = pkg
                }
            }
        }
        return counts
    }

    companion object {
        private const val TWELVE_HOURS = 12 * 60 * 60 * 1000L

        fun startOfToday(): Long {
            val c = Calendar.getInstance()
            c.set(Calendar.HOUR_OF_DAY, 0); c.set(Calendar.MINUTE, 0)
            c.set(Calendar.SECOND, 0); c.set(Calendar.MILLISECOND, 0)
            return c.timeInMillis
        }
    }
}
