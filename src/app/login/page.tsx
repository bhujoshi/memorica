"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Lock, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, openAuthModal } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <div className="rounded-3xl border border-stone-200 bg-white p-8 text-center shadow-sm space-y-5">
        <img
          src="/illustrations/invite-envelope.jpg"
          alt="Indian festive emerald invitation envelope with marigold blooms and glowing brass diya"
          className="mx-auto h-36 w-auto object-contain mix-blend-multiply"
        />
        <div className="space-y-1.5">
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            Welcome to Memorica
          </h1>
          <p className="text-xs text-stone-500 leading-relaxed">
            Verify your email or phone number to manage your event,
            track RSVPs, or view live updates for weddings you are invited to.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            openAuthModal({
              onSuccess: () => router.push("/"),
            })
          }
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-5 py-3 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 transition"
        >
          <Sparkles className="h-4 w-4" />
          Sign In or Create Account
        </button>

        <div className="pt-2 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
          <Lock className="h-3 w-3" />
          <span>Verified account access</span>
        </div>
      </div>
    </div>
  );
}
