const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FIX #1: ظ„ط§ ظٹظˆط¬ط¯ hardcoded package â€” ظ†ظ‚ط±ط£ظ‡ ظ…ظ† config ط§ظ„طھط·ط¨ظٹظ‚ ظپظٹ runtime
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function getPackage(config) {
  return (
    config.android?.package ||
    config.ios?.bundleIdentifier ||
    'com.ussdapp'
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// UssdAccessibilityService.kt
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildAccessibilityServiceKt(pkg) {
  return `package ${pkg}

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * ظٹط±ط§ظ‚ط¨ ظ†ظˆط§ظپط° ط§ظ„ظ€ dialer ظˆظٹظ…ظ†ط¹ ط¸ظ‡ظˆط± ظ†ط§ظپط°ط© USSD ظ„ظ„ظ…ط³طھط®ط¯ظ… ظ†ظ‡ط§ط¦ظٹط§ظ‹.
 *
 * ظƒظٹظپ ظٹط¹ظ…ظ„:
 *  - ظپظˆط± ط¸ظ‡ظˆط± ظ†ط§ظپط°ط© USSD ظ…ظ† ط§ظ„ظ€ dialer â†’ performGlobalAction(GLOBAL_ACTION_HOME)
 *    ظٹط®ظپظٹظ‡ط§ ظپظˆط±ط§ظ‹ ط®ظ„ظپ Launcher ط¨ط¯ظˆظ† ط¥ظ„ط؛ط§ط، ط§ظ„ط¬ظ„ط³ط©.
 *  - ط¨ط¹ط¯ظ‡ط§ ظ†ظڈط¹ظٹط¯ طھط·ط¨ظٹظ‚ظ†ط§ ظ„ظ„ط£ظ…ط§ظ….
 *  - ط§ظ„ط±ط¯ظˆط¯ طھظڈظ…ظ„ط£ ظپظٹ ط§ظ„ط®ظ„ظپظٹط© ط¹ط¨ط± tryFillAllWindows().
 *  - ظ„ط¥ظ†ظ‡ط§ط، ط§ظ„ط¬ظ„ط³ط© ظپظ‚ط· ظ†ط¶ط؛ط· BACK ط¹ظ„ظ‰ ظ†ط§ظپط°ط© ط§ظ„ظ€ dialer طھط­ط¯ظٹط¯ط§ظ‹.
 */
class UssdAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "UssdA11y"
        var instance: UssdAccessibilityService? = null
        var nativeModuleRef: UssdNativeModule? = null

        @Volatile var awaitingReply: String? = null
        @Volatile private var lastForwardedText: String = ""
        @Volatile var sessionActive: Boolean = false

        // FIX #5: dedupe ط¨ظٹظ† callback ظˆط§ظ„ظ€ accessibility layer
        // ظ†ط­ظپط¸ ط¢ط®ط± ظ†طµ ط£ط±ط³ظ„ظ‡ NativeModule ظƒظٹ ظ„ط§ ظٹظڈط±ط³ظ„ ظ…ط±طھظٹظ†
        @Volatile var lastNativeModuleText: String = ""

        fun setAwaitingReply(text: String) {
            awaitingReply = text
            instance?.tryImmediateFill()
        }

        // FIX #6: cancelAndDismiss ظٹط³طھظ‡ط¯ظپ ظ†ط§ظپط°ط© ط§ظ„ظ€ dialer طھط­ط¯ظٹط¯ط§ظ‹ ط¨ط¯ظ„ GLOBAL_ACTION_BACK ط§ظ„ط¹ط§ظ…
        fun cancelAndDismiss() {
            awaitingReply = null
            lastForwardedText = ""
            lastNativeModuleText = ""
            sessionActive = false
            instance?.dismissDialerWindow()
        }
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val dialerPackages = setOf(
        "com.android.phone",
        "com.google.android.dialer",
        "com.samsung.android.dialer",
        "com.android.dialer",
        "com.huawei.phone",
        "com.miui.phone"
    )

    private var lastHideTime = 0L

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                    AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
            packageNames = dialerPackages.toTypedArray()
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 50
            flags = AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
        }
        serviceInfo = info
        Log.d(TAG, "Service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val pkg = event.packageName?.toString() ?: return
        if (!dialerPackages.contains(pkg)) return

        when (event.eventType) {
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                val root = rootInActiveWindow ?: return
                handleDialerWindow(root, isNewWindow = true)
            }
            AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED -> {
                val root = rootInActiveWindow ?: return
                handleDialerWindow(root, isNewWindow = false)
            }
        }
    }

    private fun handleDialerWindow(root: AccessibilityNodeInfo, isNewWindow: Boolean) {
        val messageText = extractUssdMessage(root) ?: return
        if (messageText.isBlank()) return

        if (!isNewWindow && messageText == lastForwardedText) return
        lastForwardedText = messageText
        sessionActive = true

        Log.d(TAG, "USSD text intercepted: $messageText")

        // ط£ط®ظپظگ ط§ظ„ظ†ط§ظپط°ط© ظپظˆط±ط§ظ‹ ط¨ظ€ HOME (ظ„ط§ ظٹظ„ط؛ظٹ ط¬ظ„ط³ط© USSD)
        val now = System.currentTimeMillis()
        if (now - lastHideTime > 300) {
            lastHideTime = now
            performGlobalAction(GLOBAL_ACTION_HOME)
        }

        // FIX #5: ظ„ط§ طھط±ط³ظ„ ط§ظ„ظ†طµ ط¥ط°ط§ NativeModule ط£ط±ط³ظ„ظ‡ ط¨ط§ظ„ظپط¹ظ„
        if (messageText != lastNativeModuleText) {
            nativeModuleRef?.sendUssdScreenEvent(messageText)
        }

        // ط¥ط°ط§ ظپظٹ ط±ط¯ ظ…ظ†طھط¸ط± â†’ ط§ط±ط¯ظ‘ ظپظˆط±ط§ظ‹
        val reply = awaitingReply
        if (reply != null) {
            awaitingReply = null
            mainHandler.postDelayed({ tryFillAllWindows(reply) }, 150)
        }

        // ط£ط¹ط¯ طھط·ط¨ظٹظ‚ظ†ط§ ظ„ظ„ط£ظ…ط§ظ… ط¨ط¹ط¯ ط§ظ„ط¥ط®ظپط§ط،
        mainHandler.postDelayed({ bringAppToForeground() }, 100)
    }

    fun tryImmediateFill() {
        mainHandler.post {
            val reply = awaitingReply ?: return@post
            val filled = tryFillAllWindows(reply)
            if (filled) awaitingReply = null
        }
    }

    private fun tryFillAllWindows(reply: String): Boolean {
        // ط£ظˆظ„ط§ظ‹ ط¬ط±ط¨ ط§ظ„ظ†ط§ظپط°ط© ط§ظ„ظ†ط´ط·ط©
        rootInActiveWindow?.let { root ->
            val pkg = root.packageName?.toString()
            if (pkg != null && dialerPackages.contains(pkg)) {
                if (fillAndSend(root, reply)) return true
            }
        }
        // ط«ط§ظ†ظٹط§ظ‹ ط§ظ…ط´ظگ ط¹ظ„ظ‰ ظƒظ„ ط§ظ„ظ†ظˆط§ظپط°
        try {
            windows?.forEach { win ->
                val root = win.root ?: return@forEach
                val pkg = root.packageName?.toString() ?: return@forEach
                if (dialerPackages.contains(pkg)) {
                    if (fillAndSend(root, reply)) return true
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "windows iteration failed: \${e.message}")
        }
        return false
    }

    // FIX #6: ظٹط³طھظ‡ط¯ظپ ظ†ط§ظپط°ط© ط§ظ„ظ€ dialer طھط­ط¯ظٹط¯ط§ظ‹ ظˆظٹط¶ط؛ط· BACK ط¹ظ„ظٹظ‡ط§
    fun dismissDialerWindow() {
        mainHandler.post {
            try {
                windows?.forEach { win ->
                    val root = win.root ?: return@forEach
                    val pkg = root.packageName?.toString() ?: return@forEach
                    if (dialerPackages.contains(pkg)) {
                        // BACK ط¹ظ„ظ‰ ط§ظ„ظ†ط§ظپط°ط© ط§ظ„ظ…ط³طھظ‡ط¯ظپط© ط¨ط¯ظ„ global BACK
                        win.performAction(android.view.accessibility.AccessibilityWindowInfo.ACTION_ACCESSIBILITY_FOCUS)
                        performGlobalAction(GLOBAL_ACTION_BACK)
                        return@post
                    }
                }
            } catch (e: Exception) {
                Log.w(TAG, "dismissDialerWindow failed: \${e.message}")
                // ط¢ط®ط± ط®ظٹط§ط±: global BACK
                performGlobalAction(GLOBAL_ACTION_BACK)
            }
        }
    }

    private fun extractUssdMessage(root: AccessibilityNodeInfo): String? {
        val texts = mutableListOf<String>()
        collectTexts(root, texts)
        if (texts.isEmpty()) return null
        val filtered = texts.filter { text ->
            text.length > 2 &&
            !text.equals("OK", ignoreCase = true) &&
            !text.equals("Cancel", ignoreCase = true) &&
            !text.equals("Send", ignoreCase = true) &&
            !text.equals("ط¥ط±ط³ط§ظ„", ignoreCase = true) &&
            !text.equals("ظ…ظˆط§ظپظ‚", ignoreCase = true) &&
            !text.equals("ط¥ظ„ط؛ط§ط،", ignoreCase = true)
        }
        return filtered.joinToString("\\n").trim().ifBlank { null }
    }

    private fun collectTexts(node: AccessibilityNodeInfo, out: MutableList<String>) {
        val className = node.className?.toString() ?: ""
        if (className != "android.widget.EditText") {
            val txt = node.text
            if (txt?.isNotBlank() == true) out.add(txt.toString().trim())
        }
        // FIX #3: ط§ط³طھط®ط¯ظ… continue@ ط¨ط¯ظ„ return ظ„ظ…ظ†ط¹ طھظˆظ‚ظپ traversal ط§ظ„ظ…ط¨ظƒط±
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            collectTexts(child, out)
        }
    }

    // FIX #4: fillAndSend طھط¹طھط¨ط± ط§ظ„ظ†ط¬ط§ط­ ظپظ‚ط· ظ„ظˆ ط§ظ„ظ†طµ ط§طھط­ط· + ط²ط± ط§ظ„ط¥ط±ط³ط§ظ„ ط§طھط¶ط؛ط· ظپط¹ظ„ط§ظ‹
    private fun fillAndSend(root: AccessibilityNodeInfo, reply: String): Boolean {
        val editTexts = findNodesByClass(root, "android.widget.EditText")
        val editNode = editTexts.firstOrNull() ?: run {
            Log.w(TAG, "No EditText found in dialer window")
            return false
        }

        val args = Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, reply)
        }
        var textSet = editNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)

        if (!textSet) {
            Log.w(TAG, "ACTION_SET_TEXT failed, trying click-then-set")
            editNode.performAction(AccessibilityNodeInfo.ACTION_CLICK)
            textSet = editNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        }

        val buttons = findNodesByClass(root, "android.widget.Button")
        val sendBtn = buttons.firstOrNull { btn ->
            val lbl = btn.text?.toString()?.lowercase() ?: ""
            lbl.contains("send") || lbl.contains("ok") ||
            lbl.contains("ط¥ط±ط³ط§ظ„") || lbl.contains("ظ…ظˆط§ظپظ‚") ||
            lbl.contains("confirm") || lbl.contains("reply") ||
            lbl.contains("yes") || lbl.contains("ظ†ط¹ظ…")
        } ?: buttons.lastOrNull()

        val btnClicked = sendBtn?.performAction(AccessibilityNodeInfo.ACTION_CLICK) ?: false

        if (sendBtn == null) Log.w(TAG, "No Send button found")

        Log.d(TAG, "fillAndSend: textSet=\$textSet btnClicked=\$btnClicked reply='\$reply'")

        // FIX #4: ظ†ط¬ط§ط­ ط­ظ‚ظٹظ‚ظٹ = ط§ظ„ظ†طµ ط§طھط­ط· + ط§ظ„ط²ط± ط§طھط¶ط؛ط·
        return textSet && btnClicked
    }

    // FIX #3: findNodesByClass ط¨ظ€ continue@ ط¨ط¯ظ„ return ظ„ظ…ظ†ط¹ ط§ظ„طھظˆظ‚ظپ ط§ظ„ظ…ط¨ظƒط±
    private fun findNodesByClass(
        root: AccessibilityNodeInfo,
        className: String
    ): List<AccessibilityNodeInfo> {
        val results = mutableListOf<AccessibilityNodeInfo>()
        fun traverse(node: AccessibilityNodeInfo) {
            if (node.className?.toString() == className) results.add(node)
            for (i in 0 until node.childCount) {
                val child = node.getChild(i) ?: continue  // FIX #3
                traverse(child)
            }
        }
        traverse(root)
        return results
    }

    private fun bringAppToForeground() {
        try {
            val intent = Intent(this, Class.forName("\${packageName}.MainActivity")).apply {
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_NO_ANIMATION
                )
                putExtra("from_ussd_service", true)
            }
            startActivity(intent)
        } catch (e: Exception) {
            Log.e(TAG, "bringAppToForeground failed: \${e.message}")
        }
    }

    override fun onInterrupt() {
        instance = null
    }
}`;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// UssdNativeModule.kt
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildNativeModuleKt(pkg) {
  return `package ${pkg}

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.telecom.TelecomManager
import android.telephony.TelephonyManager
import android.telephony.TelephonyManager.UssdResponseCallback
import android.util.Log
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.modules.core.PermissionAwareActivity
import com.facebook.react.modules.core.PermissionListener

class UssdNativeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), PermissionListener {

    companion object {
        const val MODULE_NAME = "UssdNativeModule"
        const val EVENT_SCREEN = "USSD_SCREEN_TEXT"
        const val EVENT_SESSION_END = "USSD_SESSION_ENDED"
        const val EVENT_ERROR = "USSD_ERROR"
        private const val TAG = "UssdNativeModule"
        private const val PERM_CODE = 9001
    }

    @Volatile private var pendingCode: String? = null
    @Volatile private var pendingSlot: Int = -1
    @Volatile private var pendingPromise: Promise? = null

    init {
        UssdAccessibilityService.nativeModuleRef = this
    }

    override fun getName() = MODULE_NAME
    override fun canOverrideExistingModule() = false

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ): Boolean {
        if (requestCode != PERM_CODE) return false
        val granted = grantResults.isNotEmpty() &&
                grantResults[0] == PackageManager.PERMISSION_GRANTED

        val code = pendingCode
        val slot = pendingSlot
        val promise = pendingPromise
        pendingCode = null; pendingSlot = -1; pendingPromise = null

        if (granted && code != null && promise != null) {
            doSendUssdRequest(code, slot, promise)
        } else {
            promise?.reject("PERMISSION_DENIED", "طµظ„ط§ط­ظٹط© CALL_PHONE ظ…ط±ظپظˆط¶ط©")
        }
        return true
    }

    @ReactMethod
    fun startUssd(code: String, simSlot: Int, promise: Promise) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.reject("API_TOO_LOW", "ظٹطھط·ظ„ط¨ Android 8.0 ط£ظˆ ط£ط­ط¯ط«")
            return
        }

        val hasPermission = ContextCompat.checkSelfPermission(
            reactContext, Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED

        if (hasPermission) {
            doSendUssdRequest(code, simSlot, promise)
        } else {
            val activity = currentActivity
            if (activity is PermissionAwareActivity) {
                pendingCode = code; pendingSlot = simSlot; pendingPromise = promise
                activity.requestPermissions(
                    arrayOf(Manifest.permission.CALL_PHONE), PERM_CODE, this
                )
            } else {
                promise.reject("NO_ACTIVITY", "ظ„ط§ ظٹظˆط¬ط¯ Activity ظ†ط´ط· ظ„ط·ظ„ط¨ ط§ظ„طµظ„ط§ط­ظٹط©")
            }
        }
    }

    private fun doSendUssdRequest(code: String, simSlot: Int, promise: Promise) {
        try {
            val tm = reactContext.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager
            val targetTm = if (simSlot >= 0) {
                val subId = getSubIdForSlot(simSlot)
                if (subId != -1) tm.createForSubscriptionId(subId) else tm
            } else tm

            val handler = Handler(Looper.getMainLooper())

            targetTm.sendUssdRequest(code, object : UssdResponseCallback() {
                override fun onReceiveUssdResponse(
                    telephonyManager: TelephonyManager,
                    request: String,
                    response: CharSequence
                ) {
                    val text = response.toString()
                    Log.d(TAG, "USSD response: \$text")
                    // FIX #5: ط³ط¬ظ‘ظ„ ط§ظ„ظ†طµ ظ‚ط¨ظ„ ط§ظ„ط¥ط±ط³ط§ظ„ ظƒظٹ ظٹطھط¬ظ†ط¨ظ‡ AccessibilityService
                    UssdAccessibilityService.lastNativeModuleText = text
                    sendUssdScreenEvent(text)
                }

                override fun onReceiveUssdResponseFailed(
                    telephonyManager: TelephonyManager,
                    request: String,
                    failureCode: Int
                ) {
                    Log.e(TAG, "USSD failed: \$failureCode")
                    val msg = when (failureCode) {
                        TelephonyManager.USSD_ERROR_SERVICE_UNAVAIL -> "ط®ط¯ظ…ط© USSD ط؛ظٹط± ظ…طھط§ط­ط©"
                        TelephonyManager.USSD_RETURN_FAILURE -> "ظپط´ظ„ USSD (ط±ظ…ط²: \$failureCode)"
                        else -> "ط®ط·ط£ USSD (ط±ظ…ط²: \$failureCode)"
                    }
                    sendErrorEvent(msg)
                    sendSessionEndEvent("error")
                    UssdAccessibilityService.sessionActive = false
                }
            }, handler)

            promise.resolve(true)
        } catch (se: SecurityException) {
            promise.reject("PERMISSION_DENIED", "طµظ„ط§ط­ظٹط© CALL_PHONE ظ…ط·ظ„ظˆط¨ط©: \${se.message}")
        } catch (e: Exception) {
            Log.e(TAG, "sendUssdRequest exception: \${e.message}")
            sendErrorEvent(e.message ?: "ط®ط·ط£ ط؛ظٹط± ظ…ط¹ط±ظˆظپ")
            promise.reject("USSD_ERROR", e.message, e)
        }
    }

    private fun getSubIdForSlot(slot: Int): Int {
        return try {
            val sm = reactContext.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) ?: return -1
            val clazz = Class.forName("android.telephony.SubscriptionManager")
            val method = clazz.getMethod("getActiveSubscriptionInfoForSimSlotIndex", Int::class.java)
            val info = method.invoke(sm, slot) ?: return -1
            info.javaClass.getMethod("getSubscriptionId").invoke(info) as? Int ?: -1
        } catch (_: Exception) { -1 }
    }

    @ReactMethod
    fun sendUssdReply(text: String, promise: Promise) {
        if (!UssdAccessibilityService.sessionActive) {
            promise.reject("NO_SESSION", "ظ„ط§ طھظˆط¬ط¯ ط¬ظ„ط³ط© USSD ظ†ط´ط·ط©")
            return
        }
        UssdAccessibilityService.setAwaitingReply(text)
        promise.resolve(true)
    }

    @ReactMethod
    fun cancelSession(promise: Promise) {
        UssdAccessibilityService.cancelAndDismiss()
        sendSessionEndEvent("user_cancelled")
        promise.resolve(true)
    }

    @ReactMethod
    fun checkAccessibilityEnabled(promise: Promise) {
        val name = "\${reactContext.packageName}/\${UssdAccessibilityService::class.java.name}"
        val value = Settings.Secure.getString(
            reactContext.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: ""
        promise.resolve(value.contains(name))
    }

    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            reactContext.startActivity(
                Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
            promise.resolve(true)
        } catch (e: Exception) { promise.resolve(false) }
    }

    @ReactMethod
    fun checkOverlayPermission(promise: Promise) {
        promise.resolve(
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                Settings.canDrawOverlays(reactContext)
            else true
        )
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                reactContext.startActivity(
                    Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:\${reactContext.packageName}")).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                )
            }
            promise.resolve(true)
        } catch (e: Exception) { promise.resolve(false) }
    }

    fun sendUssdScreenEvent(text: String) = emit(EVENT_SCREEN, text)
    fun sendSessionEndEvent(reason: String) = emit(EVENT_SESSION_END,
        Arguments.createMap().also { it.putString("reason", reason) })
    fun sendErrorEvent(message: String) = emit(EVENT_ERROR,
        Arguments.createMap().also { it.putString("message", message) })

    private fun emit(eventName: String, data: Any?) {
        try {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, data)
        } catch (_: Exception) {}
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}`;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// UssdPackage.kt
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildPackageKt(pkg) {
  return `package ${pkg}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class UssdPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(UssdNativeModule(reactContext))
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}`;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Plugin functions
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function withUssdKotlinFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      // FIX #1: ط§ظ‚ط±ط£ ط§ظ„ظ€ package ظ…ظ† config
      const pkg = getPackage(cfg);
      const pkgPath = pkg.replace(/\./g, '/');

      const root = cfg.modRequest.platformProjectRoot;
      const javaDir = path.join(root, 'app/src/main/java', pkgPath);
      const xmlDir  = path.join(root, 'app/src/main/res/xml');
      const valDir  = path.join(root, 'app/src/main/res/values');

      fs.mkdirSync(javaDir, { recursive: true });
      fs.mkdirSync(xmlDir,  { recursive: true });
      fs.mkdirSync(valDir,  { recursive: true });

      // ط§ظƒطھط¨ ظ…ظ„ظپط§طھ Kotlin ظ…ط¹ ط§ظ„ظ€ package ط§ظ„طµط­ظٹط­
      const kotlinFiles = {
        'UssdAccessibilityService.kt': buildAccessibilityServiceKt(pkg),
        'UssdNativeModule.kt': buildNativeModuleKt(pkg),
        'UssdPackage.kt': buildPackageKt(pkg),
      };
      for (const [filename, content] of Object.entries(kotlinFiles)) {
        fs.writeFileSync(path.join(javaDir, filename), content, 'utf8');
      }

      // ظ…ظ„ظپ XML ظ„ظ„ظ€ accessibility service
      const accessibilityXml = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:canRetrieveWindowContent="true"
    android:description="@string/accessibility_service_description"
    android:notificationTimeout="50"
    android:packageNames="com.android.phone,com.google.android.dialer,com.samsung.android.dialer,com.android.dialer,com.huawei.phone,com.miui.phone"
    android:settingsActivity="${pkg}.MainActivity" />`;

      fs.writeFileSync(
        path.join(xmlDir, 'accessibility_service_config.xml'),
        accessibilityXml,
        'utf8'
      );

      // strings
      const stringResources = `    <string name="accessibility_service_label">USSD ط¨ظˆط§ط¬ظ‡ط© ظ…ط±ط¦ظٹط©</string>
    <string name="accessibility_service_description">ظٹطھظٹط­ ظ„ظ„طھط·ط¨ظٹظ‚ ظ‚ط±ط§ط،ط© ط´ط§ط´ط§طھ USSD ظˆظ…ظ„ط، ط§ظ„ط±ط¯ظˆط¯ طھظ„ظ‚ط§ط¦ظٹط§ظ‹ ط¯ظˆظ† ط§ظ„ط­ط§ط¬ط© ظ„ظ†ط§ظپط°ط© ط§ظ„ظ†ط¸ط§ظ…</string>`;

      const strPath = path.join(valDir, 'strings.xml');
      if (!fs.existsSync(strPath)) {
        fs.writeFileSync(
          strPath,
          `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${stringResources}\n</resources>`,
          'utf8'
        );
      } else {
        let existing = fs.readFileSync(strPath, 'utf8');
        if (!existing.includes('accessibility_service_label')) {
          existing = existing.replace('</resources>', `${stringResources}\n</resources>`);
          fs.writeFileSync(strPath, existing, 'utf8');
        }
      }

      return cfg;
    },
  ]);
}

function withUssdManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = manifest.manifest.application[0];

    if (!(app.service || []).some(s => s.$['android:name'] === '.UssdAccessibilityService')) {
      if (!app.service) app.service = [];
      app.service.push({
        $: {
          'android:name': '.UssdAccessibilityService',
          'android:label': '@string/accessibility_service_label',
          'android:permission': 'android.permission.BIND_ACCESSIBILITY_SERVICE',
          'android:exported': 'true',
        },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'android.accessibilityservice.AccessibilityService' } }],
        }],
        'meta-data': [{
          $: {
            'android:name': 'android.accessibilityservice',
            'android:resource': '@xml/accessibility_service_config',
          },
        }],
      });
    }

    const permissions = [
      'android.permission.CALL_PHONE',
      'android.permission.READ_PHONE_STATE',
      'android.permission.READ_PHONE_NUMBERS',
    ];
    const existing = (manifest.manifest['uses-permission'] || []).map(p => p.$['android:name']);
    for (const perm of permissions) {
      if (!existing.includes(perm)) {
        if (!manifest.manifest['uses-permission']) manifest.manifest['uses-permission'] = [];
        manifest.manifest['uses-permission'].push({ $: { 'android:name': perm } });
      }
    }

    return cfg;
  });
}

// FIX #2: withMainApplication ظٹط¯ط¹ظ… Kotlin ظˆJava ظˆظٹط¶ظٹظپ import ط¨ط´ظƒظ„ ط¢ظ…ظ†
function withUssdMainApplication(config) {
  return withMainApplication(config, (cfg) => {
    const pkg = getPackage(cfg);
    let src = cfg.modResults.contents;
    const isKotlin = cfg.modResults.language === 'kt' ||
                     cfg.modResults.path?.endsWith('.kt');

    // ط£ط¶ظپ import ط¥ط°ط§ ظ…ط§ ظ…ظˆط¬ظˆط¯
    const importLine = isKotlin
      ? `import ${pkg}.UssdPackage`
      : `import ${pkg}.UssdPackage;`;

    if (!src.includes('UssdPackage')) {
      // ط£ط¶ظپ import ط¨ط¹ط¯ ط¢ط®ط± import ظ…ظˆط¬ظˆط¯
      src = src.replace(
        /(import [^\n]+\n)(?!import)/,
        `$1${importLine}\n`
      );

      // ط£ط¶ظپ ط§ظ„ظ€ package ظپظٹ ط§ظ„ظ…ظƒط§ظ† ط§ظ„طµط­ â€” ظٹط¯ط¹ظ… Kotlin ظˆJava
      const kotlinPattern = 'PackageList(this).packages.apply {';
      const javaPattern   = 'new PackageList(this).getPackages()';

      if (src.includes(kotlinPattern)) {
        src = src.replace(
          kotlinPattern,
          `${kotlinPattern}\n                    add(UssdPackage())`
        );
      } else if (src.includes(javaPattern)) {
        // Java fallback
        src = src.replace(
          javaPattern,
          `${javaPattern}; packages.add(new UssdPackage())`
        );
      }

      cfg.modResults.contents = src;
    }

    return cfg;
  });
}

module.exports = (config) => {
  config = withUssdKotlinFiles(config);
  config = withUssdManifest(config);
  config = withUssdMainApplication(config);
  return config;
};