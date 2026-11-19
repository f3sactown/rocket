"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** The Exicon's old address (/library): goes to /exicon. */
export default function OldLibraryPage() {
  const router = useRouter();
  useEffect(() => router.replace("/exicon"), [router]);
  return null;
}
