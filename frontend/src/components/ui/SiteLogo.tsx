import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "../../api/settings.api";

type Props = { size?: "sm" | "md" | "lg"; className?: string; onClick?: () => void };

export default function SiteLogo({ size = "md", className = "", onClick }: Props) {
  const { data } = useQuery({ queryKey: ["site-settings"], queryFn: getSettings, staleTime: 1000 * 60 * 5 });
  const settings = data?.data;

  const configWidth = (settings as any)?.logoWidth ?? 120;
  const configHeight = (settings as any)?.logoHeight ?? 40;
  const scale = size === "sm" ? 0.7 : size === "lg" ? 1.4 : 1;
  const width = Math.round(configWidth * scale);
  const height = Math.round(configHeight * scale);

  const textSize = size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-xl sm:text-2xl";
  const iconSize = size === "sm" ? 18 : size === "lg" ? 28 : 22;

  return (
    <Link to="/" onClick={onClick}
      className={`shrink-0 flex items-center gap-2 font-serif font-bold tracking-tighter text-text-primary transition-opacity hover:opacity-80 ${textSize} ${className}`}>
      {settings?.logoUrl ? (
        <img src={settings.logoUrl} alt={settings.storeName ?? "Logo"}
          style={{ width, height, objectFit: "contain" }} />
      ) : (
        <>
          <BookOpen size={iconSize} className="text-accent" />
          <span>{settings?.storeName ?? "Akash"} <span className="text-accent">Book Centre</span></span>
        </>
      )}
    </Link>
  );
}
