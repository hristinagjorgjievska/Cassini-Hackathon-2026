export type RoleDetails = {
  id: string;
  label: string;
  plan: string;
  permissions: string;
};

export const roleDetailsMap: Record<string, RoleDetails> = {
  free: {
    id: "free",
    label: "Free Tier",
    plan: "Free (1 Month Trial)",
    permissions: "Track up to 2 water sources, Basic satellite analysis."
  },
  premium: {
    id: "premium",
    label: "Premium",
    plan: "$19/mo",
    permissions: "Track up to 50 water sources, Advanced satellite metrics, Priority email alerts."
  },
  pro: {
    id: "pro",
    label: "Pro",
    plan: "$49/mo",
    permissions: "Unlimited water sources, API access, Historical data export, White-label reports."
  }
};
