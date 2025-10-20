import { ProfileMessages } from "@/components/ProfileMessages";

const Messages = () => {
  return (
    <div className="pb-20 min-h-screen bg-background">
      <div className="p-4">
        <h1 className="text-xl font-bold text-foreground mb-6">Messages</h1>
        <ProfileMessages />
      </div>
    </div>
  );
};

export default Messages;