"use client";

import type { ReactNode } from "react";
import { PAGE_COPY } from "@/lib/nav";
import { useAppPath } from "@/lib/app-path";

export function PageHeader({ actions }: { actions?: ReactNode }) {
  const { path } = useAppPath();
  const copy = PAGE_COPY[path] ?? { title: "", lead: "" };
  if (!copy.title) return null;
  return (
    <div className="page-head">
      <div>
        <h1>{copy.title}</h1>
        <p>{copy.lead}</p>
      </div>
      {actions ? <div className="head-actions">{actions}</div> : null}
    </div>
  );
}
