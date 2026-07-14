package expo.modules.pausenative

import android.animation.ArgbEvaluator
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
import android.view.animation.AccelerateDecelerateInterpolator
import android.view.animation.LinearInterpolator
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import java.util.concurrent.Executors
import kotlin.random.Random

/**
 * The full-screen breathing interstitial. Native (not React Native) so it appears instantly when a
 * watched app opens — a JS screen would cold-start too slowly and let the app flash through. Its
 * copy, colours and timing come from the JS config via intent extras, so it can still be restyled
 * over-the-air without a native rebuild.
 *
 * Deliberately shows NO countdown or progress: visible timers make waits feel ~30% shorter and
 * give a sense of control (pedestrian countdown studies), and a learnable fixed length invites
 * counting along on autopilot (the documented one-sec habituation failure). So the wait length is
 * randomized per open (+0–40%), the only exit shown during the wait is "close", and "open anyway"
 * appears late, small and unceremoniously — no checkmark, no reward for waiting it out.
 */
class BreatheActivity : Activity() {

    private var remaining = MIN_BREATH_SECONDS
    private var breathSeconds = MIN_BREATH_SECONDS
    private lateinit var pkg: String
    private var sessionMinutes = 5
    private var accent = Color.parseColor("#BFE3E2")

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
                revealContinue()
            } else {
                ui.postDelayed(this, 1000)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        pkg = intent.getStringExtra(EXTRA_PACKAGE) ?: run { finish(); return }
        label = intent.getStringExtra(EXTRA_LABEL) ?: pkg
        breathSeconds = intent.getIntExtra(EXTRA_BREATH_SECONDS, MIN_BREATH_SECONDS)
            .coerceIn(MIN_BREATH_SECONDS, 120)
        // Unpredictable wait: the configured length plus 0–40%, so it can't be counted along.
        remaining = breathSeconds + Random.nextInt(0, breathSeconds * 2 / 5 + 1)
        sessionMinutes = intent.getIntExtra(EXTRA_SESSION_MINUTES, 5)
        val showReflection = intent.getBooleanExtra(EXTRA_REFLECTION, true)
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "Take a breath"
        val configured = intent.getStringExtra(EXTRA_REFLECTION_TEXT) ?: "Why are you opening it?"
        // A different question each open — a fixed one stops being read after a week.
        val reflection = (REFLECTION_PROMPTS + configured).random()
        continueLabelTemplate = intent.getStringExtra(EXTRA_CONTINUE_LABEL) ?: "Open anyway"
        val dismissLabel = intent.getStringExtra(EXTRA_DISMISS_LABEL) ?: "Not now"
        topColor = parseColor(intent.getStringExtra(EXTRA_COLOR_TOP), "#06403F")
        bottomColor = parseColor(intent.getStringExtra(EXTRA_COLOR_BOTTOM), "#0E7C7B")
        accent = parseColor(intent.getStringExtra(EXTRA_COLOR_ACCENT), "#BFE3E2")

        val content = buildUi(title, reflection, showReflection, continueLabelTemplate, dismissLabel, topColor, bottomColor)
        setContentView(content)
        // Ease in instead of snapping over the app that just opened.
        content.alpha = 0f
        content.translationY = dp(10).toFloat()
        content.animate().alpha(1f).translationY(0f).setDuration(380).start()
        startBreathingAnimation()
        ui.postDelayed(tick, 1000)
        loadGuiltLines()
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
        bgDrawable = GradientDrawable(
            GradientDrawable.Orientation.TOP_BOTTOM,
            intArrayOf(top, bottom),
        )
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            background = bgDrawable
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
            textSize = 15f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            setPadding(0, dp(8), 0, 0)
        }
        header.addView(todayText)
        root.addView(header, lp(matchWidth = true, weight = 0f).apply { topMargin = dp(8) })

        // Middle: a soft layered orb. No countdown anywhere — a visible timer makes the wait
        // feel shorter and gives something to "watch", which is exactly what we don't want.
        circleWrap = FrameLayout(this)
        glowOrb = View(this).apply {
            background = glowDrawable(withAlpha(accent, 70), 150)
            layoutParams = FrameLayout.LayoutParams(dp(300), dp(300), Gravity.CENTER)
        }
        circleWrap.addView(glowOrb)
        rippleRing = View(this).apply {
            background = ringDrawable(withAlpha(accent, 200))
            layoutParams = FrameLayout.LayoutParams(dp(220), dp(220), Gravity.CENTER)
            alpha = 0f
        }
        circleWrap.addView(rippleRing)
        outerCircle = View(this).apply {
            background = circleDrawable(withAlpha(accent, 38))
            layoutParams = FrameLayout.LayoutParams(dp(220), dp(220), Gravity.CENTER)
        }
        innerCircle = FrameLayout(this).apply {
            background = circleDrawable(withAlpha(accent, 77))
            layoutParams = FrameLayout.LayoutParams(dp(150), dp(150), Gravity.CENTER)
        }
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

        // Leaving is the big, inviting, always-available action…
        val dismissButton = Button(this).apply {
            text = dismissLabel
            isAllCaps = false
            textSize = 16f
            setTextColor(top)
            background = buttonBg(Color.WHITE)
            setOnClickListener { onDismiss() }
        }
        root.addView(dismissButton, lp(matchWidth = true, weight = 0f).apply { height = dp(56) })

        // …and continuing only materialises once the breath is over: small, dim, no fanfare.
        continueButton = Button(this).apply {
            text = continueLabel.replace("{app}", label)
            isAllCaps = false
            textSize = 14f
            setTextColor(withAlpha(Color.WHITE, 170))
            background = outlineBg(withAlpha(Color.WHITE, 70))
            visibility = View.INVISIBLE
            isEnabled = false
            setOnClickListener { onContinue() }
        }
        root.addView(continueButton, lp(matchWidth = true, weight = 0f).apply { topMargin = dp(10); height = dp(46) })

        return root
    }

    private lateinit var outerCircle: View
    private lateinit var innerCircle: FrameLayout
    private lateinit var rippleRing: View
    private lateinit var glowOrb: View
    private lateinit var circleWrap: FrameLayout
    private lateinit var bgDrawable: GradientDrawable
    private var topColor = Color.parseColor("#06403F")
    private var bottomColor = Color.parseColor("#0E7C7B")
    private var currentPhase = ""
    private val animators = ArrayList<ValueAnimator>()
    private val argb = ArgbEvaluator()

    /** Crossfade the phase label instead of snapping it. */
    private fun setPhase(text: String) {
        if (text == currentPhase) return
        currentPhase = text
        phaseText.animate().alpha(0.2f).setDuration(160).withEndAction {
            phaseText.text = text
            phaseText.animate().alpha(1f).setDuration(260).start()
        }.start()
    }

    private fun startBreathingAnimation() {
        // 4s per half-breath reads as calm regardless of how long the wait is.
        val half = 4000L

        // Glow + outer circle carry the main breath.
        animators += ValueAnimator.ofFloat(0.68f, 1f).apply {
            duration = half
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener { a ->
                val s = a.animatedValue as Float
                outerCircle.scaleX = s; outerCircle.scaleY = s
                glowOrb.scaleX = 0.85f + 0.35f * s
                glowOrb.scaleY = 0.85f + 0.35f * s
                glowOrb.alpha = 0.55f + 0.45f * s
                if (remaining > 0) {
                    setPhase(if (s > 0.84f) "Breathe in…" else "…and out")
                }
            }
        }

        // The inner circle follows a beat behind — layered motion reads as organic, not mechanical.
        animators += ValueAnimator.ofFloat(0.72f, 1f).apply {
            duration = half
            startDelay = 320L
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener { a ->
                val s = a.animatedValue as Float
                innerCircle.scaleX = s; innerCircle.scaleY = s
            }
        }

        // A ring detaches and dissolves outward once per breath cycle.
        animators += ValueAnimator.ofFloat(0f, 1f).apply {
            duration = half * 2
            repeatCount = ValueAnimator.INFINITE
            interpolator = LinearInterpolator()
            addUpdateListener { a ->
                val t = a.animatedValue as Float
                val s = 1f + 0.55f * t
                rippleRing.scaleX = s; rippleRing.scaleY = s
                rippleRing.alpha = (1f - t) * 0.35f
            }
        }

        // The gradient itself breathes, very slowly, between its two colours.
        animators += ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 9000L
            repeatCount = ValueAnimator.INFINITE
            repeatMode = ValueAnimator.REVERSE
            interpolator = AccelerateDecelerateInterpolator()
            addUpdateListener { a ->
                val t = a.animatedValue as Float
                bgDrawable.colors = intArrayOf(
                    argb.evaluate(0.30f * t, topColor, bottomColor) as Int,
                    argb.evaluate(0.20f * t, bottomColor, topColor) as Int,
                )
            }
        }

        // Faint embers drifting up through the orb — slow, sparse, alive.
        repeat(7) {
            val size = dp(3 + Random.nextInt(5))
            val particle = View(this).apply {
                background = circleDrawable(withAlpha(accent, 160))
                layoutParams = FrameLayout.LayoutParams(size, size, Gravity.CENTER)
                translationX = dp(Random.nextInt(-130, 131)).toFloat()
                alpha = 0f
            }
            circleWrap.addView(particle)
            animators += ValueAnimator.ofFloat(0f, 1f).apply {
                duration = (5200 + Random.nextInt(3800)).toLong()
                startDelay = Random.nextInt(4000).toLong()
                repeatCount = ValueAnimator.INFINITE
                interpolator = LinearInterpolator()
                addUpdateListener { a ->
                    val t = a.animatedValue as Float
                    particle.translationY = dp(150) * (1f - 2f * t)
                    particle.alpha = kotlin.math.sin(Math.PI * t).toFloat() * 0.65f
                }
            }
        }

        animators.forEach { it.start() }
    }

    /** The wait is over — let the quiet way in fade up. No checkmark, no reward. */
    private fun revealContinue() {
        setPhase("Still worth it?")
        continueButton.isEnabled = true
        continueButton.alpha = 0f
        continueButton.visibility = View.VISIBLE
        continueButton.animate().alpha(1f).setDuration(600).start()
    }

    // Rotating "look what this app is costing you" lines. The point is that the numbers are
    // real — today, yesterday, this week, open count — so the pause stings instead of soothing.
    private var guiltLines: List<String> = emptyList()
    private var guiltIndex = 0
    private val guiltCycler = object : Runnable {
        override fun run() {
            if (guiltLines.size > 1) {
                guiltIndex = (guiltIndex + 1) % guiltLines.size
                todayText.animate().alpha(0f).setDuration(220).withEndAction {
                    todayText.text = guiltLines[guiltIndex]
                    todayText.animate().alpha(1f).setDuration(220).start()
                }.start()
            }
            ui.postDelayed(this, GUILT_INTERVAL_MS)
        }
    }

    private fun loadGuiltLines() {
        io.execute {
            val q = UsageQuery(this)
            val lines = ArrayList<String>()
            if (q.hasPermission()) {
                val now = System.currentTimeMillis()
                val todayStart = UsageQuery.startOfToday()
                val dayMs = 24L * 60 * 60 * 1000
                val todayMs = q.usageBetween(todayStart, now)[pkg] ?: 0L
                val yesterdayMs = q.usageBetween(todayStart - dayMs, todayStart)[pkg] ?: 0L
                val weekMs = q.usageBetween(todayStart - 6 * dayMs, now)[pkg] ?: 0L
                val opens = q.opensBetween(todayStart, now)[pkg] ?: 0

                lines += if (todayMs < 60_000) "Nothing wasted here yet today. Keep it that way?"
                else "You've already wasted ${fmtDuration(todayMs)} here today"
                if (opens > 1) lines += "This is open number $opens today"
                if (yesterdayMs >= 10 * 60_000) lines += "Yesterday: ${fmtDuration(yesterdayMs)} gone to $label"
                if (weekMs >= 30 * 60_000) lines += "${fmtDuration(weekMs)} lost to $label this week"
            }
            if (lines.isEmpty()) lines += "Do you actually need this right now?"
            ui.post {
                guiltLines = lines
                guiltIndex = 0
                todayText.text = lines[0]
                if (lines.size > 1) ui.postDelayed(guiltCycler, GUILT_INTERVAL_MS)
            }
        }
    }

    private fun fmtDuration(ms: Long): String {
        val min = ms / 60_000L
        return if (min < 60) "$min min" else "${min / 60} h ${min % 60} min"
    }

    private fun onContinue() {
        GrantRegistry.grant(pkg, System.currentTimeMillis() + sessionMinutes * 60_000L)
        EventLog(this).log(pkg, EventType.CONTINUED, System.currentTimeMillis())
        finish()
    }

    private fun onDismiss() {
        EventLog(this).log(pkg, EventType.DISMISSED, System.currentTimeMillis())
        // Walking away is the behaviour to reinforce — it gets the only positive feedback here.
        Toast.makeText(this, "Good call.", Toast.LENGTH_SHORT).show()
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
        animators.forEach { it.cancel() }
        animators.clear()
        io.shutdown()
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

    private fun ringDrawable(stroke: Int) = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.TRANSPARENT)
        setStroke(dp(2), stroke)
    }

    /** Soft radial falloff — reads as light, not as a shape. */
    private fun glowDrawable(color: Int, radiusDp: Int) = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        gradientType = GradientDrawable.RADIAL_GRADIENT
        gradientRadius = dp(radiusDp).toFloat()
        colors = intArrayOf(color, Color.TRANSPARENT)
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
        /** Hard floor — anything shorter is easy to sit through on autopilot. */
        const val MIN_BREATH_SECONDS = 15
        private const val GUILT_INTERVAL_MS = 4000L

        /** Rotated per open so the question keeps being read instead of pattern-matched away. */
        private val REFLECTION_PROMPTS = listOf(
            "Why are you opening it?",
            "What were you doing ten seconds ago?",
            "Will this make you feel better, or just later?",
            "What were you hoping to find in there?",
            "Is this a decision, or a reflex?",
            "What else could these minutes become?",
        )

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
