"use client";

import { LoadingState } from "@/components/loading-state";
import { useMounted } from "@/lib/use-mounted";
import { PaymentMethods } from "../settings/payment-methods";

export default function PaymentsPage() {
  const mounted = useMounted();
  if (!mounted) return <LoadingState label="Cargando pagos…" />;
  return <PaymentMethods />;
}
