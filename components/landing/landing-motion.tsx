"use client";

import { useEffect } from "react";

export function LandingMotion() {
  useEffect(() => {
    const shell = document.querySelector<HTMLElement>(".landing-shell");
    if (!shell) return;

    const revealItems = shell.querySelectorAll<HTMLElement>("[data-reveal]");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reducedMotion) {
      revealItems.forEach((item) => item.dataset.revealed = "true");
      return;
    }

    shell.classList.add("landing-motion-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          (entry.target as HTMLElement).dataset.revealed = "true";
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    );
    revealItems.forEach((item) => observer.observe(item));

    let frame = 0;
    const updateProgress = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
        shell.style.setProperty("--landing-scroll-progress", `${Math.min(1, Math.max(0, progress)) * 100}%`);
      });
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
      shell.classList.remove("landing-motion-ready");
    };
  }, []);

  return <div className="landing-scroll-progress" aria-hidden="true" />;
}
