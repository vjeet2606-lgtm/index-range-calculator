"use client";

import { useEffect } from "react";
import { App } from "@capacitor/app";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { isNativePlatform } from "@/lib/native/capacitor";
import { useWizardStep } from "@/hooks/useWizardStep";

/** Runs once at the root layout — native-only setup (status bar, splash, hardware back). No-op on web. */
export default function NativeInit() {
  const { canGoBack, goBack } = useWizardStep();

  useEffect(() => {
    if (!isNativePlatform()) return;

    async function setupNativeChrome() {
      try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: "#05070B" });
        await StatusBar.setOverlaysWebView({ overlay: false });
      } catch {
        // Some devices/platforms don't support every call above — non-fatal.
      }
      await SplashScreen.hide().catch(() => {});
    }

    void setupNativeChrome();
  }, []);

  useEffect(() => {
    if (!isNativePlatform()) return;

    const listenerPromise = App.addListener("backButton", () => {
      if (canGoBack) {
        goBack();
      } else {
        void App.exitApp();
      }
    });

    return () => {
      void listenerPromise.then((listener) => listener.remove());
    };
  }, [canGoBack, goBack]);

  return null;
}
