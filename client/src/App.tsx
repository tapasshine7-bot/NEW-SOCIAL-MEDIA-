import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import NuvoraDashboard from "./pages/NuvoraDashboard";
import { AccountHelp, Login, SignUp } from "./pages/AuthPages";
import Settings from "./pages/Settings";
import Accounts from "./pages/Accounts";

function Router() {
  return <Switch>
    <Route path="/" component={NuvoraDashboard} />
    <Route path="/life" component={NuvoraDashboard} />
    <Route path="/study" component={NuvoraDashboard} />
    <Route path="/shield" component={NuvoraDashboard} />
    <Route path="/signup" component={SignUp} />
    <Route path="/login" component={Login} />
    <Route path="/account-help" component={AccountHelp} />
    <Route path="/settings" component={Settings} />
    <Route path="/accounts" component={Accounts} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="system" switchable><TooltipProvider><Toaster /><Router /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
