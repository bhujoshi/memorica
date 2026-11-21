"use client";

import CountryPhoneInput from "./CountryPhoneInput";
import { validateIdentifier } from "@/lib/contact-validation";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  UserDTO,
  WeddingDTO,
  RsvpStatus,
  encodeUserHintHeader,
} from "@/lib/types";
import {
  ArrowRight,
  CheckCircle2,
  Chrome,
  KeyRound,
  Lock,
  Mail,
  Phone,
  X,
} from "lucide-react";

export interface HostedWeddingSummary extends WeddingDTO {
  myRole?: "owner" | "co_admin";
  stats: {
    totalGuests: number;
    invitedCount?: number;
    remainingCount?: number;
    yesCount: number;
    noCount: number;
    maybeCount: number;
    pendingCount: number;
    registeredGuests: number;
    conflictCount: number;
    updatesCount: number;
  };
}

export interface InvitedWeddingSummary extends WeddingDTO {
  myRole?: "close_family" | "guest";
  canAccessFamily?: boolean;
  myRsvpStatus: RsvpStatus;
  myInviteToken?: string;
  updatesCount: number;
}

export interface AuthModalOptions {
  title?: string;
  subtitle?: string;
  claimInviteToken?: string;
  prefillName?: string;
  prefillEmail?: string;
  prefillPhone?: string;
  onSuccess?: (user: UserDTO) => void;
}

interface AuthContextValue {
  user: UserDTO | null;
  hostedWeddings: HostedWeddingSummary[];
  invitedWeddings: InvitedWeddingSummary[];
  loading: boolean;
  googleOAuthConfigured: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  openAuthModal: (options?: AuthModalOptions) => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [hostedWeddings, setHostedWeddings] = useState<HostedWeddingSummary[]>(
    []
  );
  const [invitedWeddings, setInvitedWeddings] = useState<
    InvitedWeddingSummary[]
  >([]);
  const [googleOAuthConfigured, setGoogleOAuthConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalOptions, setModalOptions] = useState<AuthModalOptions>({});

  // OTP Auth Flow State
  const [channel, setChannel] = useState<"email" | "phone">("email");
  const [step, setStep] = useState<"request" | "verify">("request");
  const [identifier, setIdentifier] = useState("");
  const [fullName, setFullName] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [devCodeHint, setDevCodeHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAuth = useCallback(async () => {
    try {
      let cachedUser: UserDTO | null = null;
      if (typeof window !== "undefined") {
        try {
          const raw = window.localStorage.getItem("wm_cached_user");
          if (raw) cachedUser = JSON.parse(raw);
        } catch {
          cachedUser = null;
        }
      }
      const res = await fetch("/api/auth/session", {
        cache: "no-store",
        credentials: "same-origin",
        headers: {
          ...encodeUserHintHeader(cachedUser),
        },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user || null);
        if (typeof window !== "undefined") {
          if (data.user) {
            window.localStorage.setItem(
              "wm_cached_user",
              JSON.stringify(data.user)
            );
          } else {
            window.localStorage.removeItem("wm_cached_user");
          }
        }
        setHostedWeddings(data.hostedWeddings || []);
        setInvitedWeddings(data.invitedWeddings || []);
        setGoogleOAuthConfigured(Boolean(data.googleOAuthConfigured));
      }
    } catch (e) {
      console.error("Failed to fetch session:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  const signOut = useCallback(async () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("wm_cached_user");
    }
    await fetch("/api/auth/session", {
      method: "DELETE",
      credentials: "same-origin",
    });
    setUser(null);
    setHostedWeddings([]);
    setInvitedWeddings([]);
  }, []);

  const openAuthModal = useCallback((options?: AuthModalOptions) => {
    setModalOptions(options || {});
    setStep("request");
    setOtpCode("");
    setDevCodeHint(null);
    setError(null);
    setFullName(options?.prefillName || "");

    if (options?.prefillEmail) {
      setChannel("email");
      setIdentifier(options.prefillEmail);
    } else if (options?.prefillPhone) {
      setChannel("phone");
      setIdentifier(options.prefillPhone);
    } else {
      setChannel("email");
      setIdentifier("");
    }

    setModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setModalOpen(false);
    setError(null);
  }, []);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const validatedIdentifier = validateIdentifier(identifier, channel);
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: validatedIdentifier,
          channel,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not send verification code");
      }
      setIdentifier(data.identifier);
      if (data.devVerificationCode) {
        setDevCodeHint(data.devVerificationCode);
        setOtpCode(data.devVerificationCode);
      } else {
        setDevCodeHint(null);
      }
      setStep("verify");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send verification code"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: "otp",
          identifier,
          channel,
          code: otpCode,
          name: fullName || undefined,
          claimInviteToken: modalOptions.claimInviteToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Verification failed");
      }

