package expo.modules.pausenative

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import android.text.TextUtils
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class PauseNativeModule : Module() {

    private val context: Context
        get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

    override fun definition() = ModuleDefinition {
        Name("PauseNative")

        // The engine's own version — the UI ships OTA and needs to know which APK it's riding on.
        Function("getEngineVersion") { ENGINE_VERSION }

        // Launch the breathe screen harmlessly: nothing logged, nothing granted, both buttons close.
        Function("previewBreathe") {
            val cfg = ConfigStore(context).config()
            val sample = cfg.apps.values.firstOrNull()
            val intent = Intent(context, BreatheActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                putExtra(BreatheActivity.EXTRA_PREVIEW, true)
                putExtra(BreatheActivity.EXTRA_PACKAGE, sample?.packageName ?: "preview")
                putExtra(BreatheActivity.EXTRA_LABEL, sample?.label ?: "Instagram")
                putExtra(BreatheActivity.EXTRA_BREATH_SECONDS, sample?.breathSeconds ?: 15)
                putExtra(BreatheActivity.EXTRA_REFLECTION, true)
                putExtra(BreatheActivity.EXTRA_SESSION_MINUTES, cfg.sessionMinutes)
                putExtra(BreatheActivity.EXTRA_HAPTICS, cfg.haptics)
                putExtra(BreatheActivity.EXTRA_TITLE, cfg.breath.title)
                putExtra(BreatheActivity.EXTRA_REFLECTION_TEXT, cfg.breath.reflection)
                putExtra(BreatheActivity.EXTRA_CONTINUE_LABEL, cfg.breath.continueLabel)
                putExtra(BreatheActivity.EXTRA_DISMISS_LABEL, cfg.breath.dismissLabel)
                putExtra(BreatheActivity.EXTRA_COLOR_TOP, cfg.breath.colorTop)
                putExtra(BreatheActivity.EXTRA_COLOR_BOTTOM, cfg.breath.colorBottom)
                putExtra(BreatheActivity.EXTRA_COLOR_ACCENT, cfg.breath.colorAccent)
            }
            context.startActivity(intent)
        }

        // ---- Permission status ----
        Function("isAccessibilityEnabled") { isAccessibilityEnabled() }
        Function("isServiceRunning") { PauseAccessibilityService.isRunning }
        Function("hasUsageAccess") { UsageQuery(context).hasPermission() }
        Function("isNotificationAccessEnabled") { isNotificationAccessEnabled() }

        // ---- Open the relevant system settings screens ----
        Function("openAccessibilitySettings") { open(Settings.ACTION_ACCESSIBILITY_SETTINGS) }
        Function("openUsageAccessSettings") { open(Settings.ACTION_USAGE_ACCESS_SETTINGS) }
        Function("openNotificationAccessSettings") {
            val action = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R)
                Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
            else "android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS"
            open(action)
        }

        // ---- Config (JS is the source of truth; it writes the effective config down here) ----
        Function("setConfig") { json: String -> ConfigStore(context).save(json) }

        // ---- Data the stats screens read back ----
        AsyncFunction("getInstalledApps") { InstalledApps(context).list() }

        Function("getUsage") { start: Double, end: Double ->
            UsageQuery(context).usageBetween(start.toLong(), end.toLong())
                .mapValues { it.value.toDouble() }
        }

        Function("getOpens") { start: Double, end: Double ->
            UsageQuery(context).opensBetween(start.toLong(), end.toLong())
        }

        // Pre-aggregated long-range buckets ("daily"|"weekly"|"monthly"|"yearly").
        Function("getUsageHistory") { interval: String, start: Double, end: Double ->
            UsageQuery(context).history(interval, start.toLong(), end.toLong())
        }

        Function("getEvents") { since: Double ->
            EventLog.get(context).since(since.toLong()).map {
                mapOf(
                    "packageName" to it.packageName,
                    "timestamp" to it.timestamp.toDouble(),
                    "type" to it.type,
                )
            }
        }

        Function("pruneEventsBefore") { before: Double -> EventLog.get(context).pruneBefore(before.toLong()) }
    }

    private fun open(action: String) {
        context.startActivity(Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun isAccessibilityEnabled(): Boolean {
        val expected = ComponentName(context, PauseAccessibilityService::class.java).flattenToString()
        val enabled = Settings.Secure.getString(
            context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ) ?: return false
        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(enabled)
        while (splitter.hasNext()) {
            if (splitter.next().equals(expected, ignoreCase = true)) return true
        }
        return false
    }

    private fun isNotificationAccessEnabled(): Boolean {
        val expected = ComponentName(context, PauseNotificationListener::class.java).flattenToString()
        val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
        return flat.split(":").any { it.equals(expected, ignoreCase = true) }
    }

    companion object {
        /** Bump alongside every native change — the OTA'd UI reads this to offer the new APK. */
        private const val ENGINE_VERSION = "1.4.0"
    }
}
