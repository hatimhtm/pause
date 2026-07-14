package expo.modules.pausenative

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.util.Calendar
import java.util.concurrent.Executors

object EventType {
    const val SHOWN = "shown"        // the breathe screen appeared = "tried to open"
    const val CONTINUED = "continued" // chose to go into the app anyway
    const val DISMISSED = "dismissed" // backed out
}

data class LoggedEvent(val packageName: String, val timestamp: Long, val type: String)

/**
 * On-device log of every pause interaction. The accessibility service runs even when the React
 * Native layer is dead, so events are persisted here (SQLite) and read back by JS for the stats.
 *
 * Process singleton: one open database and one writer thread, shared by the service, the
 * breathe screen, and the JS bridge — per-call instances used to leak a connection and a
 * non-daemon executor thread each.
 */
class EventLog private constructor(context: Context) {
    private val helper = Helper(context.applicationContext)
    private val writer = Executors.newSingleThreadExecutor { r ->
        Thread(r, "pause-eventlog").apply { isDaemon = true }
    }

    fun log(packageName: String, type: String, timestamp: Long) {
        writer.execute {
            val values = ContentValues().apply {
                put("pkg", packageName)
                put("ts", timestamp)
                put("type", type)
            }
            try {
                helper.writableDatabase.insert(TABLE, null, values)
            } catch (_: Exception) {
            }
        }
    }

    fun since(sinceMs: Long): List<LoggedEvent> {
        val out = ArrayList<LoggedEvent>()
        try {
            helper.readableDatabase.query(
                TABLE, arrayOf("pkg", "ts", "type"),
                "ts >= ?", arrayOf(sinceMs.toString()),
                null, null, "ts DESC",
            ).use { c ->
                while (c.moveToNext()) {
                    out.add(LoggedEvent(c.getString(0), c.getLong(1), c.getString(2)))
                }
            }
        } catch (_: Exception) {
        }
        return out
    }

    /** Count of one event type for one package since [sinceMs] — tiny indexed query. */
    fun countSince(packageName: String, type: String, sinceMs: Long): Int {
        try {
            helper.readableDatabase.rawQuery(
                "SELECT COUNT(*) FROM $TABLE WHERE ts >= ? AND pkg = ? AND type = ?",
                arrayOf(sinceMs.toString(), packageName, type),
            ).use { c ->
                if (c.moveToFirst()) return c.getInt(0)
            }
        } catch (_: Exception) {
        }
        return 0
    }

    /** Consecutive days ending today (or yesterday) that contain a [type] event. */
    fun dayStreak(type: String, now: Long, maxDays: Int = 14): Int {
        val daysWith = HashSet<Long>()
        for (e in since(now - maxDays * DAY_MS)) {
            if (e.type != type) continue
            daysWith.add(startOfDay(e.timestamp))
        }
        var streak = 0
        var day = startOfDay(now)
        // Today may still be pending — an empty today doesn't break the run.
        if (!daysWith.contains(day)) day -= DAY_MS
        while (daysWith.contains(day) && streak < maxDays) {
            streak++
            day -= DAY_MS
        }
        return streak
    }

    fun pruneBefore(beforeMs: Long) {
        writer.execute {
            try {
                helper.writableDatabase.delete(TABLE, "ts < ?", arrayOf(beforeMs.toString()))
            } catch (_: Exception) {
            }
        }
    }

    private class Helper(context: Context) : SQLiteOpenHelper(context, "pause_events.db", null, 1) {
        override fun onCreate(db: SQLiteDatabase) {
            db.execSQL(
                "CREATE TABLE $TABLE (id INTEGER PRIMARY KEY AUTOINCREMENT, pkg TEXT NOT NULL, ts INTEGER NOT NULL, type TEXT NOT NULL)",
            )
            db.execSQL("CREATE INDEX idx_ts ON $TABLE(ts)")
        }

        override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
            db.execSQL("DROP TABLE IF EXISTS $TABLE")
            onCreate(db)
        }
    }

    companion object {
        private const val TABLE = "events"
        private const val DAY_MS = 24L * 60 * 60 * 1000

        private fun startOfDay(ts: Long): Long = Calendar.getInstance().run {
            timeInMillis = ts
            set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0); set(Calendar.MILLISECOND, 0)
            timeInMillis
        }

        @Volatile
        private var instance: EventLog? = null

        fun get(context: Context): EventLog =
            instance ?: synchronized(this) {
                instance ?: EventLog(context.applicationContext).also { instance = it }
            }
    }
}
