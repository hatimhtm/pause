package expo.modules.pausenative

import android.content.Context
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.drawable.BitmapDrawable
import android.graphics.drawable.Drawable
import android.util.Base64
import java.io.ByteArrayOutputStream

/** Lists launchable apps with a small base64 PNG icon for the JS picker. */
class InstalledApps(context: Context) {
    private val pm = context.applicationContext.packageManager
    private val self = context.applicationContext.packageName

    fun list(): List<Map<String, Any?>> {
        val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
        return apps.asSequence()
            .filter { it.packageName != self }
            .filter { pm.getLaunchIntentForPackage(it.packageName) != null }
            .map {
                mapOf(
                    "packageName" to it.packageName,
                    "label" to pm.getApplicationLabel(it).toString(),
                    "isSystem" to ((it.flags and ApplicationInfo.FLAG_SYSTEM) != 0),
                    "icon" to iconBase64(it.packageName),
                )
            }
            .sortedBy { (it["label"] as String).lowercase() }
            .toList()
    }

    fun label(pkg: String): String = try {
        pm.getApplicationLabel(pm.getApplicationInfo(pkg, 0)).toString()
    } catch (e: PackageManager.NameNotFoundException) {
        pkg
    }

    private fun iconBase64(pkg: String): String? = try {
        val drawable = pm.getApplicationIcon(pkg)
        // 64px renders crisp at the 44dp avatar and roughly halves the bridge payload vs 96px.
        val bmp = drawableToBitmap(drawable, 64)
        val out = ByteArrayOutputStream()
        bmp.compress(Bitmap.CompressFormat.PNG, 100, out)
        "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
    } catch (e: Exception) {
        null
    }

    private fun drawableToBitmap(drawable: Drawable, size: Int): Bitmap {
        if (drawable is BitmapDrawable && drawable.bitmap != null) {
            return Bitmap.createScaledBitmap(drawable.bitmap, size, size, true)
        }
        val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bmp)
        drawable.setBounds(0, 0, size, size)
        drawable.draw(canvas)
        return bmp
    }
}
