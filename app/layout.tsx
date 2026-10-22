import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";

import { PwaProvider } from "@/components/pwa/InstallApp";
import { siteDescription, siteUrl } from "@/lib/site";
import AppAblyProvider from "@/providers/AblyProvider";
import QueryProvider from "@/providers/QueryProvider";

export const viewport: Viewport = { themeColor: "#09090b" };

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "QChat — Your Quickest Chat on the Go",
    template: "%s | QChat",
  },
  description: siteDescription,
  keywords: [
    "chat",
    "instant messaging",
    "real-time chat",
    "quick chat",
    "room chat",
    "qchat",
    "private rooms",
  ],
  authors: [{ name: "QChat" }],
  creator: "QChat",
  publisher: "QChat",
  metadataBase: siteUrl,
  applicationName: "QChat",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "QChat", statusBarStyle: "default" },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "QChat",
    title: "QChat — Your Quickest Chat on the Go",
    description: siteDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "QChat — Quick, hassle-free chatting.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "QChat — Your Quickest Chat on the Go",
    description: siteDescription,
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/logo-1.png",
    shortcut: "/logo-1.png",
    apple: "/icons/icon-180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        "font-sans",
        inter.variable,
      )}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark">
          <TooltipProvider>
            <Toaster position="bottom-right" richColors />
            <PwaProvider>
              <QueryProvider>
                <AppAblyProvider>{children}</AppAblyProvider>
              </QueryProvider>
            </PwaProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
