import { Chrome } from "@/components/shell/Chrome";
import { Cursor } from "@/components/shell/Cursor";
import { TransitionProvider } from "@/components/shell/Transition";
import { EditMode } from "@/components/editor/EditMode";
import { Analytics } from "@/components/shell/Analytics";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <TransitionProvider>
      <a href="#top" className="visually-hidden">
        Skip to content
      </a>
      <Chrome />
      {children}
      <EditMode />
      <Analytics />
      <Cursor />
    </TransitionProvider>
  );
}
