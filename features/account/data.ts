export const SECTIONS = [
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/subscription", label: "Subscription" },
  { href: "/dashboard/statistics", label: "Statistics" },
  { href: "/dashboard/settings", label: "Settings" },
];

export const PLANS = [
  {
    name: "Free",
    price: "$0/mo",
    features: ["Unlimited games", "Basic move analysis"],
  },
  {
    name: "Premium",
    price: "$9.99/mo",
    features: ["Everything in Free", "Full AI coaching", "Unlimited analysis"],
  },
  {
    name: "Pro",
    price: "$19.99/mo",
    features: [
      "Everything in Premium",
      "Priority support",
      "Advanced statistics",
    ],
  },
];

export const INVOICES = [
  { id: "inv_003", date: "Nov 30, 2024", amount: "$9.99", status: "Paid" },
  { id: "inv_002", date: "Oct 31, 2024", amount: "$9.99", status: "Paid" },
  { id: "inv_001", date: "Sep 30, 2024", amount: "$9.99", status: "Paid" },
];
