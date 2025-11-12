import { TopNavBar } from "@/components/TopNavBar";
import { ProfileMessages } from "@/components/ProfileMessages";

export default function ApproachControlMessages() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="pt-20 p-4">
        <ProfileMessages />
      </div>
    </div>
  );
}
