"use client";

import React from "react";
import { useParams } from "next/navigation";
import CloseFamilyRoom from "@/components/family/CloseFamilyRoom";

export default function CloseFamilyPage() {
  const params = useParams<{ slug: string }>();
  return <CloseFamilyRoom slugOrId={params.slug} />;
}
