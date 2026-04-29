const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
} = require('expo/config-plugins');
const path = require('path');
const fs = require('fs');

const PACKAGE = 'com.ussdapp';
const PACKAGE_PATH = PACKAGE.replace(/\./g, '/');

const KOTLIN_FILES = {
  'UssdAccessibilityService.kt': `package ${PACKAGE}

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo

/**
 * Intercepts USSD dialogs from dialer packages.
 *
 * Architecture:
 *  - The native USSD dialog is kept ALIVE in the background at all times during a session.
 *    We never press BACK mid-session because that would cancel the USSD session.
 *  - On each USSD step: extract text → forward to RN via event → bring our Activity
 *    to foreground so the dialog is hidden behind our app.
 *  - When user replies in our app, sendUssdReply() queues the text and calls
 *    tryImmediateFill() which targets the background dialog's EditText + Send button.
 *    If the window is not yet active, the reply is sent when the next accessibility
 *    event arrives (handleUssdDialog drains awaitingReply).
 *  - Session cancel: the NativeModule calls cancelAndDismiss() which presses BACK
 *    to close the background dialog only then.
 */
class UssdAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "UssdAccessibility"
        var instance: UssdAccessibilityService? = null
        var nativeModuleRef: UssdNativeModule? = null
        @Volatile private var awaitingReply: String? = null
        @Volatile private var lastForwardedText: String = ""

        /** Queue a reply; also attempts an immediate fill on the background dialog. */
        fun setAwaitingReply(text: String) {
            awaitingReply = text
            instance?.tryImmediateFill()
        }

        /**
         * Dismiss the background USSD dialog. Called ONLY when the user explicitly
         * cancels the session — never during normal step progression.
         */
        fun cancelAndDismiss() {
            awaitingReply = null
            lastForwardedText = ""
            instance?.performGlobalAction(GLOBAL_ACTION_BACK)
        }
    }

    private val mainHandler = Handler(Looper.getMainLooper())
    private val dialerPackages = setOf(
        "com.android.phone", "com.google.android.dialer",
        "com.samsung.android.dialer", "com.android.dialer"
    )

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        val info = serviceInfo ?: AccessibilityServiceInfo()
        info.eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED or
                AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED
        info.packageNames = dialerPackages.toTypedArray()
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
        info.notificationTimeout = 100
        serviceInfo = info
        Log.d(TAG, "AccessibilityService connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return
        val pkg = event.packageName?.toString() ?: return
        if (!dialerPackages.contains(pkg)) return
        val isStateChange = event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
        if (isStateChange || event.eventType == AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED) {
            val root = rootInActiveWindow ?: return
            handleUssdDialog(root, isStateChange)
        }
    }

    private fun handleUssdDialog(root: AccessibilityNodeInfo, isStateChange: Boolean) {
        val messageText = extractUssdMessage(root) ?: return
        if (messageText.isBlank()) return
        // Skip duplicate content-changed events to avoid flooding RN
        if (!isStateChange && messageText == lastForwardedText) return
        lastForwardedText = messageText
        Log.d(TAG, "USSD text: ${'$'}messageText")
        nativeModuleRef?.sendUssdScreenEvent(messageText)

        // Bring our Activity to the foreground so the user sees our UI,
        // NOT the native dialog. The dialog stays alive behind our app.
        bringAppToForeground()

        // If a reply was queued before this event, drain it now
        val reply = awaitingReply
        if (reply != null) {
            awaitingReply = null
            // Post with short delay to let the window settle after bringToForeground
            mainHandler.postDelayed({ fillInBackground(reply) }, 80)
        }
    }

    /**
     * Try to fill the reply immediately by posting to the main Looper.
     * The background dialer window may or may not be in rootInActiveWindow,
     * so we attempt fill with a retry.
     */
    fun tryImmediateFill() {
        mainHandler.post {
            val reply = awaitingReply ?: return@post
            val root = rootInActiveWindow
            if (root != null) {
                val pkg = root.packageName?.toString()
                if (pkg != null && dialerPackages.contains(pkg)) {
                    val success = fillAndSend(root, reply)
                    if (success) awaitingReply = null
                    return@post
                }
            }
            // Dialer not the active window yet; the reply will be drained on next event
        }
    }

    /**
     * Fill the reply into the background dialer window.
     * The active window at this point should be our app; we use rootInActiveWindow
     * via a stored reference. Since Android accessibility can access all windows,
     * we iterate available windows to find the dialer.
     */
    private fun fillInBackground(reply: String) {
        // Try active window first (may be ours or dialer depending on focus)
        val active = rootInActiveWindow
        if (active != null) {
            val pkg = active.packageName?.toString()
            if (pkg != null && dialerPackages.contains(pkg)) {
                fillAndSend(active, reply)
                return
            }
        }
        // Walk all windows to find the dialer dialog behind our app
        val windows = windows ?: return
        for (win in windows) {
            val root = win.root ?: continue
            val pkg = root.packageName?.toString() ?: continue
            if (dialerPackages.contains(pkg)) {
                fillAndSend(root, reply)
                break
            }
        }
    }

    private fun extractUssdMessage(root: AccessibilityNodeInfo): String? {
        val texts = mutableListOf<String>()
        collectTexts(root, texts)
        return if (texts.isEmpty()) null else texts.joinToString("\\n").trim()
    }

    private fun collectTexts(node: AccessibilityNodeInfo, out: MutableList<String>) {
        val txt = node.text
        if (txt?.isNotBlank() == true) out.add(txt.toString().trim())
        for (i in 0 until node.childCount) {
            val child = node.getChild(i) ?: continue
            collectTexts(child, out)
        }
    }

    /**
     * Set text in the USSD dialog's EditText and click Send/OK.
     * Does NOT press BACK — the dialog must remain alive to process the reply.
     * Returns true if the text field was found and SET_TEXT succeeded.
     */
    private fun fillAndSend(root: AccessibilityNodeInfo, reply: String): Boolean {
        val editTexts = findNodesByClass(root, "android.widget.EditText")
        val editNode = editTexts.firstOrNull() ?: run {
            Log.w(TAG, "fillAndSend: no EditText found")
            return false
        }
        val args = android.os.Bundle().apply {
            putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, reply)
        }
        val textSet = editNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
        val buttons = findNodesByClass(root, "android.widget.Button")
        val sendBtn = buttons.firstOrNull { btn ->
            val lbl = btn.text?.toString()?.lowercase() ?: ""
            lbl.contains("send") || lbl.contains("ok") || lbl.contains("إرسال") ||
            lbl.contains("موافق") || lbl.contains("confirm") || lbl.contains("reply")
        }
        if (sendBtn == null) {
            Log.w(TAG, "fillAndSend: no Send button found, trying first button")
            buttons.firstOrNull()?.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        } else {
            sendBtn.performAction(AccessibilityNodeInfo.ACTION_CLICK)
        }
        Log.d(TAG, "fillAndSend: textSet=${'$'}textSet reply=${'$'}reply")
        return textSet
    }

    private fun findNodesByClass(root: AccessibilityNodeInfo, className: String): List<AccessibilityNodeInfo> {
        val results = mutableListOf<AccessibilityNodeInfo>()
        fun traverse(node: AccessibilityNodeInfo) {
            if (node.className?.toString() == className) results.add(node)
            for (i in 0 until node.childCount) traverse(node.getChild(i) ?: return)
        }
        traverse(root)
        return results
    }

    private fun bringAppToForeground() {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_SINGLE_TOP or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                Intent.FLAG_ACTIVITY_NO_ANIMATION
            )
            putExtra("from_ussd_service", true)
        }
        // Aggressive re-foregrounding: dialer dialogs (especially Samsung)
        // can re-appear on top after our first launch. We re-trigger the
        // launch a few times to override.
        startActivity(intent)
        mainHandler.postDelayed({ try { startActivity(intent) } catch (_: Exception) {} }, 200)
        mainHandler.postDelayed({ try { startActivity(intent) } catch (_: Exception) {} }, 600)
        mainHandler.postDelayed({ try { startActivity(intent) } catch (_: Exception) {} }, 1200)
    }

    override fun onInterrupt() { instance = null }
    override fun onDestroy() { super.onDestroy(); instance = null }
}`,

  'UssdNativeModule.kt': `package ${PACKAGE}

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.telecom.TelecomManager
import android.content.Context
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class UssdNativeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val MODULE_NAME = "UssdNativeModule"
        const val EVENT_SCREEN = "USSD_SCREEN_TEXT"
        const val EVENT_SESSION_END = "USSD_SESSION_ENDED"
        const val EVENT_ERROR = "USSD_ERROR"
        const val EVENT_FOREGROUND = "USSD_BRING_FOREGROUND"
    }

    init { UssdAccessibilityService.nativeModuleRef = this }

    override fun getName() = MODULE_NAME
    override fun canOverrideExistingModule() = false

    @ReactMethod
    fun startUssd(code: String, simSlot: Int, promise: Promise) {
        try {
            val cleanCode = code.replace("#", "%23")
            val intent = Intent(Intent.ACTION_CALL, Uri.parse("tel:${'$'}cleanCode")).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (simSlot >= 0 && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val tm = reactContext.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
                    val handles = tm?.callCapablePhoneAccounts
                    if (handles != null && simSlot < handles.size)
                        putExtra("android.telecom.extra.PHONE_ACCOUNT_HANDLE", handles[simSlot])
                }
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            sendErrorEvent(e.message ?: "Unknown error starting USSD")
            promise.reject("USSD_START_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun sendUssdReply(text: String, promise: Promise) {
        // Queue the reply; AccessibilityService will fill it on next event
        // or try immediately if the dialer window is currently active
        UssdAccessibilityService.setAwaitingReply(text)
        promise.resolve(true)
    }

    @ReactMethod
    fun cancelSession(promise: Promise) {
        // Press BACK to dismiss the background USSD dialog and end the session.
        // This is the ONLY place GLOBAL_ACTION_BACK is used.
        UssdAccessibilityService.cancelAndDismiss()
        sendSessionEndEvent("user_cancelled")
        promise.resolve(true)
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
    fun checkAccessibilityEnabled(promise: Promise) {
        val serviceName = "${'$'}{reactContext.packageName}/${'$'}{UssdAccessibilityService::class.java.name}"
        val value = Settings.Secure.getString(
            reactContext.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES) ?: ""
        promise.resolve(value.contains(serviceName))
    }

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                reactContext.startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${'$'}{reactContext.packageName}")).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
            }
            promise.resolve(true)
        } catch (e: Exception) { promise.resolve(false) }
    }

    @ReactMethod
    fun openAccessibilitySettings(promise: Promise) {
        try {
            reactContext.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK) })
            promise.resolve(true)
        } catch (e: Exception) { promise.resolve(false) }
    }

    fun sendUssdScreenEvent(text: String) = emit(EVENT_SCREEN, text)
    fun sendSessionEndEvent(reason: String) = emit(EVENT_SESSION_END,
        Arguments.createMap().also { it.putString("reason", reason) })
    fun sendErrorEvent(message: String) = emit(EVENT_ERROR,
        Arguments.createMap().also { it.putString("message", message) })
    fun sendForegroundEvent() = emit(EVENT_FOREGROUND, null)

    private fun emit(eventName: String, data: Any?) {
        try {
            reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, data)
        } catch (_: Exception) {}
    }

    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}
}`,

  'UssdPackage.kt': `package ${PACKAGE}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class UssdPackage : ReactPackage {
    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(UssdNativeModule(reactContext))
    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}`,
};

