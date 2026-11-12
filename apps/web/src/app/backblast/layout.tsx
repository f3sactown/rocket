import type { Metadata } from "next";
import { shareMetadata } from "@/lib/share-metadata";

// A shared link to a backblast previews with this title and Rocket's icon.
export const metadata: Metadata = {
  title: "Backblast · Rocket",
  ...shareMetadata("Backblast on Rocket"),
};

export default function BackblastLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
