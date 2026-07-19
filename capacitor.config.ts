import type { CapacitorConfig } from "@capacitor/cli";

// LYNX ONE has real server-side logic (encrypted broker-credential cookies,
// live Dhan API proxying, the Broker Hub backend) — none of that can run inside
// a statically-exported Capacitor shell. So instead of `next export`, the native
// WebView is pointed at the *live* Next.js server via server.url — the standard
// Capacitor pattern for apps that need SSR/API routes. This preserves the whole
// app, including its security model, completely unmodified.
//
// CAPACITOR_SERVER_URL must point at a real deployed HTTPS URL before shipping.
// The dev fallback below only works for `npx cap run` against a server already
// running on this machine, reachable from the device/emulator on the same network
// (use your machine's LAN IP, not localhost, when testing on a physical device).
const serverUrl = process.env.CAPACITOR_SERVER_URL ?? "http://localhost:3000";

const config: CapacitorConfig = {
  appId: "com.lynxone.terminal",
  appName: "LYNX ONE",
  webDir: "www",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#05070B",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#05070B",
      overlaysWebView: false,
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  },
};

export default config;
