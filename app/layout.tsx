import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import NativeInit from "@/components/native/NativeInit";
import DeveloperPanel from "@/components/dev/DeveloperPanel";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "LYNX ONE — Index Expected Range Calculator",
  description:
    "Calculate the expected trading range for NIFTY, BANKNIFTY, FINNIFTY, SENSEX, and stock options.",
};

// viewportFit: "cover" lets content draw under notches/home-indicators so
// env(safe-area-inset-*) resolves to real values instead of 0 on iOS.
export const viewport: Viewport = {
  themeColor: "#05070B",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col overflow-x-hidden font-sans">
        <NativeInit />
        {children}
        <DeveloperPanel />
      </body>
    </html>
  );
}
