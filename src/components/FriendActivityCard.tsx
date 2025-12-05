import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { Target, CheckCircle, Star, Flag, Trophy, Clock } from "lucide-react";

export interface FriendActivity {
  friendId: string;
  friendName: string;
  friendUsername?: string;
  avatarUrl?: string;
  activityType: 'drill_started' | 'drill_completed' | 'level_started' | 'level_completed' | 'round_started' | 'round_completed' | 'inactive';
  activityDetail?: string;
  timestamp: Date;
  linkTo?: string;
}

interface FriendActivityCardProps {
  activity: FriendActivity;
}

const getActivityConfig = (activity: FriendActivity) => {
  switch (activity.activityType) {
    case 'drill_started':
      return {
        icon: Target,
        iconColor: 'text-blue-500',
        bgColor: 'bg-blue-500/10',
        message: `Doing a drill: ${activity.activityDetail || 'Unknown'}`,
      };
    case 'drill_completed':
      return {
        icon: CheckCircle,
        iconColor: 'text-green-500',
        bgColor: 'bg-green-500/10',
        message: `Completed: ${activity.activityDetail || 'a drill'}`,
      };
    case 'level_started':
      return {
        icon: Star,
        iconColor: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        message: `Working on Level ${activity.activityDetail || ''}`,
      };
    case 'level_completed':
      return {
        icon: Star,
        iconColor: 'text-yellow-500',
        bgColor: 'bg-yellow-500/10',
        message: `Finished Level ${activity.activityDetail || ''}`,
      };
    case 'round_started':
      return {
        icon: Flag,
        iconColor: 'text-emerald-500',
        bgColor: 'bg-emerald-500/10',
        message: `On the course at ${activity.activityDetail || 'Unknown'}`,
      };
    case 'round_completed':
      return {
        icon: Trophy,
        iconColor: 'text-amber-500',
        bgColor: 'bg-amber-500/10',
        message: `Finished a round: ${activity.activityDetail || ''}`,
      };
    case 'inactive':
    default:
      return {
        icon: Clock,
        iconColor: 'text-muted-foreground',
        bgColor: 'bg-muted',
        message: activity.activityDetail || 'Last active: a while ago',
      };
  }
};

const getTimeAgo = (date: Date): string => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
};

export const FriendActivityCard = ({ activity }: FriendActivityCardProps) => {
  const navigate = useNavigate();
  const config = getActivityConfig(activity);
  const Icon = config.icon;

  const handleClick = () => {
    if (activity.linkTo) {
      navigate(activity.linkTo);
    } else {
      navigate(`/user/${activity.friendId}`);
    }
  };

  return (
    <Card 
      className="min-w-[160px] max-w-[180px] cursor-pointer hover:shadow-md transition-shadow border-border/50"
      onClick={handleClick}
    >
      <CardContent className="p-3">
        <div className="flex flex-col items-center text-center gap-2">
          <Avatar className="h-12 w-12 border-2 border-background shadow-sm">
            {activity.avatarUrl ? (
              <AvatarImage src={activity.avatarUrl} alt={activity.friendName} />
            ) : (
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {activity.friendName.charAt(0).toUpperCase()}
              </AvatarFallback>
            )}
          </Avatar>
          
          <p className="font-medium text-sm text-foreground truncate w-full">
            {activity.friendName}
          </p>
          
          <div className={`p-1.5 rounded-full ${config.bgColor}`}>
            <Icon className={`h-4 w-4 ${config.iconColor}`} />
          </div>
          
          <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
            {config.message}
          </p>
          
          <p className="text-[10px] text-muted-foreground/70">
            {getTimeAgo(activity.timestamp)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
