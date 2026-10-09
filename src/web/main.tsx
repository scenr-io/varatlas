import "@fontsource/instrument-serif/latin-400.css";
import "./styles.css";
import { render } from "preact";
import { Dashboard } from "@/components/Dashboard";
import { ToastProvider } from "@/components/ui/Toast";

const root = document.getElementById("app");
if (!root) throw new Error("varatlas: missing #app element in index.html");

render(
  <ToastProvider>
    <Dashboard />
  </ToastProvider>,
  root,
);
