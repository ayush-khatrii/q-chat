import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "next-themes";
import { SidebarProvider } from "@/components/sidebar-context";
import SidebarLayout from "@/components/SidebarLayout";
import NotificationInit from "@/components/NotificationInit";
import { TooltipProvider } from "@/components/ui/tooltip";
import AppAblyProvider from "@/providers/AblyProvider";
import { Toaster } from "sonner";

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
  description:
    "Create or join rooms and start chatting instantly. No sign-up hassle, no unnecessary steps — just real-time conversations with anyone, anywhere.",
  keywords: [
    "chat",
    "instant messaging",
    "real-time chat",
    "quick chat",
    "room chat",
    "qchat",
    "private rooms",
    "group chat",
  ],
  authors: [{ name: "QChat" }],
  creator: "QChat",
  publisher: "QChat",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://q-chat-dev.vercel.app",
  ),
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "QChat",
    title: "QChat — Your Quickest Chat on the Go",
    description:
      "Create or join rooms and start chatting instantly. No sign-up hassle, just real-time conversations.",
    images: [
      {
        url: "/logo-1.png",
        width: 512,
        height: 512,
        alt: "QChat Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "QChat — Your Quickest Chat on the Go",
    description:
      "Create or join rooms and start chatting instantly. No sign-up hassle, just real-time conversations.",
    images: ["/logo-1.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/logo-1.png",
    shortcut: "/logo-1.png",
    apple: "/logo-1.png",
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
      <body
        className="min-h-full flex flex-col"
        suppressHydrationWarning
      >
        <ThemeProvider attribute="class" defaultTheme="dark">
          <SidebarProvider>
            <TooltipProvider>
              <AppAblyProvider>
                <NotificationInit />
                <Toaster position="bottom-right" richColors />
                <main className="flex flex-col h-dvh">
                  <SidebarLayout>
                    {children}
                  </SidebarLayout>
                </main>
              </AppAblyProvider>
            </TooltipProvider>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
