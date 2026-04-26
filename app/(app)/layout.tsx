import { Shell } from "@/components/shell/shell";

// Middleware guards this route group: unauthenticated requests never reach
// here — they're redirected to /sign-in before this layout renders.
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Shell>{children}</Shell>;
}
