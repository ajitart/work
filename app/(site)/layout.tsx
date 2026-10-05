import { Chrome } from "@/components/shell/Chrome";
import { Cursor } from "@/components/shell/Cursor";
import { TransitionProvider } from "@/components/shell/Transition";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <TransitionProvider>
      <a href="#top" className="visually-hidden">
        Skip to content
      </a>
      <Chrome />
      {children}
      <Cursor />
    </TransitionProvider>
  );
}
