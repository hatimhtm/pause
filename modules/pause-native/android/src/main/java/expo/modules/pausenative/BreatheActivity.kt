package expo.modules.pausenative

import android.animation.ValueAnimator
import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.animation.LinearInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import java.util.concurrent.Executors

/**
 * The full-screen breathing interstitial. Native (not React Native) so it appears instantly when a
 * watched app opens — a JS screen would cold-start too slowly and let the app flash through. Its
 * copy, colours and timing come from the JS config via intent extras, so it can still be restyled
 * over-the-air without a native rebuild.
 */
class BreatheActivity : Activity() {

    private var remaining = 8
    private var breathSeconds = 8
    private lateinit var pkg: String
    private var sessionMinutes = 5
    private var accent = Color.parseColor("#BFE3E2")

    private lateinit var countdownText: TextView
    private lateinit var phaseText: TextView
    private lateinit var continueButton: Button
    private lateinit var reflectionText: TextView
    private lateinit var todayText: TextView
    private val ui = Handler(Looper.getMainLooper())
    private val io = Executors.newSingleThreadExecutor()
    private var label: String = ""
    private var continueLabelTemplate: String = "Open anyway"

    private val tick = object : Runnable {
        override fun run() {
            remaining -= 1
            if (remaining <= 0) {
                countdownText.text = "✓"
                phaseText.text = "Still want to?"
                enableContinue()
            } else {
                countdownText.text = remaining.toString()
                ui.postDelayed(this, 1000)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        pkg = intent.getStringExtra(EXTRA_PACKAGE) ?: run { finish(); return }
        label = intent.getStringExtra(EXTRA_LABEL) ?: pkg
        breathSeconds = intent.getIntExtra(EXTRA_BREATH_SECONDS, 8).coerceIn(3, 60)
        remaining = breathSeconds
        sessionMinutes = intent.getIntExtra(EXTRA_SESSION_MINUTES, 5)
        val showReflection = intent.getBooleanExtra(EXTRA_REFLECTION, true)
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "Take a breath"
        val reflection = intent.getStringExtra(EXTRA_REFLECTION_TEXT) ?: "Why are you opening it?"
        continueLabelTemplate = intent.getStringExtra(EXTRA_CONTINUE_LABEL) ?: "Open anyway"
        val dismissLabel = intent.getStringExtra(EXTRA_DISMISS_LABEL) ?: "Not now"
        val top = parseColor(intent.getStringExtra(EXTRA_COLOR_TOP), "#06403F")
        val bottom = parseColor(intent.getStringExtra(EXTRA_COLOR_BOTTOM), "#0E7C7B")
        accent = parseColor(intent.getStringExtra(EXTRA_COLOR_ACCENT), "#BFE3E2")

        setContentView(buildUi(title, reflection, showReflection, continueLabelTemplate, dismissLabel, top, bottom))
        startBreathingAnimation()
        ui.postDelayed(tick, 1000)
        loadTodayMinutes()
    }

    private fun buildUi(
        title: String,
        reflection: String,
        showReflection: Boolean,
        continueLabel: String,
        dismissLabel: String,
        top: Int,
        bottom: Int,
    ): View {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            background = GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                intArrayOf(top, bottom),
            )
            setPadding(dp(28), dp(48), dp(28), dp(36))
        }

        // Top block
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
        }
        header.addView(TextView(this).apply {
            text = title
            setTextColor(accent)
            textSize = 15f
            gravity = Gravity.CENTER
        })
        header.addView(TextView(this).apply {
            text = "Opening $label"
            setTextColor(Color.WHITE)
            textSize = 26f
            gravity = Gravity.CENTER
            setPadding(0, dp(6), 0, 0)
        })
        todayText = TextView(this).apply {
            text = ""
            setTextColor(accent)
            textSize = 14f
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, 0)
        }
        header.addView(todayText)
        root.addView(header, lp(matchWidth = true, weight = 0f).apply { topMargin = dp(8) })

        // Middle: breathing circles + countdown
        val circleWrap = FrameLayout(this)
        outerCircle = View(this).apply {
            background = circleDrawable(withAlpha(accent, 46))
            layoutParams = FrameLayout.LayoutParams(dp(220), dp(220), Gravity.CENTER)
        }
        innerCircle = FrameLayout(this).apply {
            background = circleDrawable(withAlpha(accent, 77))
            layoutParams = FrameLayout.LayoutParams(dp(150), dp(150), Gravity.CENTER)
        }
        countdownText = TextView(this).apply {
            text = remaining.toString()
            setTextColor(Color.WHITE)
            textSize = 40f
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }
        innerCircle.addView(countdownText)
        circleWrap.addView(outerCircle)
        circleWrap.addView(innerCircle)
        root.addView(circleWrap, lp(matchWidth = true, weight = 1f).apply { gravity = Gravity.CENTER })

        phaseText = TextView(this).apply {
            text = "Breathe in…"
            setTextColor(Color.WHITE)
            textSize = 20f
            gravity = Gravity.CENTER
        }
        root.addView(phaseText, lp(matchWidth = true, weight = 0f).apply { bottomMargin = dp(16) })

        // Bottom: reflection + buttons
        reflectionText = TextView(this).apply {
            text = reflection
            setTextColor(accent)
            textSize = 13f
            gravity = Gravity.CENTER
            visibility = if (showReflection) View.VISIBLE else View.GONE
            setPadding(0, 0, 0, dp(12))
        }
        root.addView(reflectionText)

        continueButton = Button(this).apply {
            text = "Wait ${remaining}s"
            isAllCaps = false
            textSize = 16f
            setTextColor(withAlpha(Color.WHITE, 150))
            background = buttonBg(withAlpha(Color.WHITE, 64))
            isEnabled = false
            setOnClickListener { onContinue() }
        }
        root.addView(continueButton, lp(matchWidth = true, weight = 0f).apply { height = dp(56) })

        val dismissButton = Button(this).apply {
            text = dismissLabel
            isAllCaps = false
            textSize = 15f
            setTextColor(Color.WHITE)
            background = outlineBg(withAlpha(Color.WHITE, 120))
            setOnClickListener { onDismiss() }
        }
        root.addView(dismissButton, lp(matchWidth = true, weight = 0f).apply { topMargin = dp(10); height = dp(52) })

        return root
    }

    private lateinit var outerCircle: View
    private lateinit var innerCircle: FrameLayout

    private fun startBreathingAnimation() {
        val half = (breathSeconds.coerceAtLeast(4) * 1000L) / 2
        val animator = ValueAnimator.ofFloat(0.68f, 1f).apply {
            duration = half
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            interpolator = LinearInterpolator()
            addUpdateListener { a ->
                val s = a.animatedValue as Float
                outerCircle.scaleX = s; outerCircle.scaleY = s
                innerCircle.scaleX = s; innerCircle.scaleY = s
                if (remaining > 0) {
                    phaseText.text = if (s > 0.84f) "Breathe in…" else "…and out"
                }
            }
        }
        animator.start()
    }

    private fun enableContinue() {
        continueButton.isEnabled = true
        continueButton.text = continueLabelTemplate.replace("{app}", label)
        continueButton.setTextColor(parseColor("#06403F", "#06403F"))
        continueButton.background = buttonBg(Color.WHITE)
    }

    private fun loadTodayMinutes() {
        io.execute {
            val q = UsageQuery(this)
            if (!q.hasPermission()) return@execute
            val minutes = (q.usageBetween(UsageQuery.startOfToday(), System.currentTimeMillis())[pkg] ?: 0L) / 60000L
            ui.post {
                todayText.text = if (minutes <= 0) "No time here yet today" else "$minutes min here already today"
            }
        }
    }

    private fun onContinue() {
        GrantRegistry.grant(pkg, System.currentTimeMillis() + sessionMinutes * 60_000L)
        EventLog(this).log(pkg, EventType.CONTINUED, System.currentTimeMillis())
        finish()
    }

    private fun onDismiss() {
        EventLog(this).log(pkg, EventType.DISMISSED, System.currentTimeMillis())
        val home = Intent(Intent.ACTION_MAIN).apply {
            addCategory(Intent.CATEGORY_HOME)
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        startActivity(home)
        finish()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        onDismiss()
    }

    override fun onDestroy() {
        ui.removeCallbacksAndMessages(null)
        super.onDestroy()
    }

    // --- helpers ---
    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    private fun lp(matchWidth: Boolean, weight: Float): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(
            if (matchWidth) ViewGroup.LayoutParams.MATCH_PARENT else ViewGroup.LayoutParams.WRAP_CONTENT,
            0.takeIf { weight > 0f } ?: ViewGroup.LayoutParams.WRAP_CONTENT,
            weight,
        )

    private fun circleDrawable(color: Int) = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(color)
    }

    private fun buttonBg(color: Int) = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(16).toFloat()
        setColor(color)
    }

    private fun outlineBg(stroke: Int) = GradientDrawable().apply {
        shape = GradientDrawable.RECTANGLE
        cornerRadius = dp(16).toFloat()
        setColor(Color.TRANSPARENT)
        setStroke(dp(1), stroke)
    }

    private fun withAlpha(color: Int, alpha: Int): Int =
        Color.argb(alpha, Color.red(color), Color.green(color), Color.blue(color))

    private fun parseColor(value: String?, fallback: String): Int = try {
        Color.parseColor(value ?: fallback)
    } catch (e: Exception) {
        Color.parseColor(fallback)
    }

    companion object {
        const val EXTRA_PACKAGE = "pkg"
        const val EXTRA_LABEL = "label"
        const val EXTRA_BREATH_SECONDS = "breath"
        const val EXTRA_REFLECTION = "reflection"
        const val EXTRA_SESSION_MINUTES = "session"
        const val EXTRA_DOWNTIME = "downtime"
        const val EXTRA_TITLE = "title"
        const val EXTRA_REFLECTION_TEXT = "reflectionText"
        const val EXTRA_CONTINUE_LABEL = "continueLabel"
        const val EXTRA_DISMISS_LABEL = "dismissLabel"
        const val EXTRA_COLOR_TOP = "colorTop"
        const val EXTRA_COLOR_BOTTOM = "colorBottom"
        const val EXTRA_COLOR_ACCENT = "colorAccent"
    }
}
