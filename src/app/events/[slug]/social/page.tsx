"use client";

import React from "react";
import { useParams } from "next/navigation";
import CelebrationSocialHub from "@/components/social/CelebrationSocialHub";

export default function EventSocialPage() {
  const params = useParams<{ slug: string }>();
  return <CelebrationSocialHub slugOrId={params.slug} />;
}
