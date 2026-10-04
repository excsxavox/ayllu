"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { PREFETCH } from "@/lib/query-cache";
import { prefetchMany } from "@/lib/api";

type Ctx = {
  path: string;
  search: string;
  query: URLSearchParams;
  navigate: (href: string) => void;
};

const PathCtx = createContext<Ctx | null>(null);

function splitUrl(url: string) {
  const [path, search = ""] = url.split("?");
  return { path: path || "/", search: search ? `?${search}` : "" };
}

export function PathProvider({ children }: { children: ReactNode }) {
  const nextPath = usePathname() || "/dashboard";
  const [url, setUrl] = useState(nextPath);

  const navigate = useCallback((href: string) => {
    const next = href.startsWith("http") ? new URL(href).pathname + new URL(href).search : href;
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", next);
    }
    setUrl(next);
  }, []);

  useEffect(() => {
    const sync = () => setUrl(window.location.pathname + window.location.search);
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [nextPath]);

  const value = useMemo(() => {
    const { path, search } = splitUrl(url);
    return {
      path,
      search,
      query: new URLSearchParams(search.startsWith("?") ? search.slice(1) : search),
      navigate,
    };
  }, [url, navigate]);

  return <PathCtx.Provider value={value}>{children}</PathCtx.Provider>;
}

export function useAppPath() {
  const ctx = useContext(PathCtx);
  if (!ctx) throw new Error("useAppPath requiere PathProvider");
  return ctx;
}

export function NavLink({
  href,
  className,
  children,
  onMouseEnter,
  ...rest
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onMouseEnter?: () => void;
} & Omit<import("react").AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "onClick">) {
  const { path, navigate } = useAppPath();
  const dest = href.split("?")[0];
  return (
    <a
      {...rest}
      href={href}
      className={className}
      onMouseEnter={() => {
        prefetchMany(PREFETCH[dest] ?? []);
        onMouseEnter?.();
      }}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}
