import "@fontsource/instrument-serif/latin-400.css";
import "./styles.css";
import { render } from "preact";
import Dashboard from "@/components/Dashboard";
import { ToastProvider } from "@/components/ui/Toast";

render(
  <ToastProvider>
    <Dashboard />
  </ToastProvider>,
  document.getElementById("app")!,
);