const ACCESSIBILITY_XML = `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service
    xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeWindowStateChanged|typeWindowContentChanged"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:canRetrieveWindowContent="true"
    android:description="@string/accessibility_service_description"
    android:notificationTimeout="100"
    android:packageNames="com.android.phone,com.google.android.dialer,com.samsung.android.dialer,com.android.dialer"
    android:settingsActivity="${PACKAGE}.MainActivity" />`;

const STRING_RESOURCES_ADDON = `    <string name="accessibility_service_label">USSD بواجهة مرئية</string>
    <string name="accessibility_service_description">يتيح للتطبيق قراءة شاشات USSD وملء الردود تلقائياً دون الحاجة لنافذة النظام</string>`;

function withUssdKotlinFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const root = cfg.modRequest.platformProjectRoot;
      const javaDir = path.join(root, 'app/src/main/java', PACKAGE_PATH);
      const xmlDir = path.join(root, 'app/src/main/res/xml');
      const valuesDir = path.join(root, 'app/src/main/res/values');

      fs.mkdirSync(javaDir, { recursive: true });
      fs.mkdirSync(xmlDir, { recursive: true });
      fs.mkdirSync(valuesDir, { recursive: true });

      for (const [filename, content] of Object.entries(KOTLIN_FILES)) {
        fs.writeFileSync(path.join(javaDir, filename), content, 'utf8');
      }
      fs.writeFileSync(path.join(xmlDir, 'accessibility_service_config.xml'), ACCESSIBILITY_XML, 'utf8');

      const stringsPath = path.join(valuesDir, 'strings.xml');
      if (!fs.existsSync(stringsPath)) {
        fs.writeFileSync(stringsPath,
          `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n${STRING_RESOURCES_ADDON}\n</resources>`, 'utf8');
      } else {
        let existing = fs.readFileSync(stringsPath, 'utf8');
        if (!existing.includes('accessibility_service_label')) {
          existing = existing.replace('</resources>',
            `${STRING_RESOURCES_ADDON}\n</resources>`);
          fs.writeFileSync(stringsPath, existing, 'utf8');
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
          $: { 'android:name': 'android.accessibilityservice', 'android:resource': '@xml/accessibility_service_config' },
        }],
      });
    }

    const permissions = [
      'android.permission.CALL_PHONE',
      'android.permission.READ_PHONE_STATE',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.FOREGROUND_SERVICE',
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

function withUssdMainApplication(config) {
  return withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes('UssdPackage')) {
      src = src.replace(
        'PackageList(this).packages.apply {',
        'PackageList(this).packages.apply {\n                    add(UssdPackage())'
      );
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
