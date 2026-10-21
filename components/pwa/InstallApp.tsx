"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { registerAppWorker } from "@/lib/pwa";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
const InstallContext = createContext({ installed: true, install: () => {} });

export function PwaProvider({ children }: { children: ReactNode }) {
  const [installed, setInstalled] = useState(true);
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [help, setHelp] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => {
    void registerAppWorker()?.catch(() => {});
    const query = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setInstalled(
        query.matches ||
          Boolean(
            (navigator as Navigator & { standalone?: boolean }).standalone,
          ),
      );
    update();
    setIos(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    const capture = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const complete = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", complete);
    query.addEventListener("change", update);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("appinstalled", complete);
      query.removeEventListener("change", update);
    };
  }, []);
  const install = async () => {
    if (!prompt) {
      setHelp(true);
      return;
    }
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      setHelp(true);
    } finally {
      setPrompt(null);
    }
  };
  return (
    <InstallContext.Provider
      value={{ installed, install: () => void install() }}
    >
      {children}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install QChat</DialogTitle>
            <DialogDescription>
              {ios
                ? "Open QChat in Safari, tap Share, then Add to Home Screen. Enable Open as Web App if shown."
                : "Open your browser menu and choose Install QChat, Install app, or Add to Home Screen. If no option appears, try Chrome or Edge; installation support varies by browser."}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Chatting requires an internet connection.
          </p>
        </DialogContent>
      </Dialog>
    </InstallContext.Provider>
  );
}

export function InstallApp() {
  const { installed, install } = useContext(InstallContext);
  if (installed) return null;
  return (
    <Button type="button" variant="outline" onClick={install}>
      <Download /> Install QChat
    </Button>
  );
}
