import { redirect } from "next/navigation";

// Sign-up and sign-in are the same action now that Google is the only
// way in - the Prisma adapter creates the User row automatically on a
// new account's first Google sign-in, so there's no separate form left.
export default function RegisterPage() {
  redirect("/login");
}
