import { FaChartPie, FaCreditCard, FaGear, FaUser } from "react-icons/fa6";

export const SECTIONS = [
  { href: "/dashboard/profile", label: "Profile", icon: FaUser },
  { href: "/dashboard/subscription", label: "Subscription", icon: FaCreditCard },
  { href: "/dashboard/statistics", label: "Statistics", icon: FaChartPie },
  { href: "/dashboard/settings", label: "Settings", icon: FaGear },
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
