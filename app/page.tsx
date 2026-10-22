import type { Metadata } from "next";
import {
  ArrowDownRight,
  ArrowRight,
  BellRing,
  Check,
  Command,
  Download,
  Headphones,
  MessageCircle,
  Mic2,
  Radio,
  ShieldCheck,
  Sparkles,
  Video,
  Wifi,
  PlayCircle,
  Waves,
  Zap,
} from "lucide-react";

import { PwaInstallButton } from "@/components/pwa-install-button";

export const metadata: Metadata = {
  title: "Bharat Meet — Make room for good work",
  description:
    "A calmer home for team conversations, voice notes, and live rooms. Meet your team on the web or install Bharat Meet on mobile.",
};

const features = [
  {
    icon: MessageCircle,
    eyebrow: "Keep the thread",
    title: "Conversations with context",
    body: "Focused text rooms keep decisions, files, and reactions together, so the useful stuff is easy to find again.",
    tone: "gold",
  },
  {
    icon: Video,
    eyebrow: "Gather in a room",
    title: "Meet without the meeting maze",
    body: "Jump into voice or video with simple controls, clear presence, and room for everyone to be seen.",
    tone: "mint",
  },
  {
    icon: Waves,
    eyebrow: "When timing is different",
    title: "Voice notes that move work forward",
    body: "Share the tone and nuance of a quick voice note when a call can wait and a wall of text won’t help.",
    tone: "lilac",
  },
];

