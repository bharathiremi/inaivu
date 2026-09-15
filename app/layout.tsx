import type { Metadata } from "next";
import "./globals.css";
import { PreferencesProvider } from "./providers";

export const metadata: Metadata = {
  title: "Inaivu",
  description: "A place to connect, share and discover.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google AdSense
            Replace YOUR_ADSENSE_PUBLISHER_ID after AdSense approval.
            Example format: ca-pub-1234567890123456
        */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-YOUR_ADSENSE_PUBLISHER_ID"
          crossOrigin="anonymous"
        />

        <meta
          name="google-adsense-account"
          content="ca-pub-YOUR_ADSENSE_PUBLISHER_ID"
        />
      </head>

      <body suppressHydrationWarning>
        <PreferencesProvider>
          {children}
        </PreferencesProvider>
      </body>
    </html>
  );
}