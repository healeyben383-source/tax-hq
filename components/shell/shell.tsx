import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 px-8 py-8 max-w-[1200px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