export default function LandingPage() {
  return (
    <main className="landing-shell min-h-screen overflow-hidden bg-[#0b100f] text-[#f6f4eb]">
      <div className="landing-grain pointer-events-none fixed inset-0 z-0" aria-hidden="true" />
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <a href="/" className="flex items-center gap-3 rounded-xl" aria-label="Bharat Meet home">
          <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#f2bd55] text-[11px] font-black tracking-[0.12em] text-[#17201b] shadow-[0_8px_28px_rgba(242,189,85,.18)]">BM</span>
          <span>
            <span className="block text-[15px] font-bold tracking-[-0.04em]">Bharat Meet</span>
            <span className="block text-[10px] tracking-[0.04em] text-white/45">A room for good work</span>
          </span>
        </a>

        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Main navigation">
          <a href="/sign-in?redirect_url=%2Fsetup" className="rounded-full px-3 py-2 text-sm font-medium text-white/70 transition hover:text-white sm:px-4">Log in</a>
          <a href="/sign-up?redirect_url=%2Fsetup" className="rounded-full border border-white/15 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-[#f2bd55]/50 hover:bg-white/[0.11] sm:px-5">
            Create account <span className="hidden sm:inline">↗</span>
          </a>
        </nav>
      </header>

      <section className="relative z-[1] mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1fr_0.94fr] lg:gap-10 lg:px-12 lg:pb-28 lg:pt-20">
        <div className="relative max-w-2xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#f2bd55]/20 bg-[#f2bd55]/[0.07] px-3.5 py-2 text-[11px] font-semibold tracking-[0.12em] text-[#f6d58e]">
            <Sparkles className="h-3.5 w-3.5" />
            MADE FOR TEAMS THAT MAKE THINGS
          </div>
          <h1 className="max-w-[760px] text-[clamp(3.25rem,7.4vw,6.8rem)] font-semibold leading-[0.97] tracking-[-0.075em]">
            Good work needs <span className="landing-title-accent">good company.</span>
          </h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-white/60 sm:text-lg sm:leading-8">
            A thoughtful space for your team to talk, meet, and keep moving. One calm workspace on the web, ready to come with you on mobile.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a href="/setup" className="group inline-flex min-h-[3.25rem] items-center justify-center gap-3 rounded-full bg-[#f2bd55] px-6 py-3.5 text-sm font-bold text-[#18201a] shadow-[0_12px_32px_rgba(242,189,85,.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#ffd477]">
              Continue in browser <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
            <PwaInstallButton variant="cta" />
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/40">
            <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#7bd6b2]" /> Works in your browser</span>
            <span className="inline-flex items-center gap-1.5"><Download className="h-3.5 w-3.5 text-[#7bd6b2]" /> Installable on mobile</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#7bd6b2]" /> Your team, your space</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[590px] lg:ml-auto">
          <div className="landing-orbit landing-orbit-one" aria-hidden="true" />
          <div className="landing-orbit landing-orbit-two" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[28px] border border-white/[0.11] bg-[#121917]/90 p-3 shadow-[0_40px_120px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-2 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#f2bd55] text-[8px] font-black text-[#17201b]">BM</div>
                <div><p className="text-[11px] font-semibold">Bharat Meet</p><p className="text-[9px] text-white/35">Studio North</p></div>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-[#75d8b1]/20 bg-[#75d8b1]/[0.08] px-2.5 py-1 text-[9px] text-[#93e3c3]"><span className="h-1.5 w-1.5 rounded-full bg-[#75d8b1]" /> 4 here</div>
            </div>
            <div className="grid min-h-[340px] grid-cols-[52px_1fr] sm:min-h-[380px] sm:grid-cols-[62px_1fr]">
              <div className="flex flex-col items-center gap-3 border-r border-white/[0.07] py-4">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f2bd55] text-[9px] font-black text-[#17201b]">SN</span>
                <span className="h-px w-5 bg-white/10" />
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/65"><MessageCircle className="h-4 w-4" /></span>
                <span className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-[#f2bd55]/30 bg-[#f2bd55]/[0.10] text-[#f2bd55]"><Video className="h-4 w-4" /><i className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-[#121917] bg-[#75d8b1]" /></span>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/55"><Mic2 className="h-4 w-4" /></span>
                <span className="mt-auto flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[#e9a974] to-[#7c574a] text-[9px] font-bold">A</span>
              </div>

              <div className="min-w-0 p-3 sm:p-5">
                <div className="flex items-center justify-between gap-2">
                  <div><p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#f2bd55]/75">TUESDAY · TEAM ROOM</p><h2 className="mt-1 text-sm font-semibold tracking-tight sm:text-base">Design stand-up</h2></div>
                  <span className="flex items-center gap-1.5 rounded-full bg-[#75d8b1]/[0.1] px-2.5 py-1.5 text-[9px] font-medium text-[#9ce5c7]"><Radio className="h-3 w-3" /> Live</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3">
                  <div className="landing-person landing-person-a"><span className="landing-avatar">A</span><span className="landing-speaking"><Waves className="h-3 w-3" /></span><span className="landing-person-name">Aarav <i /></span></div>
                  <div className="landing-person landing-person-b"><span className="landing-avatar">M</span><span className="landing-person-name">Meera <i /></span></div>
                  <div className="landing-person landing-person-c"><span className="landing-avatar">K</span><span className="landing-person-name">Kabir <i /></span></div>
                  <div className="landing-notes-card"><div className="flex items-center gap-2 text-[#f2bd55]"><Command className="h-3.5 w-3.5" /><span className="text-[9px] font-semibold uppercase tracking-[0.12em]">Room notes</span></div><p className="mt-3 text-[11px] leading-[1.65] text-white/72">Ship the new flow<br />Review with the team<br /><span className="text-[#75d8b1]">Next: prototype by Friday</span></p><span className="mt-3 inline-flex items-center gap-1 text-[9px] text-white/35"><Check className="h-3 w-3 text-[#75d8b1]" /> Shared with everyone</span></div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-white/[0.08] bg-[#0d1311] px-3 py-2.5 sm:px-4">
                  <div className="flex min-w-0 items-center gap-2.5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#263d37] text-[#9ce5c7]"><MessageCircle className="h-3.5 w-3.5" /></span><span className="truncate text-[10px] text-white/50">Prototype is ready for a look…</span></div>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f2bd55] text-[#17201b]"><ArrowDownRight className="h-3.5 w-3.5" /></span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 border-t border-white/[0.08] pt-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-white/75"><Headphones className="h-3.5 w-3.5" /></span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-white/75"><Mic2 className="h-3.5 w-3.5" /></span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.07] text-white/75"><PlayCircle className="h-3.5 w-3.5" /></span>
              <span className="flex h-8 items-center gap-1.5 rounded-full bg-[#f2bd55] px-3 text-[10px] font-bold text-[#17201b]"><Video className="h-3.5 w-3.5" /> Leave room</span>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-2xl border border-white/10 bg-[#17201d]/95 px-3.5 py-3 shadow-xl sm:flex"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#75d8b1]/10 text-[#87dfba]"><BellRing className="h-4 w-4" /></span><span><span className="block text-[10px] font-semibold">A gentle nudge</span><span className="block text-[9px] text-white/40">Your reminder is ready</span></span></div>
          <div className="absolute -right-3 top-16 hidden h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[#17201d]/95 text-[#f2bd55] shadow-xl sm:flex"><Wifi className="h-4 w-4" /></div>
        </div>
      </section>

      <section className="relative z-[1] border-y border-white/[0.08] bg-white/[0.018]">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:grid-cols-3 sm:gap-5 sm:px-8 lg:px-12">
          {features.map(({ icon: Icon, eyebrow, title, body, tone }) => (
            <article key={title} className="landing-feature group rounded-[22px] border border-white/[0.08] bg-[#111715]/70 p-5 transition duration-300 hover:-translate-y-1 hover:border-white/[0.15] sm:p-6">
              <div className={`landing-feature-icon landing-feature-${tone}`}><Icon className="h-5 w-5" /></div>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">{eyebrow}</p>
              <h3 className="mt-2 text-lg font-semibold tracking-[-0.035em]">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/50">{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-[1] mx-auto flex max-w-7xl flex-col gap-8 px-5 py-16 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12 lg:py-20">
        <div className="max-w-2xl"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#f2bd55]">Take your team with you</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.06em] sm:text-4xl">One tap away, even on mobile.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-white/50">Install Bharat Meet from your browser. Get a home-screen app with room for conversations, live meetups, voice notes, and reminders.</p></div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <PwaInstallButton variant="cta" />
          <a href="/setup" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/[0.06]">Use the web app <ArrowRight className="h-4 w-4" /></a>
        </div>
      </section>

      <footer className="relative z-[1] border-t border-white/[0.08] px-5 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-7xl text-xs text-white/35"><span>© {new Date().getFullYear()} Bharat Meet. Made for teams, everywhere.</span></div>
      </footer>
    </main>
  );
}
