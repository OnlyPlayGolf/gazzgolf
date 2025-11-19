import { TopNavBar } from "@/components/TopNavBar";
import { ProfileMessages } from "@/components/ProfileMessages";

export default function DriverControlMessages() {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <TopNavBar />
      <div className="p-4 pt-20">
        <ProfileMessages />
      </div>
    </div>
  );
}
