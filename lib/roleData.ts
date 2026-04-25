export type RoleDetails = {
  id: string;
  label: string;
  plan: string;
  permissions: string;
};

export const roleDetailsMap: Record<string, RoleDetails> = {
  farmer: {
    id: "farmer",
    label: "Farmer",
    plan: "Free (or $5/mo Premium)",
    permissions: "Report water disturbances, view local water source status, receive alerts for nearby areas."
  },
  institution: {
    id: "institution",
    label: "Agriculture Institution",
    plan: "$50/mo (Enterprise Plan)",
    permissions: "Full access to regional data, bulk download reports, API access, and analytics dashboard."
  },
  supermarket: {
    id: "supermarket",
    label: "Supermarket / Export",
    plan: "$20/mo (Business Plan)",
    permissions: "View water safety certifications, track supply chain water quality, advanced forecasting."
  }
};