      setUser(data.user);
      if (typeof window !== "undefined" && data.user) {
        window.localStorage.setItem(
          "wm_cached_user",
          JSON.stringify(data.user)
        );
      }
      setHostedWeddings(data.hostedWeddings || []);
      setInvitedWeddings(data.invitedWeddings || []);
      setModalOpen(false);
      if (modalOptions.onSuccess && data.user) {
        modalOptions.onSuccess(data.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        hostedWeddings,
        invitedWeddings,
        loading,
        googleOAuthConfigured,
        refreshAuth,
        signOut,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}

      {modalOpen && (
        <div className="sheet-overlay fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-stone-950/40 sm:p-4 backdrop-blur-sm">
          <div className="sheet-panel relative w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-[#ffffff] p-5 sm:p-6 shadow-2xl border border-rose-100 space-y-5">
            <button
              type="button"
              onClick={closeAuthModal}
              className="absolute right-4 top-4 rounded-full p-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="space-y-1 pr-6">
              <h2 className="font-serif text-xl font-bold text-stone-900">
                {modalOptions.title || "Sign in or Create Account"}
              </h2>
              <p className="text-xs text-stone-500">
                {modalOptions.subtitle ||
                  "Verify your email or phone to manage your events or access live guest updates."}
              </p>
            </div>

            {modalOptions.claimInviteToken && (
              <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  Verifying your account will automatically link your RSVP and
                  unlock live wedding updates.
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-medium text-red-700">
                {error}
              </div>
            )}

            {/* Google OAuth Button */}
            {googleOAuthConfigured && (
              <>
                <a
                  href={`/api/auth/google?returnTo=${encodeURIComponent(
                    typeof window !== "undefined"
                      ? window.location.pathname + window.location.search
                      : "/"
                  )}&claimInviteToken=${encodeURIComponent(
                    modalOptions.claimInviteToken || ""
                  )}`}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-800 shadow-sm hover:bg-stone-50 transition"
                >
                  <Chrome className="h-4 w-4 text-rose-700" />
                  Continue with Google
                </a>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-stone-200" />
                  <span className="flex-shrink mx-3 text-[11px] uppercase text-stone-400 font-medium">
                    Or verify with code
                  </span>
                  <div className="flex-grow border-t border-stone-200" />
                </div>
              </>
            )}

            {step === "request" ? (
              <form onSubmit={handleRequestOtp} className="space-y-4">
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-stone-100 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setChannel("email");
                      setIdentifier(modalOptions.prefillEmail || "");
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                      channel === "email"
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email Verification
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setChannel("phone");
                      setIdentifier(modalOptions.prefillPhone || "");
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition ${
                      channel === "phone"
                        ? "bg-white text-stone-900 shadow-sm"
                        : "text-stone-600 hover:text-stone-900"
                    }`}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Phone OTP
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    {channel === "email"
                      ? "Email Address *"
                      : "Mobile Phone Number *"}
                  </label>
                  {channel === "phone" ? <CountryPhoneInput label="Mobile phone number" required value={identifier} onChange={setIdentifier}/> : <input type="email" required placeholder="you@example.com" value={identifier} onChange={e=>setIdentifier(e.target.value)} className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm"/>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Arjun Kapoor"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-3 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50 transition"
                >
                  {submitting
                    ? "Getting Verification Code..."
                    : "Get 6-Digit Verification Code"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 text-xs text-stone-600">
                  {devCodeHint ? "Use the dummy verification code shown below for" : "We sent a 6-digit verification code to"}{" "}
                  <strong className="text-stone-900">{identifier}</strong>.
                  <button
                    type="button"
                    onClick={() => setStep("request")}
                    className="ml-2 text-rose-700 font-semibold underline"
                  >
                    Change
                  </button>
                </div>

                {devCodeHint && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                    <span className="font-semibold">
                      Dummy verification code:
                    </span>{" "}
                    <code className="font-mono font-bold text-sm bg-white px-2 py-0.5 rounded border border-amber-300">
                      {devCodeHint}
                    </code>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Enter 6-Digit Verification Code *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    placeholder="123456"
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, ""))
                    }
                    className="w-full rounded-xl border border-stone-300 px-4 py-2.5 text-center font-mono text-lg tracking-[0.4em] font-bold focus:border-rose-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || otpCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-3 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 disabled:opacity-50 transition"
                >
                  <KeyRound className="h-4 w-4" />
                  {submitting ? "Verifying..." : "Verify & Continue"}
                </button>
              </form>
            )}

            <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-stone-100 text-[11px] text-stone-400">
              <Lock className="h-3 w-3" />
              <span>Encrypted database session • Verified event access</span>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
