import { FaFacebook, FaGoogle, FaTiktok, FaTwitch } from "react-icons/fa6";
import { SiLichess } from "react-icons/si";

export const SOCIAL_PROVIDERS = [
  {
    name: "Lichess",
    Icon: SiLichess,
    className:
      "bg-white hover:bg-neutral-100 text-neutral-900 border border-neutral-300",
  },
  {
    name: "Google",
    Icon: FaGoogle,
    className: "bg-[#4285F4] hover:bg-[#3367D6] text-white",
    // The only provider actually wired to next-auth's signIn() - the
    // rest render inert (see SocialAuthButtons) until they're wired too.
    providerId: "google",
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
