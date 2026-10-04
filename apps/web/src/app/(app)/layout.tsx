"use client";

import { PathProvider } from "@/lib/app-path";
import { Shell } from "@/components/shell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  void children;
  return (
    <PathProvider>
      <Shell />
    </PathProvider>
  );
}
