import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-sidebar px-4 py-10 text-white">
      <div className="w-full max-w-md border border-white/10 bg-panel">
        <div className="border-b border-white/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-indigo-500 text-sm font-black tracking-[0.2em] text-white">
              BM
            </div>
            <div>
              <p className="section-kicker text-indigo-200/80">Create account</p>
              <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-white">Join Bharat Meet</h1>
            </div>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-6">
          <SignUp
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-0 bg-transparent rounded-none",
                formButtonPrimary: "bg-indigo-500 hover:bg-indigo-400 text-white border-0 rounded-md",
                socialButtonsBlockButton: "border border-white/10 bg-white/5 hover:bg-white/10",
                input: "border border-white/10 bg-sidebar text-white placeholder:text-slate-400 rounded-md",
                headerTitle: "text-white",
                headerSubtitle: "text-slate-300",
                formFieldLabel: "text-slate-200",
                footerActionText: "text-slate-300",
                footerActionLink: "text-indigo-300 hover:text-indigo-200",
                dividerLine: "bg-white/10",
                dividerText: "text-slate-400",
              },
              variables: {
                colorPrimary: "#818cf8",
                colorBackground: "transparent",
                colorInputBackground: "rgba(15, 23, 42, 0.7)",
                colorText: "#f8fafc",
                colorTextSecondary: "#cbd5e1",
                borderRadius: "0.35rem",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}