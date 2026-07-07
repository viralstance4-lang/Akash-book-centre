import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getSettings } from "../../api/settings.api";

type Props = { size?: "sm" | "md" | "lg"; className?: string; onClick?: () => void };

export default function SiteLogo({ size = "md", className = "", onClick }: Props) {
  const { data } = useQuery({ queryKey: ["site-settings"], queryFn: getSettings, staleTime: 1000 * 60 * 5 });
  const settings = data?.data;

  const configWidth = (settings as any)?.logoWidth ?? 120;
  const configHeight = (settings as any)?.logoHeight ?? 56;
  const scale = size === "sm" ? 0.7 : size === "lg" ? 1.4 : 1;
  const width = Math.round(configWidth * scale);
  const height = Math.round(configHeight * scale);

  const textSize = size === "sm" ? "text-lg" : size === "lg" ? "text-3xl" : "text-xl sm:text-2xl";
  const iconSize = size === "sm" ? 18 : size === "lg" ? 28 : 22;

  return (
    <Link to="/" onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-2 font-serif font-bold tracking-tighter text-text-primary transition-opacity hover:opacity-80 ${textSize} ${className}`}>
      {settings?.logoUrl ? (
        <img src={settings.logoUrl} alt={settings.storeName ?? "Logo"}
          className="w-auto max-h-[60px] sm:max-h-none"
          style={{ height, maxWidth: width, objectFit: "contain" }} />
      ) : (
        <>
          <BookOpen size={iconSize} className="text-accent" />
          {(() => {
            const name = settings?.storeName ?? "Akash Book Centre";
            const spaceIdx = name.indexOf(" ");
            if (spaceIdx === -1) return <span>{name}</span>;
            return (
              <span className="whitespace-nowrap">
                {name.slice(0, spaceIdx)}{" "}
                <span className="text-accent">{name.slice(spaceIdx + 1)}</span>
              </span>
            );
          })()}
        </>
      )}
    </Link>
  );
}
