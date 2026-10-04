import Dashboard from "@/components/Dashboard";
import { ToastProvider } from "@/components/ui/Toast";

export default function Page() {
  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  );
}
