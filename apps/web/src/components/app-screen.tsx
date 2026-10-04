"use client";

import { useEffect, useState, type ComponentType } from "react";
import { useAppPath } from "@/lib/app-path";
import DashboardPage from "@/app/(app)/dashboard/page";
import InboxPage from "@/app/(app)/inbox/page";
import AlertsPage from "@/app/(app)/alerts/page";
import ProductsPage from "@/app/(app)/products/page";
import ServicesPage from "@/app/(app)/services/page";
import PromotionsPage from "@/app/(app)/promotions/page";
import TagsPage from "@/app/(app)/tags/page";
import ContactsPage from "@/app/(app)/contacts/page";
import KnowledgePage from "@/app/(app)/knowledge/page";
import RulesPage from "@/app/(app)/rules/page";
import RepliesPage from "@/app/(app)/replies/page";
import SettingsPage from "@/app/(app)/settings/page";
import AuditPage from "@/app/(app)/audit/page";
import BookingsPage from "@/app/(app)/bookings/page";
import AdminPage from "@/app/(app)/admin/page";
import ChannelsPage from "@/app/(app)/channels/page";
import FlowsPage from "@/app/(app)/flows/page";
import FloorPage from "@/app/(app)/floor/page";
import PaymentsPage from "@/app/(app)/payments/page";

const VIEWS: Record<string, ComponentType> = {
  "/dashboard": DashboardPage,
  "/inbox": InboxPage,
  "/alerts": AlertsPage,
  "/products": ProductsPage,
  "/services": ServicesPage,
  "/promotions": PromotionsPage,
  "/tags": TagsPage,
  "/contacts": ContactsPage,
  "/knowledge": KnowledgePage,
  "/rules": RulesPage,
  "/replies": RepliesPage,
  "/settings": SettingsPage,
  "/audit": AuditPage,
  "/bookings": BookingsPage,
  "/admin": AdminPage,
  "/channels": ChannelsPage,
  "/flows": FlowsPage,
  "/floor": FloorPage,
  "/payments": PaymentsPage,
};

export function AppScreen() {
  const { path } = useAppPath();
  const [seen, setSeen] = useState(() => new Set([path]));

  useEffect(() => {
    setSeen((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, [path]);

  return (
    <>
      {[...seen].map((href) => {
        const Page = VIEWS[href] ?? DashboardPage;
        return (
          <div key={href} hidden={href !== path}>
            <Page />
          </div>
        );
      })}
    </>
  );
}
