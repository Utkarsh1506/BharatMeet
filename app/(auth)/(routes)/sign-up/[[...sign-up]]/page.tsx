import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="surface-card w-full max-w-md overflow-hidden">
        <div className="border-b border-border/70 bg-gradient-to-br from-primary/15 via-transparent to-emerald-500/10 px-6 py-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-sm font-black tracking-[0.12em] text-primary-foreground shadow-md shadow-primary/15">
              BM
            </div>
            <div>
              <p className="section-kicker text-primary">Create account</p>
              <h1 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-foreground">Join Bharat Meet</h1>
            </div>
          </div>
        </div>

        <div className="px-4 py-5 sm:px-6">
          <SignUp
            fallbackRedirectUrl="/auth/verified"
            signInFallbackRedirectUrl="/setup"
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-0 bg-transparent rounded-none",
                formButtonPrimary: "bg-primary hover:opacity-90 text-primary-foreground border-0 rounded-xl shadow-md shadow-primary/15",
                socialButtonsBlockButton: "border border-border bg-surface hover:bg-surface-hover rounded-xl",
                input: "border border-border bg-input text-foreground placeholder:text-muted-foreground rounded-xl",
                headerTitle: "text-foreground",
                headerSubtitle: "text-muted-foreground",
                formFieldLabel: "text-foreground/80",
                footerActionText: "text-muted-foreground",
                footerActionLink: "text-link hover:opacity-80",
                dividerLine: "bg-border",
                dividerText: "text-muted-foreground",
              },
              variables: {
                colorPrimary: "#e8b54f",
                colorBackground: "transparent",
                colorInputBackground: "#17252b",
                colorText: "#f4f0e7",
                colorTextSecondary: "#aab7b6",
                borderRadius: "0.75rem",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
