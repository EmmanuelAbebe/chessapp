import { FaFacebook, FaGoogle, FaTiktok, FaTwitch } from "react-icons/fa6";
import { SiLichess } from "react-icons/si";

export const SOCIAL_PROVIDERS = [
  {
    name: "Google",
    Icon: FaGoogle,
    className: "bg-[#4285F4] hover:bg-[#3367D6] text-white",
    // Providers with a `providerId` are actually wired to next-auth's
    // signIn(); the rest stay here (no providerId) for a future pass and
    // aren't rendered - see SocialAuthButtons.
    providerId: "google",
  },
  {
    name: "Lichess",
    Icon: SiLichess,
    className:
      "bg-neutral-900 hover:bg-neutral-800 text-white border border-neutral-700",
    providerId: "lichess",
  },
  {
    name: "Facebook",
    Icon: FaFacebook,
    className: "bg-[#1877F2] hover:bg-[#145DBF] text-white",
  },
  {
    name: "TikTok",
    Icon: FaTiktok,
    className: "bg-black hover:bg-neutral-900 text-white",
  },
  {
    name: "Twitch",
    Icon: FaTwitch,
    className: "bg-[#9146FF] hover:bg-[#772CE8] text-white",
  },
];
