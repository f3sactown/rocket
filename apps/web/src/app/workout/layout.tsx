import type { Metadata } from "next";
import { shareMetadata } from "@/lib/share-metadata";

// A shared link to a workout previews with this title and Rocket's icon.
export const metadata: Metadata = {
  title: "Workout · Rocket",
  ...shareMetadata("Workout on Rocket"),
};

export default function WorkoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
