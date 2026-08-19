import Image from "next/image";

const tickeryAssets = {
  welcome: "/brand/final-v2/tickery-welcome.png",
  result: "/brand/final-v2/tickery-result.png",
  search: "/brand/final-v2/tickery-search.png",
  pension: "/brand/final-v2/tickery-pension.png",
  learning: "/brand/final-v2/tickery-learning.png",
  briefing: "/brand/final-v2/tickery-briefing.png",
  wayfinding: "/brand/final-v2/tickery-wayfinding.png",
} as const;

type TickeryPose = keyof typeof tickeryAssets;

type TickeryProps = {
  pose: TickeryPose;
  className?: string;
  alt?: string;
  priority?: boolean;
  sizes?: string;
};

export function Tickery({ pose, className = "", alt = "", priority = false, sizes = "160px" }: TickeryProps) {
  return <Image alt={alt} className={`object-contain ${className}`} height={512} priority={priority} sizes={sizes} src={tickeryAssets[pose]} width={512} />;
}
