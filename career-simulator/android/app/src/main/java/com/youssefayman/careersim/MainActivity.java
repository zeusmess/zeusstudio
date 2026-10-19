package com.youssefayman.careersim;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Shows the game (assets/index.html, kept in career-simulator/web) full screen in a WebView.
 *
 * The page is served from https://appassets.androidplatform.net/ instead of file://, so it has an
 * ordinary web origin for its saved game and file access stays off. The page saves into its
 * localStorage and, through the AndroidSave bridge, into SharedPreferences as well, which Android's
 * backup also keeps.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";
    private static final String PREFS = "game";
    private static final String SAVE_KEY = "save";
    private static final int MAX_SAVE_LENGTH = 512 * 1024;
    private static final int MATCH = ViewGroup.LayoutParams.MATCH_PARENT;

    private View topBar;
    private View bottomBar;
    private FrameLayout webHolder;
    private WebView webView;
    private OnBackInvokedCallback backCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        drawBehindSystemBars();

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(getColor(R.color.sb_dark));
        // Behind the status bar: the colour of the page's header.
        topBar = new View(this);
        topBar.setBackgroundColor(getColor(R.color.sb_dark));
        webHolder = new FrameLayout(this);
        webHolder.setBackgroundColor(getColor(R.color.sb_light));
        // Behind the navigation bar: the page's white tab bar. Android 7 cannot draw dark
        // navigation buttons, so there the strip stays dark green.
        bottomBar = new View(this);
        bottomBar.setBackgroundColor(Build.VERSION.SDK_INT >= 26 ? Color.WHITE : getColor(R.color.sb_dark));
        root.addView(topBar, new LinearLayout.LayoutParams(MATCH, 0));
        root.addView(webHolder, new LinearLayout.LayoutParams(MATCH, 0, 1f));
        root.addView(bottomBar, new LinearLayout.LayoutParams(MATCH, 0));
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
                return fitSystemBars(view, insets);
            }
        });
        setContentView(root);
        setSystemBarIcons();

        webView = createWebView();
        if (webView == null) {
            showWebViewMissing();
            return;
        }
        webHolder.addView(webView, MATCH, MATCH);
        webView.loadUrl(START_URL);
        registerBackHandler();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (webView != null) {
            webView.resumeTimers();
            webView.onResume();
        }
    }

    @Override
    protected void onStop() {
        if (webView != null) {
            // The page also saves when it is hidden; this covers a page that missed that event.
            webView.evaluateJavascript("window.saveGame && saveGame()", null);
            webView.onPause();
            webView.pauseTimers();
        }
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (backCallback != null && Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().unregisterOnBackInvokedCallback(backCallback);
        }
        if (webView != null) {
            webHolder.removeView(webView);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    /** Android 12L and older. Android 13 and newer call {@link #backCallback} instead. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        handleBack();
    }

    private void registerBackHandler() {
        if (Build.VERSION.SDK_INT >= 33) {
            backCallback = new OnBackInvokedCallback() {
                @Override
                public void onBackInvoked() {
                    handleBack();
                }
            };
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, backCallback);
        }
    }

    /**
     * Back first goes to the page, which returns to its first tab. On the first tab the app moves
     * to the background like Home does, so the game is still there when it is opened again.
     */
    private void handleBack() {
        if (webView == null) {
            finish();
            return;
        }
        webView.evaluateJavascript(
                "(function(){try{return !!(window.onAndroidBack && window.onAndroidBack());}catch(e){return false;}})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String handled) {
                        if (!"true".equals(handled)) {
                            moveTaskToBack(true);
                        }
                    }
                });
    }

    /** The app draws edge to edge on every version (Android 15+ requires it); the insets keep the page clear of the bars. */
    @SuppressWarnings("deprecation")
    private void drawBehindSystemBars() {
        Window window = getWindow();
        if (Build.VERSION.SDK_INT >= 30) {
            window.setDecorFitsSystemWindows(false);
        } else {
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
            if (Build.VERSION.SDK_INT >= 26) {
                flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            }
            window.getDecorView().setSystemUiVisibility(flags);
        }
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }
    }

    /** Light status bar icons over the dark header, dark navigation buttons over the white tab bar. */
    private void setSystemBarIcons() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) {
                controller.setSystemBarsAppearance(
                        WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS,
                        WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS
                                | WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        }
    }

    /** Sizes the strips above and below the page to the status bar, the navigation bar and the keyboard. */
    @SuppressWarnings("deprecation")
    private WindowInsets fitSystemBars(View root, WindowInsets insets) {
        int left;
        int top;
        int right;
        int bottom;
        if (Build.VERSION.SDK_INT >= 30) {
            Insets bars = insets.getInsets(WindowInsets.Type.systemBars()
                    | WindowInsets.Type.displayCutout()
                    | WindowInsets.Type.ime());
            left = bars.left;
            top = bars.top;
            right = bars.right;
            bottom = bars.bottom;
        } else {
            // With adjustResize the bottom inset includes the keyboard here too.
            left = insets.getSystemWindowInsetLeft();
            top = insets.getSystemWindowInsetTop();
            right = insets.getSystemWindowInsetRight();
            bottom = insets.getSystemWindowInsetBottom();
        }
        root.setPadding(left, 0, right, 0);
        setHeight(topBar, top);
        setHeight(bottomBar, bottom);
        return Build.VERSION.SDK_INT >= 30 ? WindowInsets.CONSUMED : insets.consumeSystemWindowInsets();
    }

    private static void setHeight(View view, int height) {
        ViewGroup.LayoutParams params = view.getLayoutParams();
        if (params.height != height) {
            params.height = height;
            view.setLayoutParams(params);
        }
    }

    /** Returns null when Android System WebView is missing, disabled or in the middle of an update. */
    private WebView createWebView() {
        WebView view;
        try {
            view = new WebView(this);
            if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
                WebView.setWebContentsDebuggingEnabled(true);
            }
        } catch (RuntimeException e) {
            return null;
        }
        view.setBackgroundColor(getColor(R.color.sb_light));
        view.setOverScrollMode(View.OVER_SCROLL_NEVER);
        view.setHorizontalScrollBarEnabled(false);

        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setGeolocationEnabled(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        // The page is laid out for this text size; a large system font size would break it apart.
        settings.setTextZoom(100);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);

        view.addJavascriptInterface(new SaveBridge(getSharedPreferences(PREFS, MODE_PRIVATE)), "AndroidSave");
        view.setWebChromeClient(new WebChromeClient());
        view.setWebViewClient(new GameClient());
        return view;
    }

    /** After the page's process crashed or Android reclaimed it, a fresh WebView reloads the game from its save. */
    private void reloadInNewWebView() {
        WebView old = webView;
        webHolder.removeView(old);
        old.destroy();
        webView = createWebView();
        if (webView == null) {
            showWebViewMissing();
            return;
        }
        webHolder.addView(webView, MATCH, MATCH);
        webView.loadUrl(START_URL);
    }

    private void showWebViewMissing() {
        TextView message = new TextView(this);
        message.setText(R.string.webview_missing);
        message.setTextColor(getColor(R.color.sb_dark));
        message.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        message.setGravity(Gravity.CENTER);
        int padding = Math.round(24 * getResources().getDisplayMetrics().density);
        message.setPadding(padding, padding, padding, padding);
        webHolder.addView(message, MATCH, MATCH);
    }

    private WebResourceResponse openAsset(String path) {
        String name = path == null || path.length() <= 1 ? "index.html" : path.substring(1);
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-cache");
        if (!name.contains("..")) {
            try {
                InputStream data = getAssets().open(name);
                String mimeType = mimeType(name);
                String encoding = mimeType.startsWith("text/") || mimeType.endsWith("json") || mimeType.endsWith("xml")
                        ? "utf-8" : null;
                return new WebResourceResponse(mimeType, encoding, 200, "OK", headers, data);
            } catch (IOException e) {
                // Falls through to 404.
            }
        }
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers,
                new ByteArrayInputStream(new byte[0]));
    }

    private static String mimeType(String name) {
        String extension = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        switch (extension) {
            case "html": return "text/html";
            case "js": case "mjs": return "text/javascript";
            case "css": return "text/css";
            case "json": case "webmanifest": return "application/json";
            case "svg": return "image/svg+xml";
            case "png": return "image/png";
            case "jpg": case "jpeg": return "image/jpeg";
            case "webp": return "image/webp";
            case "gif": return "image/gif";
            case "woff2": return "font/woff2";
            case "woff": return "font/woff";
            case "ttf": return "font/ttf";
            case "mp3": return "audio/mpeg";
            case "ogg": return "audio/ogg";
            case "wav": return "audio/wav";
            default: return "application/octet-stream";
        }
    }

    private final class GameClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if ("https".equals(url.getScheme()) && HOST.equals(url.getHost())) {
                return openAsset(url.getPath());
            }
            return null;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri url = request.getUrl();
            if ("https".equals(url.getScheme()) && HOST.equals(url.getHost())) {
                return false;
            }
            // Any other address opens outside the app.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, url));
            } catch (ActivityNotFoundException e) {
                // Nothing on the phone can open it.
            }
            return true;
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            if (view == webView) {
                reloadInNewWebView();
            } else {
                view.destroy();
            }
            return true;
        }
    }

    /** Lets the page keep a second copy of its save outside WebView's own storage. */
    static final class SaveBridge {
        private final SharedPreferences prefs;

        SaveBridge(SharedPreferences prefs) {
            this.prefs = prefs;
        }

        @JavascriptInterface
        public String load() {
            return prefs.getString(SAVE_KEY, "");
        }

        @JavascriptInterface
        public void save(String json) {
            if (json != null && json.length() <= MAX_SAVE_LENGTH) {
                prefs.edit().putString(SAVE_KEY, json).apply();
            }
        }
    }
}
