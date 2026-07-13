package expo.modules.pausenative

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
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
 */
class EventLog(context: Context) {
    private val helper = Helper(context.applicationContext)
    private val writer = Executors.newSingleThreadExecutor()

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
    }
}
