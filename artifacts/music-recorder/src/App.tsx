import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Record from "@/pages/record";
import SongDetail from "@/pages/song";
import Mixer from "@/pages/mixer";
import Tuner from "@/pages/tuner";
import Chords from "@/pages/chords";
import Tabs from "@/pages/tabs";
import Capo from "@/pages/capo";
import Collab from "@/pages/collab";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      {/* Collab page — no sidebar, accessible by anyone with a share link */}
      <Route path="/collab/:token" component={Collab} />
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/record" component={Record} />
            <Route path="/song/:id" component={SongDetail} />
            <Route path="/mixer" component={Mixer} />
            <Route path="/tuner" component={Tuner} />
            <Route path="/chords" component={Chords} />
            <Route path="/tabs" component={Tabs} />
            <Route path="/capo" component={Capo} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
