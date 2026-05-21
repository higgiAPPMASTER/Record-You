import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Record from "@/pages/record";
import SongDetail from "@/pages/song";
import Mixer from "@/pages/mixer";
import Tuner from "@/pages/tuner";
import Metronome from "@/pages/metronome";
import Chords from "@/pages/chords";
import Tabs from "@/pages/tabs";
import Capo from "@/pages/capo";
import Collab from "@/pages/collab";
import Sessions from "@/pages/sessions";
import Community from "@/pages/community";
import Listen from "@/pages/listen";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#FDB827",
    colorForeground: "#f8f8f8",
    colorMutedForeground: "#888888",
    colorDanger: "#ef4444",
    colorBackground: "#111111",
    colorInput: "#1a1a1a",
    colorInputForeground: "#f8f8f8",
    colorNeutral: "#333333",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0.5rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#111111] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-2xl border border-[#222222]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#f8f8f8]",
    headerSubtitle: "text-[#888888]",
    socialButtonsBlockButtonText: "text-[#f8f8f8]",
    formFieldLabel: "text-[#888888]",
    footerActionLink: "text-[#FDB827]",
    footerActionText: "text-[#888888]",
    dividerText: "text-[#888888]",
    identityPreviewEditButton: "text-[#FDB827]",
    formFieldSuccessText: "text-green-400",
    alertText: "text-[#f8f8f8]",
    logoBox: "mx-auto",
    logoImage: "h-10 w-10",
    socialButtonsBlockButton: "border-[#333333] bg-[#1a1a1a]",
    formButtonPrimary: "bg-[#FDB827] text-black",
    formFieldInput: "bg-[#1a1a1a] border-[#333333] text-[#f8f8f8]",
    footerAction: "bg-[#0d0d0d]",
    dividerLine: "bg-[#333333]",
    alert: "bg-[#1a1a1a] border-[#333333]",
    otpCodeFieldInput: "bg-[#1a1a1a] border-[#333333] text-[#f8f8f8]",
    formFieldRow: "",
    main: "",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function LandingPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 text-center gap-6">
      <img src={`${basePath}/logo.svg`} alt="Record You" className="w-20 h-20" />
      <div>
        <h1 className="text-4xl font-bold text-foreground">Record You</h1>
        <p className="text-muted-foreground mt-2">Your personal music studio</p>
      </div>
      <div className="flex gap-3">
        <a
          href={`${basePath}/sign-in`}
          className="px-6 py-2.5 rounded-lg bg-primary text-black font-semibold hover:bg-primary/90 transition-colors"
        >
          Sign In
        </a>
        <a
          href={`${basePath}/sign-up`}
          className="px-6 py-2.5 rounded-lg border border-border text-foreground font-semibold hover:bg-muted transition-colors"
        >
          Create Account
        </a>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/collab/:token" component={Collab} />
      <Route path="/listen/:token" component={Listen} />
      <Route path="/sign-in/*?" component={() => (
        <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
          <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
        </div>
      )} />
      <Route path="/sign-up/*?" component={() => (
        <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
          <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
        </div>
      )} />
      <Route path="/" component={() => (
        <>
          <Show when="signed-in"><Redirect to="/library" /></Show>
          <Show when="signed-out"><LandingPage /></Show>
        </>
      )} />
      <Route>
        <Show when="signed-out"><Redirect to="/" /></Show>
        <Show when="signed-in">
          <AppLayout>
            <Switch>
              <Route path="/library" component={Home} />
              <Route path="/record" component={Record} />
              <Route path="/song/:id" component={SongDetail} />
              <Route path="/mixer" component={Mixer} />
              <Route path="/tuner" component={Tuner} />
              <Route path="/metronome" component={Metronome} />
              <Route path="/chords" component={Chords} />
              <Route path="/tabs" component={Tabs} />
              <Route path="/capo" component={Capo} />
              <Route path="/sessions" component={Sessions} />
              <Route path="/community" component={Community} />
              <Route component={NotFound} />
            </Switch>
          </AppLayout>
        </Show>
      </Route>
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Record You account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start recording your music today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Router />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
