import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type ProfilePhotoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

interface ProfilePhotoProps {
  src?: string | null;
  alt?: string;
  fallback?: string;
  size?: ProfilePhotoSize;
  className?: string;
  onClick?: () => void;
}

const sizeClasses: Record<ProfilePhotoSize, string> = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-12 w-12",
  xl: "h-16 w-16",
  "2xl": "h-32 w-32",
};

const fallbackTextSize: Record<ProfilePhotoSize, string> = {
  xs: "text-xs",
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-xl",
  "2xl": "text-3xl",
};

/**
 * Standardized profile photo component with consistent styling across the app.
 * Uses consistent circle shape, center-cropped images, and 1:1 aspect ratio.
 * Only the size varies by context.
 */
export const ProfilePhoto = React.forwardRef<HTMLSpanElement, ProfilePhotoProps>(
  ({ src, alt = "Profile", fallback, size = "md", className, onClick }, ref) => {
    // Generate fallback initials from alt text or fallback prop
    const initials = React.useMemo(() => {
      if (fallback) return fallback.charAt(0).toUpperCase();
      if (alt && alt !== "Profile") return alt.charAt(0).toUpperCase();
      return "?";
    }, [alt, fallback]);

    return (
      <Avatar
        ref={ref}
        className={cn(
          sizeClasses[size],
          "shrink-0",
          onClick && "cursor-pointer hover:opacity-80 transition-opacity",
          className
        )}
        onClick={onClick}
      >
        {src && (
          <AvatarImage
            src={src}
            alt={alt}
            className="object-cover object-center aspect-square"
          />
        )}
        <AvatarFallback
          className={cn(
            "bg-primary text-primary-foreground",
            fallbackTextSize[size]
          )}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
    );
  }
);

ProfilePhoto.displayName = "ProfilePhoto";
