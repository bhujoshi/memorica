"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Clock,
  HeartHandshake,
  ListChecks,
  Lock,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Vote,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import DateInput from "@/components/DateInput";
import {
  POLL_CATEGORIES,
  SOCIAL_REACTIONS,
  formatShortDate,
} from "@/lib/format";
import {
  FamilyPollDTO,
  FamilyTaskDTO,
  SocialPostDTO,
  WeddingDTO,
  encodeUserHintHeader,
} from "@/lib/types";

type FamilyTab = "polls" | "discussions" | "tasks";

export default function CloseFamilyRoom({
  slugOrId,
  embedded = false,
}: {
  slugOrId: string;
  embedded?: boolean;
}) {
  const { user, openAuthModal } = useAuth();
  const [wedding, setWedding] = useState<WeddingDTO | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [polls, setPolls] = useState<FamilyPollDTO[]>([]);
  const [tasks, setTasks] = useState<FamilyTaskDTO[]>([]);
  const [discussions, setDiscussions] = useState<SocialPostDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [tab, setTab] = useState<FamilyTab>("polls");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  // Poll form state
  const [showPollForm, setShowPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollCategory, setPollCategory] = useState("venue");
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);

  // Discussion state
  const [discussionText, setDiscussionText] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  // Task state
  const [taskTitle, setTaskTitle] = useState("");
  const [taskAssignee, setTaskAssignee] = useState("");
  const [taskCategory, setTaskCategory] = useState("other");
  const [taskDueDate, setTaskDueDate] = useState("");

  const applyData = useCallback(
    (data: {
      wedding?: WeddingDTO;
      canManage?: boolean;
      polls?: FamilyPollDTO[];
      tasks?: FamilyTaskDTO[];
      discussions?: SocialPostDTO[];
    }) => {
      if (data.wedding) setWedding(data.wedding);
      if (typeof data.canManage === "boolean") setCanManage(data.canManage);
      setPolls(data.polls || []);
      setTasks(data.tasks || []);
      setDiscussions(data.discussions || []);
    },
    []
  );

  const load = useCallback(async () => {
    setLoading(true);
    setErrorCode(null);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/weddings/${slugOrId}/family`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: { ...encodeUserHintHeader(user) },
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorCode(data.code || (res.status === 401 ? "AUTH_REQUIRED" : "ERROR"));
        setErrorMessage(data.error || "Unable to open Close Family room.");
        return;
      }
      applyData(data);
    } catch {
      setErrorCode("ERROR");
      setErrorMessage("Failed to load Close Family room.");
    } finally {
      setLoading(false);
    }
  }, [slugOrId, user, applyData]);

  useEffect(() => {
    load();
  }, [load]);

  async function postFamilyAction(payload: Record<string, unknown>, successMsg?: string) {
    if (!wedding || busy) return;
    setBusy(true);
    setNotice("");
    try {
      const res = await fetch(`/api/weddings/${wedding.id}/family`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          ...encodeUserHintHeader(user),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed.");
      applyData(data);
      if (successMsg) setNotice(successMsg);
      return true;
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save changes.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePoll(e: React.FormEvent) {
    e.preventDefault();
    const ok = await postFamilyAction(
      {
        action: "create_poll",
        question: pollQuestion,
        category: pollCategory,
        allowMultiple: pollAllowMultiple,
        options: pollOptions,
      },
      "Family poll published! Everyone in Close Family can vote now."
    );
    if (ok) {
      setPollQuestion("");
      setPollOptions(["", ""]);
      setPollAllowMultiple(false);
      setShowPollForm(false);
    }
  }

  async function handleTogglePollClosed(pollId: string, isClosed: boolean) {
    if (!wedding) return;
    const res = await fetch(`/api/weddings/${wedding.id}/family`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...encodeUserHintHeader(user),
      },
      body: JSON.stringify({ action: "toggle_poll", pollId, isClosed }),
    });
    if (res.ok) applyData(await res.json());
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    const ok = await postFamilyAction(
      {
        action: "create_task",
        title: taskTitle,
        assigneeName: taskAssignee || undefined,
        category: taskCategory,
        dueDate: taskDueDate || undefined,
      },
      "Added to the family planning checklist."
    );
    if (ok) {
      setTaskTitle("");
      setTaskAssignee("");
      setTaskDueDate("");
    }
  }

  async function handleTaskStatus(taskId: string, status: FamilyTaskDTO["status"]) {
    if (!wedding) return;
    const res = await fetch(`/api/weddings/${wedding.id}/family`, {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...encodeUserHintHeader(user),
      },
      body: JSON.stringify({ action: "update_task", taskId, status }),
    });
    if (res.ok) applyData(await res.json());
  }

  async function handleDelete(paramKey: "pollId" | "taskId" | "postId", id: string) {
    if (!wedding) return;
    const res = await fetch(
      `/api/weddings/${wedding.id}/family?${paramKey}=${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        credentials: "same-origin",
        headers: { ...encodeUserHintHeader(user) },
      }
    );
    if (res.ok) applyData(await res.json());
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center space-y-3">
        <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-amber-200 border-t-amber-700" />
        <p className="text-sm text-stone-500">Opening Close Family room...</p>
      </div>
    );
  }

  if (errorCode || !wedding) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <div className="rounded-3xl border border-amber-200 bg-white p-7 text-center shadow-sm space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <Lock className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-2xl font-bold text-stone-900">
            Close Family Inner Circle
          </h1>
          <p className="text-sm text-stone-600 leading-relaxed">
            {errorMessage ||
              "This private planning & voting room is exclusively for close family members and event organizers."}
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            {errorCode === "AUTH_REQUIRED" && (
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="rounded-xl bg-rose-700 px-5 py-2.5 text-xs font-semibold text-white"
              >
                Sign In
              </button>
            )}
            <Link
              href={`/events/${slugOrId}/social`}
              className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-2.5 text-xs font-semibold text-stone-700"
            >
              Visit Guest Celebration Page
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const taskPct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;

  return (
    <div className={embedded ? "space-y-5" : "mx-auto max-w-4xl px-4 py-6 sm:py-8 space-y-6"}>
      {/* Header Banner */}
      {!embedded && (
        <section className="rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-rose-50/70 p-6 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-300 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-amber-950">
              <HeartHandshake className="h-3.5 w-3.5" />
              Close Family Private Room · Invite-Only
            </span>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/events/${wedding.slug}/social`}
                className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                <Sparkles className="h-3.5 w-3.5 text-rose-700" />
                Guest Social Page
              </Link>
              {canManage && (
                <Link
                  href={`/host/weddings/${wedding.id}`}
                  className="rounded-xl bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  Organizer Hub
                </Link>
              )}
            </div>
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
                {wedding.coupleNames || wedding.eventTitle} — Family Planning
              </h1>
              <p className="text-xs sm:text-sm text-stone-600 max-w-xl">
                Decide venues, menus, outfits, and rituals together with live voting,
                private threads, and shared family responsibilities.
              </p>
            </div>
            <img
              src="/illustrations/family-planning.jpg"
              alt="Close family gathered around tea and marigold garlands planning celebrations together"
              className="hidden md:block h-28 w-auto shrink-0 object-contain mix-blend-multiply"
            />
          </div>
        </section>
      )}

      {/* Room Navigation */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-stone-100 p-1.5">
        {(
          [
            { id: "polls", label: `Polls & Voting (${polls.length})`, icon: Vote },
            { id: "discussions", label: `Discussions (${discussions.length})`, icon: MessageSquare },
            { id: "tasks", label: `Checklist (${doneTasks}/${tasks.length})`, icon: ListChecks },
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
                active ? "bg-white text-stone-900 shadow-sm" : "text-stone-600"
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

      {/* TAB 1: POLLS & VOTING */}
      {tab === "polls" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-bold text-stone-900">
                Family Decisions &amp; Polls
              </h2>
              <p className="text-xs text-stone-500">
                Tap an option to vote. Change your vote anytime while a poll is open.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowPollForm((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-800 shrink-0"
            >
              <Plus className="h-4 w-4" />
              {showPollForm ? "Close Form" : "New Poll"}
            </button>
          </div>

          {showPollForm && (
            <form
              onSubmit={handleCreatePoll}
              className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Poll Question *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Which theme for Haldi ceremony?"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Topic
                  </label>
                  <select
                    value={pollCategory}
                    onChange={(e) => setPollCategory(e.target.value)}
                    className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
                  >
                    {POLL_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-semibold text-stone-700">
                  Options (2–8) *
                </span>
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input
                      type="text"
                      required={idx < 2}
                      placeholder={`Option ${idx + 1}`}
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptions];
                        next[idx] = e.target.value;
                        setPollOptions(next);
                      }}
                      className="flex-1 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-sm"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPollOptions(pollOptions.filter((_, i) => i !== idx))
                        }
                        className="rounded-xl border border-stone-200 bg-white px-3 text-xs text-stone-500 hover:text-red-600"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 8 && (
                  <button
                    type="button"
                    onClick={() => setPollOptions([...pollOptions, ""])}
                    className="text-xs font-semibold text-rose-700 underline"
                  >
                    + Add another option
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs text-stone-700">
                  <input
                    type="checkbox"
                    checked={pollAllowMultiple}
                    onChange={(e) => setPollAllowMultiple(e.target.checked)}
                  />
                  Allow family members to pick multiple options
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-xl bg-rose-700 px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {busy ? "Creating..." : "Publish Poll"}
                </button>
              </div>
            </form>
          )}

          {polls.length === 0 ? (
            <div className="celebration-empty">
              <img
                src="/illustrations/family-planning.jpg"
                alt="Close family planning together over chai with swatches and checklists"
                className="mx-auto mb-3 h-40 w-auto object-contain mix-blend-multiply"
              />
              <h3>No family polls yet</h3>
              <p>Create a quick poll to vote on venues, menus, outfits, or Sangeet songs.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {polls.map((poll) => (
                <article
                  key={poll.id}
                  className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-900">
                          {POLL_CATEGORIES.find((c) => c.id === poll.category)?.label || "Planning"}
                        </span>
                        {poll.allowMultiple && (
                          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                            Multi-select
                          </span>
                        )}
                        {poll.isClosed && (
                          <span className="rounded-full bg-stone-800 px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">
                            Closed
                          </span>
                        )}
                      </div>
                      <h3 className="font-serif text-lg font-bold text-stone-900">
                        {poll.question}
                      </h3>
                      <p className="text-[11px] text-stone-500">
                        Asked by {poll.creatorName} · {poll.totalVoters}{" "}
                        {poll.totalVoters === 1 ? "family member" : "family members"} voted
                      </p>
                    </div>

                    {(poll.creatorUserId === user?.id || canManage) && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleTogglePollClosed(poll.id, !poll.isClosed)
                          }
                          className="rounded-lg border border-stone-200 px-2.5 py-1 text-[11px] font-semibold text-stone-600 hover:bg-stone-50"
                        >
                          {poll.isClosed ? "Reopen" : "Close"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete("pollId", poll.id)}
                          className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600"
                          title="Delete poll"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {poll.options.map((opt) => {
                      const pct =
                        poll.totalVotes > 0
                          ? Math.round((opt.voteCount / poll.totalVotes) * 100)
                          : 0;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          disabled={poll.isClosed || busy}
                          onClick={() =>
                            postFamilyAction({
                              action: "vote",
                              pollId: poll.id,
                              optionId: opt.id,
                            })
                          }
                          className={`relative w-full overflow-hidden rounded-xl border p-3 text-left transition ${
                            opt.votedByMe
                              ? "border-rose-600 bg-rose-50/40"
                              : "border-stone-200 bg-white hover:border-rose-300"
                          } disabled:cursor-default`}
                        >
                          <div
                            className={`absolute inset-y-0 left-0 transition-all ${
                              opt.votedByMe ? "bg-rose-200/55" : "bg-stone-100/80"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                          <div className="relative flex items-center justify-between gap-2 text-sm">
                            <span className="font-semibold text-stone-900 flex items-center gap-2">
                              {opt.votedByMe && (
                                <CheckCircle2 className="h-4 w-4 text-rose-700 shrink-0" />
                              )}
                              {opt.label}
                            </span>
                            <span className="text-xs font-bold text-stone-700 tabular-nums shrink-0">
                              {opt.voteCount} ({pct}%)
                            </span>
                          </div>
                          {opt.voters.length > 0 && (
                            <p className="relative mt-1 text-[11px] text-stone-500">
                              Voted: {opt.voters.join(", ")}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PRIVATE FAMILY DISCUSSIONS */}
      {tab === "discussions" && (
        <div className="space-y-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!discussionText.trim()) return;
              const ok = await postFamilyAction({ content: discussionText });
              if (ok) setDiscussionText("");
            }}
            className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm space-y-3"
          >
            <textarea
              rows={3}
              value={discussionText}
              onChange={(e) => setDiscussionText(e.target.value)}
              placeholder="Discuss vendor shortlists, family choreography, airport pickups, or ceremony timings privately..."
              className="w-full rounded-xl border border-stone-300 p-3 text-sm focus:border-rose-600 focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={busy || !discussionText.trim()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-rose-700 px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                Post to Family Room
              </button>
            </div>
          </form>

          {discussions.length === 0 ? (
            <div className="celebration-empty">
              <MessageSquare className="h-7 w-7" />
              <h3>Start a private family thread</h3>
              <p>Keep all inner-circle planning ideas organized in one calm place.</p>
            </div>
          ) : (
            discussions.map((post) => (
              <article
                key={post.id}
                className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-bold text-stone-900">
                      {post.authorName}
                    </span>
                    <span className="ml-2 text-[11px] text-stone-400">
                      {new Date(post.createdAt).toLocaleString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {(post.authorUserId === user?.id || canManage) && (
                    <button
                      type="button"
                      onClick={() => handleDelete("postId", post.id)}
                      className="rounded-lg p-1.5 text-stone-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-stone-800 whitespace-pre-line">
                  {post.content}
                </p>
                <div className="flex flex-wrap gap-2">
                  {SOCIAL_REACTIONS.map((r) => {
                    const count = post.reactions[r.id] || 0;
                    const active = post.myReactions.includes(r.id);
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() =>
                          postFamilyAction({
                            action: "react",
                            postId: post.id,
                            emoji: r.id,
                          })
                        }
                        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          active
                            ? "border-rose-400 bg-rose-50 text-rose-900"
                            : "border-stone-200 bg-stone-50 text-stone-600"
                        }`}
                      >
                        {r.symbol}
                        {count > 0 && <span>{count}</span>}
                      </button>
                    );
                  })}
                </div>
                {post.comments.length > 0 && (
                  <div className="space-y-1.5 rounded-xl bg-stone-50 p-3">
                    {post.comments.map((c) => (
                      <div key={c.id} className="text-xs">
                        <strong className="text-stone-900">{c.authorName}: </strong>
                        <span className="text-stone-700">{c.content}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Reply to family..."
                    value={commentDrafts[post.id] || ""}
                    onChange={(e) =>
                      setCommentDrafts((prev) => ({
                        ...prev,
                        [post.id]: e.target.value,
                      }))
                    }
                    className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const text = (commentDrafts[post.id] || "").trim();
                      if (!text) return;
                      const ok = await postFamilyAction({
                        action: "comment",
                        postId: post.id,
                        content: text,
                      });
                      if (ok) {
                        setCommentDrafts((prev) => ({ ...prev, [post.id]: "" }));
                      }
                    }}
                    className="rounded-xl bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white"
                  >
                    Reply
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {/* TAB 3: SHARED FAMILY CHECKLIST */}
      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-stone-700">Family Planning Progress</span>
              <span className="text-emerald-700 tabular-nums">
                {doneTasks} of {tasks.length} done ({taskPct}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${taskPct}%` }}
              />
            </div>
          </div>

          <form
            onSubmit={handleCreateTask}
            className="rounded-2xl border border-stone-200 bg-white p-4 sm:p-5 shadow-sm space-y-3"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                required
                placeholder="Task (e.g. Confirm dholwala & ghodi booking)"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                className="rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm"
              />
              <input
                type="text"
                placeholder="Assigned to (e.g. Chacha ji / Riya)"
                value={taskAssignee}
                onChange={(e) => setTaskAssignee(e.target.value)}
                className="rounded-xl border border-stone-300 px-3.5 py-2.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <select
                value={taskCategory}
                onChange={(e) => setTaskCategory(e.target.value)}
                className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
              >
                {POLL_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <DateInput
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
              />
              <button
                type="submit"
                disabled={busy || !taskTitle.trim()}
                className="rounded-xl bg-rose-700 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                + Add Task
              </button>
            </div>
          </form>

          {tasks.length === 0 ? (
            <div className="celebration-empty">
              <img
                src="/illustrations/family-planning.jpg"
                alt="Indian family planning checklists together"
                className="mx-auto mb-3 h-40 w-auto object-contain mix-blend-multiply"
              />
              <h3>No checklist items yet</h3>
              <p>Assign rituals, pickups, shopping, and vendor follow-ups across family members.</p>
            </div>
          ) : (
            <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
              {tasks.map((task) => {
                const nextStatus: FamilyTaskDTO["status"] =
                  task.status === "todo"
                    ? "in_progress"
                    : task.status === "in_progress"
                    ? "done"
                    : "todo";
                return (
                  <div
                    key={task.id}
                    className="p-4 flex items-start justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => handleTaskStatus(task.id, nextStatus)}
                      className="flex items-start gap-3 text-left flex-1 min-w-0"
                    >
                      {task.status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                      ) : task.status === "in_progress" ? (
                        <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="h-5 w-5 text-stone-300 shrink-0 mt-0.5" />
                      )}
                      <div className="min-w-0">
                        <div
                          className={`text-sm font-semibold ${
                            task.status === "done"
                              ? "line-through text-stone-400"
                              : "text-stone-900"
                          }`}
                        >
                          {task.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-stone-500">
                          {task.assigneeName && (
                            <span className="rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-800">
                              {task.assigneeName}
                            </span>
                          )}
                          <span className="uppercase font-medium">
                            {task.status.replace("_", " ")}
                          </span>
                          {task.dueDate && (
                            <span>Due {formatShortDate(task.dueDate)}</span>
                          )}
                        </div>
                      </div>
                    </button>

                    {(task.creatorUserId === user?.id || canManage) && (
                      <button
                        type="button"
                        onClick={() => handleDelete("taskId", task.id)}
                        className="rounded-lg p-1.5 text-stone-400 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
