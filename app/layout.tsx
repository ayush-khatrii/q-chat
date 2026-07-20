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
  title: "QChat - Your quickest chat on the go",
  description:
    "QChat lets anyone create or join rooms and start conversations in seconds. No unnecessary steps. Just instant real-time chatting",
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
