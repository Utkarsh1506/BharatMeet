"use client";

import { ArrowRight, Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

export const PwaInstallButton = ({ variant = "icon" }: { variant?: "icon" | "cta" }) => {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosSafari, setIosSafari] = useState(false);
  const [androidChrome, setAndroidChrome] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setIosSafari(/iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent));
    setAndroidChrome(/Android/i.test(navigator.userAgent) && /Chrome/i.test(navigator.userAgent));
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    if (variant === "icon") return null;

    return (
      <a
        href="/setup"
        className="group inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full border border-[#75d8b1]/25 bg-[#75d8b1]/[0.08] px-5 py-3 text-sm font-semibold text-[#a4e8cc] transition hover:-translate-y-0.5 hover:bg-[#75d8b1]/[0.13] sm:w-auto"
      >
        Open Bharat Meet <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </a>
    );
  }

  if (variant === "icon" && !prompt && !iosSafari) return null;

  const handleInstall = async () => {
    if (!prompt) {
      setShowInstructions(true);
      return;
    }

    try {
      // The browser requires this native install prompt to be called from a user gesture.
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
    } catch {
      setShowInstructions(true);
    } finally {
      setPrompt(null);
    }
  };

  return (
    <>
      <Button
        variant={variant === "cta" ? "default" : "outline"}
        size={variant === "cta" ? "default" : "icon"}
        aria-label="Install Bharat Meet"
        title="Install Bharat Meet"
        className={variant === "cta"
          ? "group inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-full border border-white/15 bg-white/[0.07] px-5 py-3 text-sm font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:border-[#f2bd55]/45 hover:bg-white/[0.11] sm:w-auto"
          : "h-11 w-11 shrink-0 rounded-xl border-border bg-surface text-muted-foreground hover:border-primary/30 hover:text-foreground sm:h-10 sm:w-10"}
        onClick={handleInstall}
      >
        {variant === "cta" ? <><Smartphone className="h-4 w-4 text-[#f2bd55]" /> Get the mobile app <Download className="h-4 w-4 text-[#f2bd55]" /></> : <Download className="h-4 w-4" />}
      </Button>
      <Dialog open={showInstructions} onOpenChange={setShowInstructions}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl">
          <DialogHeader className="text-left">
            <DialogTitle>Install Bharat Meet</DialogTitle>
            <DialogDescription>Keep your team one tap away on your phone or desktop.</DialogDescription>
          </DialogHeader>
          {iosSafari ? (
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li>Tap the Share button in Safari.</li>
              <li>Choose <span className="font-semibold text-foreground">Add to Home Screen</span>.</li>
              <li>Tap <span className="font-semibold text-foreground">Add</span> to install.</li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li>Open your browser menu or the install icon in the address bar.</li>
              <li>Choose <span className="font-semibold text-foreground">{androidChrome ? "Install app" : "Install Bharat Meet"}</span> or <span className="font-semibold text-foreground">Add to Home Screen</span>.</li>
              <li>Confirm to add Bharat Meet to your device.</li>
            </ol>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
