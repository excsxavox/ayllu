export const ALERTS_CHANGED = "aylluu:alerts";
export const FEATURES_CHANGED = "aylluu:features";
export const COMPANY_CHANGED = "aylluu:company";

export function notifyAlertsChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(ALERTS_CHANGED));
  }
}

export function notifyFeaturesChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(FEATURES_CHANGED));
  }
}

export function notifyCompanyChanged(companyId: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COMPANY_CHANGED, { detail: companyId }));
  }
}
