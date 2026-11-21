"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  Camera,
  Heart,
  HeartHandshake,
  ImagePlus,
  Lock,
  MapPin,
  MessageCircle,
  Send,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import {
  PHOTO_ALBUMS,
  SOCIAL_REACTIONS,
  formatCountdownLabel,
  formatShortDate,
  guestGroupLabel,
} from "@/lib/format";
import {
  PlannedGuestAttendanceDTO,
  SharedPhotoDTO,
  SocialPostDTO,
  WeddingDTO,
  encodeUserHintHeader,
  formatWeddingDateRange,
} from "@/lib/types";

type SocialTab = "moments" | "whos_coming" | "photos";

export default function CelebrationSocialHub({
  slugOrId,
  embedded = false,
}: {
  slugOrId: string;
  embedded?: boolean;
}) {
  const { user, openAuthModal } = useAuth();
  const [wedding, setWedding] = useState<WeddingDTO | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [canAccessFamily, setCanAccessFamily] = useState(false);
  const [posts, setPosts] = useState<SocialPostDTO[]>([]);
  const [attendees, setAttendees] = useState<PlannedGuestAttendanceDTO[]>([]);
  const [photos, setPhotos] = useState<SharedPhotoDTO[]>([]);
  const [stats, setStats] = useState({
    confirmedCount: 0,
    confirmedHeadcount: 0,
    maybeCount: 0,
    sharedDatesCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [tab, setTab] = useState<SocialTab>("moments");
  const [postKind, setPostKind] = useState<"moment" | "wish" | "plan">("moment");
  const [postContent, setPostContent] = useState("");
  const [postMediaId, setPostMediaId] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  // Photo album state
  const [selectedAlbum, setSelectedAlbum] = useState<string>("All Memories");
  const [uploadAlbum, setUploadAlbum] = useState<string>("All Memories");
  const [photoCaption, setPhotoCaption] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/weddings/${slugOrId}/social`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { ...encodeUserHintHeader(user) },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCode(data.code || (res.status === 401 ? "AUTH_REQUIRED" : "ERROR"));
        setErrorMessage(data.error || "Unable to open celebration social page.");
        return;
      }
      setWedding(data.wedding);
      setCanManage(Boolean(data.canManage));
      setCanAccessFamily(Boolean(data.canAccessFamily));
      setPosts(data.posts || []);
      setAttendees(data.attendees || []);
      setPhotos(data.photos || []);
      if (data.stats) setStats(data.stats);
    } catch {
      setErrorCode("ERROR");
      setErrorMessage("Failed to load celebration social page.");
    } finally {
      setLoading(false);
    }
  }, [slugOrId, user]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadImage(file: File, scope: "social" | "photo"): Promise<string> {
    if (!wedding) throw new Error("Event not loaded.");
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/weddings/${wedding.id}/media?scope=${scope}`, {
      method: "POST",
      credentials: "same-origin",
      headers: { ...encodeUserHintHeader(user) },
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as {
      asset?: { id: string };
      error?: string;
    };
    if (!res.ok || !data.asset) {
      throw new Error(data.error || `Upload failed (HTTP ${res.status}).`);
    }
    return data.asset.id;
  }

  async function handlePostPhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingMedia(true);
    setNotice("");
    try {
      const id = await uploadImage(file, "social");
      setPostMediaId(id);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setUploadingMedia(false);
    }
  }

  async function handleCreatePost(e: React.FormEvent) {
    e.preventDefault();
    if (!wedding || submitting || (!postContent.trim() && !postMediaId)) return;
    setSubmitting(true);
    setNotice("");
    try {
      const res = await fetch(`/api/weddings/${wedding.id}/social`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify({
          kind: postMediaId ? "photo" : postKind,
          content: postContent,
          mediaAssetId: postMediaId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not share moment.");
      setPosts(data.posts || []);
      setPostContent("");
      setPostMediaId(null);
      setNotice("Moment posted to the celebration wall!");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Failed to publish post.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReact(postId: string, emoji: string) {
    if (!wedding) return;
    const res = await fetch(`/api/weddings/${wedding.id}/social`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...encodeUserHintHeader(user),
      },
      body: JSON.stringify({ action: "react", postId, emoji }),
    });
    if (res.ok) {
      const data = await res.json();
      setPosts(data.posts || []);
    }
  }

  async function handleComment(postId: string) {
    if (!wedding) return;
    const content = (commentDrafts[postId] || "").trim();
    if (!content) return;
    const res = await fetch(`/api/weddings/${wedding.id}/social`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...encodeUserHintHeader(user),
      },
      body: JSON.stringify({ action: "comment", postId, content }),
    });
    if (res.ok) {
      const data = await res.json();
      setPosts(data.posts || []);
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
    }
  }

  async function handleDeletePost(postId: string) {
    if (!wedding) return;
    const res = await fetch(
      `/api/weddings/${wedding.id}/social?postId=${encodeURIComponent(postId)}`,
      {
        method: "DELETE",
        credentials: "same-origin",
        headers: { ...encodeUserHintHeader(user) },
      }
    );
    if (res.ok) {
      const data = await res.json();
      setPosts(data.posts || []);
    }
  }

  async function handleAlbumPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !wedding) return;
    setUploadingPhoto(true);
    setNotice("");
    try {
      const assetId = await uploadImage(file, "photo");
      const res = await fetch(`/api/weddings/${wedding.id}/photos`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify({
          assetId,
          albumName: uploadAlbum,
          caption: photoCaption || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not add photo.");
      setPhotos((prev) => [data.photo, ...prev]);
      setPhotoCaption("");
      setNotice("Photo added to the shared celebration album!");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not upload photo.");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDeletePhoto(photoId: string) {
    if (!wedding) return;
    const res = await fetch(
      `/api/weddings/${wedding.id}/photos?photoId=${encodeURIComponent(photoId)}`,
      {
        method: "DELETE",
        credentials: "same-origin",
        headers: { ...encodeUserHintHeader(user) },
      }
    );
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center space-y-3">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-rose-200 border-t-rose-700" />
        <p className="text-sm text-stone-500">Opening celebration page...</p>
      </div>
    );
  }

  if (errorCode || !wedding) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-3xl border border-stone-200 bg-white p-7 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            {errorCode === "AUTH_REQUIRED"
              ? "Sign In to Join the Celebration"
              : "Invited Guests Only"}
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            {errorMessage ||
              "Verify the email or mobile number on your invitation to post moments, share photos, and see who is coming."}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            {errorCode === "AUTH_REQUIRED" && (
              <button
                type="button"
                onClick={() =>
                  openAuthModal({
                    title: "Verify Your Invitation",
                    subtitle:
                      "Sign in with the email or mobile number you were invited on.",
                  })
                }
                className="rounded-xl bg-rose-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-rose-800"
              >
                Sign In / Verify Account
              </button>
            )}
            <Link
              href={`/invite/${slugOrId}`}
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100"
            >
              Open Invitation &amp; RSVP
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const visiblePhotos =
    selectedAlbum === "All Memories"
      ? photos
      : photos.filter((p) => p.albumName === selectedAlbum);

  return (
    <div className={`mood-${wedding.moodTheme} ${embedded ? "space-y-5" : "mx-auto max-w-4xl px-4 py-6 sm:py-8 space-y-6"}`}>
      {/* Festive Celebration Hero */}
      {!embedded && (
        <section className="mood-hero rounded-3xl p-6 sm:p-8 shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/25 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-200">
              <Sparkles className="h-3.5 w-3.5" />
              Celebration Social Page
            </span>
            <span className="rounded-full bg-black/25 px-3 py-1 text-xs font-semibold text-white">
              {formatCountdownLabel(wedding.date, wedding.endDate)}
            </span>
          </div>

          <div className="space-y-1">
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight">
              {wedding.coupleNames || wedding.eventTitle}
            </h1>
            {wedding.coupleNames && (
              <p className="text-sm sm:text-base text-white/85">{wedding.eventTitle}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-white/90">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-amber-300" />
              {formatWeddingDateRange(wedding.date, wedding.endDate)}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-amber-300" />
              {wedding.venue}
            </span>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Link
              href={`/invite/${wedding.slug}`}
              className="rounded-xl bg-white/15 border border-white/25 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/25"
            >
              Invitation &amp; Update RSVP
            </Link>
            <Link
              href={`/events/${wedding.slug}/updates`}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 border border-white/25 px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/25"
            >
              <Bell className="h-3.5 w-3.5" />
              Live Updates
            </Link>
            {canAccessFamily && (
              <Link
                href={`/events/${wedding.slug}/family`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-300 px-3.5 py-2 text-xs font-bold text-stone-950 hover:bg-amber-200"
              >
                <HeartHandshake className="h-3.5 w-3.5" />
                Close Family Room
              </Link>
            )}
            {canManage && (
              <Link
                href={`/host/weddings/${wedding.id}`}
                className="rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-stone-900 hover:bg-stone-100"
              >
                Organizer Dashboard →
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Celebratory Quick Stats */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
          <div className="text-[11px] text-stone-500">Celebrating Together</div>
          <div className="font-serif text-xl font-bold text-stone-900 tabular-nums">
            {stats.confirmedHeadcount}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            {stats.confirmedCount} RSVPs confirmed
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
          <div className="text-[11px] text-stone-500">Planned Dates Shared</div>
          <div className="font-serif text-xl font-bold text-stone-900 tabular-nums">
            {stats.sharedDatesCount}
          </div>
          <div className="text-[11px] text-amber-700 font-medium">
            Coordinate travel
          </div>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-3.5">
          <div className="text-[11px] text-stone-500">Shared Memories</div>
          <div className="font-serif text-xl font-bold text-stone-900 tabular-nums">
            {posts.length + photos.length}
          </div>
          <div className="text-[11px] text-rose-700 font-medium">
            {photos.length} album photos
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-stone-100 p-1.5">
        {(
          [
            { id: "moments", label: `Moments (${posts.length})`, icon: Sparkles },
            { id: "whos_coming", label: `Who's Coming (${attendees.length})`, icon: Users },
            { id: "photos", label: `Photos (${photos.length})`, icon: Camera },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 px-2 text-xs font-semibold transition ${
                active
                  ? "bg-white text-stone-900 shadow-sm"
                  : "text-stone-600 hover:text-stone-900"
              }`}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </div>

      {notice && (
        <p role="status" className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-xs font-medium text-emerald-900">
          {notice}
        </p>
      )}

      {/* TAB 1: MOMENTS & WISHES FEED */}
      {tab === "moments" && (
        <div className="space-y-5">
          <form
            onSubmit={handleCreatePost}
            className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm space-y-3"
          >
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "moment", label: "✨ Share a Moment" },
                  { id: "wish", label: "💐 Blessings & Wishes" },
                  { id: "plan", label: "✈️ Coordinate Travel / Outfits" },
                ] as const
              ).map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => setPostKind(k.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    postKind === k.id
                      ? "mood-button"
                      : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                  }`}
                >
                  {k.label}
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={postContent}
              onChange={(e) => setPostContent(e.target.value)}
              placeholder={
                postKind === "wish"
                  ? "Send your warmest blessings to the couple..."
                  : postKind === "plan"
                  ? "e.g. Landing in Udaipur on Dec 1 at 11 AM — anyone sharing a cab from the airport?"
                  : "Share excitement, outfit teasers, dance practice updates, or memories..."
              }
              className="w-full rounded-xl border border-stone-300 bg-white p-3 text-sm focus:border-rose-600 focus:outline-none"
            />

            {postMediaId && (
              <div className="relative rounded-xl overflow-hidden border border-stone-200 bg-stone-50">
                <img
                  src={`/api/media/${postMediaId}`}
                  alt="Attached celebration photo"
                  className="max-h-64 w-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => setPostMediaId(null)}
                  className="absolute top-2 right-2 rounded-full bg-stone-900/75 px-3 py-1 text-xs font-semibold text-white"
                >
                  Remove photo
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100">
                <ImagePlus className="h-4 w-4 text-rose-700" />
                {uploadingMedia ? "Uploading..." : "Add Photo"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={uploadingMedia || submitting}
                  onChange={handlePostPhotoSelect}
                  className="hidden"
                />
              </label>

              <button
                type="submit"
                disabled={submitting || uploadingMedia || (!postContent.trim() && !postMediaId)}
                className="mood-button inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-semibold shadow-sm disabled:opacity-40 transition"
              >
                <Send className="h-3.5 w-3.5" />
                {submitting ? "Posting..." : "Post to Celebration"}
              </button>
            </div>
          </form>

          {posts.length === 0 ? (
            <div className="celebration-empty">
              <img
                src="/illustrations/social-memories.jpg"
                alt="Joyful friends and family celebration photo frames with sparklers and fairy lights"
                className="mx-auto mb-3 h-40 w-auto object-contain mix-blend-multiply"
              />
              <h3>Start the celebration conversation</h3>
              <p>Be the first to share a wish, photo, or travel plan with fellow guests.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-100 font-serif text-sm font-bold text-rose-800 overflow-hidden">
                        {post.authorAvatarUrl ? (
                          <img
                            src={post.authorAvatarUrl}
                            alt={post.authorName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          post.authorName.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-stone-900">
                            {post.authorName}
                          </span>
                          <span className="mood-badge rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
                            {post.kind}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-400">
                          {new Date(post.createdAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>

                    {(post.authorUserId === user?.id || canManage) && (
                      <button
                        type="button"
                        onClick={() => handleDeletePost(post.id)}
                        className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                        title="Delete post"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <p className="text-sm text-stone-800 whitespace-pre-line leading-relaxed">
                    {post.content}
                  </p>

                  {post.mediaAssetId && (
                    <img
                      src={`/api/media/${post.mediaAssetId}`}
                      alt="Celebration moment"
                      className="max-h-96 w-full rounded-2xl object-contain bg-stone-50 border border-stone-100"
                    />
                  )}

                  {/* Festive Emoji Reactions */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {SOCIAL_REACTIONS.map((r) => {
                      const count = post.reactions[r.id] || 0;
                      const active = post.myReactions.includes(r.id);
                      return (
                        <button
                          key={r.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => handleReact(post.id, r.id)}
                          className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            active
                              ? "border-rose-400 bg-rose-50 text-rose-900"
                              : "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100"
                          }`}
                        >
                          <span>{r.symbol}</span>
                          {count > 0 && <span className="tabular-nums">{count}</span>}
                        </button>
                      );
                    })}
                    <span className="ml-auto inline-flex items-center gap-1 text-xs text-stone-500">
                      <MessageCircle className="h-3.5 w-3.5" />
                      {post.comments.length}
                    </span>
                  </div>

                  {/* Comments */}
                  {post.comments.length > 0 && (
                    <div className="space-y-2 rounded-xl bg-stone-50 p-3">
                      {post.comments.map((c) => (
                        <div key={c.id} className="text-xs leading-relaxed">
                          <span className="font-bold text-stone-900">
                            {c.authorName}:{" "}
                          </span>
                          <span className="text-stone-700">{c.content}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Write a warm reply..."
                      value={commentDrafts[post.id] || ""}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({
                          ...prev,
                          [post.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void handleComment(post.id);
                        }
                      }}
                      className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs focus:border-rose-600 focus:bg-white focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleComment(post.id)}
                      className="rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-stone-800"
                    >
                      Reply
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: WHO'S COMING & PLANNED DATES */}
      {tab === "whos_coming" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-lg font-bold text-stone-900">
                Who’s Coming &amp; Planned Dates
              </h2>
              <p className="text-xs text-stone-600">
                See which guests confirmed attendance and their shared arrival–departure dates so you can coordinate travel and meetups.
              </p>
            </div>
            <Link
              href={`/invite/${wedding.slug}`}
              className="mood-button inline-flex items-center justify-center rounded-xl px-4 py-2 text-xs font-semibold shrink-0"
            >
              Add / Update My Dates
            </Link>
          </div>

          {attendees.length === 0 ? (
            <div className="celebration-empty">
              <Users className="h-7 w-7" />
              <h3>RSVPs are rolling in soon</h3>
              <p>Confirmed and tentative guests will appear here along with their shared dates.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {attendees.map((g) => (
                <div
                  key={g.id}
                  className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-stone-900">
                        {g.name}
                      </div>
                      <div className="text-[11px] text-stone-500">
                        {guestGroupLabel(g.guestGroup)} · {g.partySize}{" "}
                        {g.partySize === 1 ? "guest" : "guests"}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        g.rsvpStatus === "yes"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {g.rsvpStatus === "yes" ? "Attending" : "Maybe"}
                    </span>
                  </div>

                  {g.plannedArrival ? (
                    <div className="inline-flex items-center gap-1.5 rounded-xl bg-rose-50 border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-900">
                      <Calendar className="h-3.5 w-3.5 text-rose-700" />
                      {formatShortDate(g.plannedArrival)}
                      {g.plannedDeparture &&
                        g.plannedDeparture !== g.plannedArrival &&
                        ` – ${formatShortDate(g.plannedDeparture)}`}
                    </div>
                  ) : (
                    <p className="text-xs text-stone-400">
                      Planned dates not shared yet
                    </p>
                  )}

                  {g.rsvpNote && (
                    <p className="text-xs italic text-stone-600">
                      &ldquo;{g.rsvpNote}&rdquo;
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 3: SHARED PHOTO ALBUMS */}
      {tab === "photos" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm space-y-3">
            <h2 className="font-serif text-lg font-bold text-stone-900">
              Share Celebration Photos
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-stone-700">
                Album
                <select
                  value={uploadAlbum}
                  onChange={(e) => setUploadAlbum(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
                >
                  {PHOTO_ALBUMS.map((alb) => (
                    <option key={alb} value={alb}>
                      {alb}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-stone-700">
                Caption (optional)
                <input
                  type="text"
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="e.g. Haldi dance with cousins!"
                  className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <label className="mood-button inline-flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold shadow-sm">
              <Camera className="h-4 w-4" />
              {uploadingPhoto ? "Uploading Photo..." : "Upload Photo to Album"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={uploadingPhoto}
                onChange={handleAlbumPhotoUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex overflow-x-auto gap-1.5 pb-1 no-scrollbar">
            {PHOTO_ALBUMS.map((alb) => (
              <button
                key={alb}
                type="button"
                onClick={() => setSelectedAlbum(alb)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  selectedAlbum === alb
                    ? "bg-stone-900 text-white"
                    : "bg-white border border-stone-200 text-stone-700 hover:bg-stone-50"
                }`}
              >
                {alb}
              </button>
            ))}
          </div>

          {visiblePhotos.length === 0 ? (
            <div className="celebration-empty">
              <img
                src="/illustrations/social-memories.jpg"
                alt="Festive celebration photo album collage"
                className="mx-auto mb-3 h-40 w-auto object-contain mix-blend-multiply"
              />
              <h3>No photos in {selectedAlbum} yet</h3>
              <p>Upload candid photos from Haldi, Mehndi, Sangeet, and family moments.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {visiblePhotos.map((p) => (
                <figure
                  key={p.id}
                  className="group relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm"
                >
                  <img
                    src={`/api/media/${p.assetId}`}
                    alt={p.caption || p.albumName}
                    className="h-48 sm:h-56 w-full object-cover bg-stone-100"
                  />
                  <figcaption className="p-2.5 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-rose-700 truncate">
                        {p.albumName}
                      </span>
                      {(p.uploaderUserId === user?.id || canManage) && (
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(p.id)}
                          className="text-stone-400 hover:text-red-600 p-0.5"
                          title="Remove photo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {p.caption && (
                      <p className="text-xs text-stone-800 line-clamp-2">{p.caption}</p>
                    )}
                    <p className="text-[11px] text-stone-400">By {p.uploaderName}</p>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
