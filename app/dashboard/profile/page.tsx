import ProfileSection from "@/features/account/components/ProfileSection";

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-text">Profile</h1>
      <ProfileSection />
    </div>
  );
}
