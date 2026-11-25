const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { createRequire } = require("node:module");

const TEST_DB_PATH = `/tmp/memorica_platform_test_${process.pid}.db`;
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

const moduleCache = new Map();
const SRC_DIR = path.resolve("src");

function resolveTsFile(basePath) {
  for (const candidate of [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    path.join(basePath, "index.ts"),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function loadTs(file) {
  const filename = path.resolve(file);
  if (moduleCache.has(filename)) return moduleCache.get(filename).exports;
  const localRequire = createRequire(filename);
  const mod = { exports: {} };
  moduleCache.set(filename, mod);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;

  const customRequire = (name) => {
    if (name.startsWith("@/")) {
      const target = resolveTsFile(path.join(SRC_DIR, name.slice(2)));
      if (target) return loadTs(target);
    }
    if (name.startsWith(".")) {
      const target = resolveTsFile(path.resolve(path.dirname(filename), name));
      if (target) return loadTs(target);
    }
    return localRequire(name);
  };

  new Function("require", "module", "exports", code)(
    customRequire,
    mod,
    mod.exports
  );
  return mod.exports;
}

function cleanupDb() {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    const p = `${TEST_DB_PATH}${suffix}`;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

(async () => {
  cleanupDb();
  fs.writeFileSync(TEST_DB_PATH, "");
  execFileSync(
    path.resolve("node_modules/.bin/prisma"),
    ["db", "push", "--skip-generate", "--accept-data-loss"],
    {
      env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
      stdio: "pipe",
    }
  );

  const { prisma } = loadTs("src/lib/prisma.ts");
  const { formatINR, normalizeEventMood, normalizeGuestGroup } = loadTs(
    "src/lib/format.ts"
  );
  const { detectMediaMime } = loadTs("src/lib/storage.ts");
  const {
    createWedding,
    updateWedding,
    addGuestsToWedding,
    submitGuestRsvp,
    getWeddingAccess,
  } = loadTs("src/lib/db.ts");
  const {
    inviteEventMember,
    listEventTeam,
    updateMemberRole,
    revokeMemberOrInvite,
  } = loadTs("src/lib/roles.ts");
  const {
    getSocialHubData,
    createSocialPost,
    addSocialComment,
    toggleSocialReaction,
    createSharedPhoto,
  } = loadTs("src/lib/social.ts");
  const {
    getFamilyRoomData,
    createFamilyPoll,
    toggleFamilyPollVote,
    setFamilyPollClosed,
    createFamilyTask,
    updateFamilyTask,
  } = loadTs("src/lib/family.ts");
  const {
    getBudgetData,
    createBudgetItem,
    updateBudgetItem,
    getVendorBookings,
    createVendorBooking,
    updateVendorBooking,
  } = loadTs("src/lib/organizer.ts");

  try {
    // 1. Format & magic-byte helpers
    assert.equal(formatINR(150000), "₹1,50,000");
    assert.equal(formatINR(1250000), "₹12,50,000");
    assert.equal(normalizeEventMood("haldi"), "haldi");
    assert.equal(normalizeEventMood("invalid"), "emerald");
    assert.equal(normalizeGuestGroup("bride_side"), "bride_side");
    assert.equal(normalizeGuestGroup("unknown"), "general");
    assert.equal(
      detectMediaMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "image/png"
    );
    assert.equal(
      detectMediaMime(Buffer.from("%PDF-1.7\n")),
      "application/pdf"
    );
    assert.equal(detectMediaMime(Buffer.from("not-a-valid-file")), null);

    // 2. Create users & event
    const owner = await prisma.user.create({
      data: {
        name: "Aarav Verma",
        email: "aarav@example.com",
        phone: "+919811111111",
        onboardingCompleted: true,
      },
    });
    const guestUser = await prisma.user.create({
      data: {
        name: "Rohan Mehta",
        email: "rohan@example.com",
        phone: "+919822222222",
        onboardingCompleted: true,
      },
    });
    const guestUserTwo = await prisma.user.create({
      data: {
        name: "Ananya Kapoor",
        email: "ananya@example.com",
        phone: "+919855555555",
        onboardingCompleted: true,
      },
    });
    const outsider = await prisma.user.create({
      data: {
        name: "Uninvited Stranger",
        email: "stranger@example.com",
        onboardingCompleted: true,
      },
    });

    const wedding = await createWedding({
      ownerUserId: owner.id,
      eventType: "Wedding",
      moodTheme: "haldi",
      coupleNames: "Aarav & Diya",
      eventTitle: "Aarav & Diya Wedding Celebrations",
      date: "2026-12-10T10:00:00.000Z",
      endDate: "2026-12-12T22:00:00.000Z",
      venue: "Rambagh Palace, Jaipur",
      description: "Join us in Jaipur for Haldi, Sangeet & Pheras!",
    });
    assert.equal(wedding.moodTheme, "haldi");

    // Upload an invitation card & complete setup details so RSVPs are enabled
    const cardAsset = await prisma.eventAsset.create({
      data: {
        weddingId: wedding.id,
        name: "invite-card.png",
        mime: "image/png",
        scope: "setup",
        data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      },
    });
    const updatedWedding = await updateWedding(wedding.id, owner.id, {
      description: "Join us in Jaipur for Haldi, Sangeet & Pheras!",
      setup: {
        ...wedding.setup,
        groomName: "Aarav",
        brideName: "Diya",
        card: { id: cardAsset.id, name: cardAsset.name, mime: cardAsset.mime },
      },
    });
    assert.equal(updatedWedding.coupleNames, "Aarav & Diya");

    // 3. Pending Co-Admin & Close Family role invites auto-activate on later sign-in
    const coAdminInvite = await inviteEventMember({
      weddingId: wedding.id,
      actorUserId: owner.id,
      name: "Neha Verma",
      phone: "+91 98333 33333",
      role: "co_admin",
    });
    assert.equal(coAdminInvite.activatedImmediately, false);

    const familyInvite = await inviteEventMember({
      weddingId: wedding.id,
      actorUserId: owner.id,
      name: "Rajesh Uncle",
      email: "rajesh.uncle@example.com",
      role: "close_family",
    });
    assert.equal(familyInvite.activatedImmediately, false);

    // Later these users sign up & call getWeddingAccess -> auto-claim activates memberships!
    const coAdmin = await prisma.user.create({
      data: {
        name: "Neha Verma",
        phone: "+919833333333",
        onboardingCompleted: true,
      },
    });
    const closeFamilyUser = await prisma.user.create({
      data: {
        name: "Rajesh Uncle",
        email: "rajesh.uncle@example.com",
        onboardingCompleted: true,
      },
    });

    const coAdminAccess = await getWeddingAccess(wedding.id, coAdmin.id);
    assert.equal(coAdminAccess.detailedRole, "co_admin");
    assert.equal(coAdminAccess.isOwner, false);
    assert.equal(coAdminAccess.canManage, true);
    assert.equal(coAdminAccess.canManageRoles, false);
    assert.equal(coAdminAccess.canAccessFinances, true);
    assert.equal(coAdminAccess.canAccessFamily, true);
    assert.equal(coAdminAccess.canAccessSocial, true);

    const familyAccess = await getWeddingAccess(wedding.id, closeFamilyUser.id);
    assert.equal(familyAccess.detailedRole, "close_family");
    assert.equal(familyAccess.canManage, false);
    assert.equal(familyAccess.canAccessFinances, false);
    assert.equal(familyAccess.canAccessFamily, true);
    assert.equal(familyAccess.canAccessSocial, true);

    // Co-Admin cannot invite another Co-Admin, but CAN invite Close Family
    await assert.rejects(
      inviteEventMember({
        weddingId: wedding.id,
        actorUserId: coAdmin.id,
        name: "Attempted CoAdmin",
        email: "attempt@example.com",
        role: "co_admin",
      }),
      /Only the event owner/
    );
    const coAdminAddedFamily = await inviteEventMember({
      weddingId: wedding.id,
      actorUserId: coAdmin.id,
      name: "Sunita Auntie",
      email: "sunita@example.com",
      role: "close_family",
    });
    assert.equal(coAdminAddedFamily.activatedImmediately, false);

    const teamState = await listEventTeam(wedding.id, owner.id);
    assert.equal(teamState.members.length, 3); // owner + coAdmin + closeFamilyUser
    assert.equal(teamState.invites.length, 1); // Sunita Auntie still pending

    // 4. Guest list groups, party sizes, Invited vs Remaining & RSVP planned dates + privacy
    const addedGuests = await addGuestsToWedding({
      weddingId: wedding.id,
      ownerUserId: coAdmin.id,
      source: "manual",
      candidates: [
        {
          name: "Rohan Mehta",
          email: "rohan@example.com",
          phone: "+919822222222",
          guestGroup: "friends",
          partySize: 2,
        },
        {
          name: "Ananya Kapoor",
          email: "ananya@example.com",
          phone: "+919855555555",
          guestGroup: "bride_side",
          partySize: 3,
        },
        {
          name: "Pending Relative",
          phone: "+919844444444",
          guestGroup: "groom_side",
          partySize: 4,
        },
      ],
    });
    assert.equal(addedGuests.added.length, 3);
    assert.equal(addedGuests.added[0].guestGroup, "friends");
    assert.equal(addedGuests.added[0].partySize, 2);
    assert.equal(addedGuests.added[0].invitationStatus, "not_shared");

    // Rohan confirms RSVP with public planned dates (sharePlannedDates: true)
    const rohanRsvp = await submitGuestRsvp({
      weddingSlugOrId: wedding.slug,
      inviteToken: addedGuests.added[0].inviteToken,
      name: "Rohan Mehta",
      email: "rohan@example.com",
      phone: "+919822222222",
      rsvpStatus: "yes",
      partySize: 2,
      plannedArrival: "2026-12-09",
      plannedDeparture: "2026-12-13",
      sharePlannedDates: true,
      authenticatedUserId: guestUser.id,
    });
    assert.equal(rohanRsvp.guest.partySize, 2);
    assert.equal(rohanRsvp.guest.sharePlannedDates, true);
    assert.ok(rohanRsvp.guest.plannedArrival);

    // Ananya confirms RSVP with PRIVATE planned dates (sharePlannedDates: false)
    const ananyaRsvp = await submitGuestRsvp({
      weddingSlugOrId: wedding.slug,
      inviteToken: addedGuests.added[1].inviteToken,
      name: "Ananya Kapoor",
      email: "ananya@example.com",
      phone: "+919855555555",
      rsvpStatus: "yes",
      partySize: 3,
      plannedArrival: "2026-12-10",
      plannedDeparture: "2026-12-12",
      sharePlannedDates: false,
      authenticatedUserId: guestUserTwo.id,
    });
    assert.equal(ananyaRsvp.guest.sharePlannedDates, false);

    // Server-side RBAC checks for regular guest vs outsider
    const rohanAccess = await getWeddingAccess(wedding.id, guestUser.id);
    assert.equal(rohanAccess.detailedRole, "guest");
    assert.equal(rohanAccess.canAccessSocial, true);
    assert.equal(rohanAccess.canAccessFamily, false);
    assert.equal(rohanAccess.canAccessFinances, false);

    await assert.rejects(
      getSocialHubData(wedding.slug, outsider.id),
      /Access denied/
    );
    await assert.rejects(
      getFamilyRoomData(wedding.slug, guestUser.id),
      /Access denied/
    );
    await assert.rejects(
      getBudgetData(wedding.id, guestUser.id),
      /Forbidden/
    );
    await assert.rejects(
      getBudgetData(wedding.id, closeFamilyUser.id),
      /Forbidden/
    );

    // 5. Celebration Social Page: planned-date privacy, posts, comments, reactions, shared photos
    const socialAsRohan = await getSocialHubData(wedding.slug, guestUser.id);
    assert.equal(socialAsRohan.stats.confirmedCount, 2);
    assert.equal(socialAsRohan.stats.confirmedHeadcount, 5);
    assert.equal(socialAsRohan.stats.sharedDatesCount, 1);

    const ananyaRowForRohan = socialAsRohan.attendees.find(
      (a) => a.name === "Ananya Kapoor"
    );
    assert.equal(ananyaRowForRohan.plannedArrival, null); // hidden from other guests!
    assert.equal(ananyaRowForRohan.plannedDeparture, null);

    const socialAsAnanya = await getSocialHubData(
      wedding.slug,
      guestUserTwo.id
    );
    const ananyaOwnRow = socialAsAnanya.attendees.find(
      (a) => a.name === "Ananya Kapoor"
    );
    assert.ok(ananyaOwnRow.plannedArrival); // visible to Ananya herself!

    const socialAsOwner = await getSocialHubData(wedding.slug, owner.id);
    const ananyaRowForOwner = socialAsOwner.attendees.find(
      (a) => a.name === "Ananya Kapoor"
    );
    assert.ok(ananyaRowForOwner.plannedArrival); // visible to organizers!

    const post = await createSocialPost({
      weddingIdOrSlug: wedding.slug,
      authorUserId: guestUser.id,
      space: "social",
      kind: "wish",
      content: "So excited for Jaipur Haldi & Sangeet! Flying in on Dec 9th!",
    });
    await addSocialComment({
      weddingIdOrSlug: wedding.slug,
      postId: post.id,
      authorUserId: closeFamilyUser.id,
      content: "Airport pickup shuttle will be ready for you!",
    });
    await toggleSocialReaction({
      weddingIdOrSlug: wedding.slug,
      postId: post.id,
      userId: owner.id,
      emoji: "party",
    });
    // Regular guest cannot post into Close Family space
    await assert.rejects(
      createSocialPost({
        weddingIdOrSlug: wedding.slug,
        authorUserId: guestUser.id,
        space: "family",
        content: "Trying to sneak in",
      }),
      /Forbidden/
    );

    // Create a mock photo asset & link to SharedPhoto album
    const photoAsset = await prisma.eventAsset.create({
      data: {
        weddingId: wedding.id,
        name: "haldi-dance.jpg",
        mime: "image/jpeg",
        scope: "photo",
        data: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      },
    });
    const sharedPhoto = await createSharedPhoto({
      weddingIdOrSlug: wedding.slug,
      uploaderUserId: guestUser.id,
      mediaAssetId: photoAsset.id,
      albumName: "Haldi",
      caption: "Marigold shower!",
    });
    assert.equal(sharedPhoto.albumName, "Haldi");

    const socialAfter = await getSocialHubData(wedding.slug, owner.id);
    assert.equal(socialAfter.posts.length, 1);
    assert.equal(socialAfter.posts[0].comments.length, 1);
    assert.equal(socialAfter.posts[0].reactions.party, 1);
    assert.equal(socialAfter.photos.length, 1);

    // 6. Close Family Room: polls, single-choice switch, multi-choice, close, tasks
    await createFamilyPoll({
      weddingIdOrSlug: wedding.slug,
      creatorUserId: closeFamilyUser.id,
      question: "Which menu for Sangeet dinner?",
      category: "catering",
      allowMultiple: false,
      options: ["Rajasthani Royal Thali", "Awadhi + Live Chaat"],
    });
    let familyData = await getFamilyRoomData(wedding.slug, closeFamilyUser.id);
    assert.equal(familyData.polls.length, 1);
    const poll = familyData.polls[0];

    // Vote option 0, then switch to option 1 (single-select replaces previous vote)
    await toggleFamilyPollVote({
      weddingIdOrSlug: wedding.slug,
      pollId: poll.id,
      optionId: poll.options[0].id,
      userId: closeFamilyUser.id,
    });
    await toggleFamilyPollVote({
      weddingIdOrSlug: wedding.slug,
      pollId: poll.id,
      optionId: poll.options[1].id,
      userId: closeFamilyUser.id,
    });
    await toggleFamilyPollVote({
      weddingIdOrSlug: wedding.slug,
      pollId: poll.id,
      optionId: poll.options[1].id,
      userId: coAdmin.id,
    });
    familyData = await getFamilyRoomData(wedding.slug, owner.id);
    assert.equal(familyData.polls[0].options[0].voteCount, 0);
    assert.equal(familyData.polls[0].options[1].voteCount, 2);
    assert.equal(familyData.polls[0].totalVoters, 2);

    // Close poll -> further votes rejected
    await setFamilyPollClosed({
      weddingIdOrSlug: wedding.slug,
      pollId: poll.id,
      actorUserId: owner.id,
      isClosed: true,
    });
    await assert.rejects(
      toggleFamilyPollVote({
        weddingIdOrSlug: wedding.slug,
        pollId: poll.id,
        optionId: poll.options[0].id,
        userId: owner.id,
      }),
      /closed/
    );

    // Family task checklist
    await createFamilyTask({
      weddingIdOrSlug: wedding.slug,
      creatorUserId: closeFamilyUser.id,
      title: "Book vintage car for Baraat entry",
      assigneeName: "Neha",
      category: "transport",
    });
    familyData = await getFamilyRoomData(wedding.slug, coAdmin.id);
    assert.equal(familyData.tasks.length, 1);
    await updateFamilyTask({
      weddingIdOrSlug: wedding.slug,
      taskId: familyData.tasks[0].id,
      actorUserId: coAdmin.id,
      status: "done",
    });
    familyData = await getFamilyRoomData(wedding.slug, owner.id);
    assert.equal(familyData.tasks[0].status, "done");

    // 7. Organizer Suite: INR Budget & Vendor Bookings (Owner + Co-Admin)
    const b1 = await createBudgetItem({
      weddingId: wedding.id,
      userId: coAdmin.id,
      category: "venue",
      title: "Rambagh Lawn + 25 Rooms",
      estimatedAmount: 1500000,
      actualAmount: 1600000,
      paidAmount: 600000,
      paidBy: "Groom's Family",
    });
    const b2 = await createBudgetItem({
      weddingId: wedding.id,
      userId: owner.id,
      category: "decor",
      title: "Haldi Marigold & Sangeet Stage",
      estimatedAmount: 400000,
      actualAmount: 400000,
      paidAmount: 400000,
      paidBy: "Bride's Family",
    });
    assert.equal(b1.paymentStatus, "partial");
    assert.equal(b2.paymentStatus, "paid");

    await updateBudgetItem({
      weddingId: wedding.id,
      itemId: b1.id,
      userId: owner.id,
      paidAmount: 900000,
    });

    const budget = await getBudgetData(wedding.id, coAdmin.id);
    assert.equal(budget.summary.totalEstimated, 1900000);
    assert.equal(budget.summary.totalActual, 2000000);
    assert.equal(budget.summary.totalPaid, 1300000);
    assert.equal(budget.summary.totalPending, 700000);
    assert.equal(budget.summary.byContributor.length, 2);

    const booking = await createVendorBooking({
      weddingId: wedding.id,
      userId: coAdmin.id,
      category: "photography",
      vendorName: "Royal Frames Studio",
      contactName: "Vikram",
      contactPhone: "+91 98100 12345",
      status: "advance_paid",
      totalAmount: 350000,
      advancePaid: 100000,
      eventDay: "All 3 Days",
    });
    assert.equal(booking.totalAmount - booking.advancePaid, 250000);

    const bookingsMid = await getVendorBookings(wedding.id, coAdmin.id);
    assert.equal(bookingsMid.summary.totalContracted, 350000);
    assert.equal(bookingsMid.summary.totalAdvancePaid, 100000);
    assert.equal(bookingsMid.summary.totalBalanceDue, 250000);

    await updateVendorBooking({
      weddingId: wedding.id,
      bookingId: booking.id,
      userId: owner.id,
      advancePaid: 350000,
      status: "fully_paid",
    });
    const bookings = await getVendorBookings(wedding.id, owner.id);
    assert.equal(bookings.summary.totalContracted, 350000);
    assert.equal(bookings.summary.totalAdvancePaid, 350000);
    assert.equal(bookings.summary.totalBalanceDue, 0);
    assert.equal(bookings.summary.confirmedCount, 1);

    // Role promotion & revocation check
    await updateMemberRole({
      weddingId: wedding.id,
      actorUserId: owner.id,
      targetUserId: closeFamilyUser.id,
      role: "co_admin",
    });
    const promotedAccess = await getWeddingAccess(
      wedding.id,
      closeFamilyUser.id
    );
    assert.equal(promotedAccess.detailedRole, "co_admin");
    assert.equal(promotedAccess.canAccessFinances, true);

    await revokeMemberOrInvite({
      weddingId: wedding.id,
      actorUserId: owner.id,
      targetUserId: closeFamilyUser.id,
    });
    const revokedAccess = await getWeddingAccess(
      wedding.id,
      closeFamilyUser.id
    );
    assert.equal(revokedAccess.canAccessFamily, false);
    assert.equal(revokedAccess.canAccessFinances, false);

    // Contact imports validate the entire batch and accept name + mobile without email.
    const importInput = {weddingId:wedding.id, ownerUserId:owner.id, source:"contact_picker"};
    const countBeforeImport = await prisma.guest.count({where:{weddingId:wedding.id}});
    await assert.rejects(addGuestsToWedding({...importInput,candidates:[{name:"Valid first",phone:"9876543210"},{name:"Email only",email:"optional@example.com"}]}),/valid mobile/);
    assert.equal(await prisma.guest.count({where:{weddingId:wedding.id}}),countBeforeImport);
    await assert.rejects(addGuestsToWedding({...importInput,candidates:[{name:"",phone:"9876543210"}]}),/Name is required/);
    const imported = await addGuestsToWedding({...importInput,candidates:[{name:"Phone-only contact",phone:"98765 43210"}],skipDuplicates:true});
    assert.equal(imported.added.length,1);
    assert.equal(imported.added[0].phone,"+919876543210");
    assert.equal(imported.added[0].email,null);
    assert.equal(imported.added[0].invitationStatus,"not_shared");
    const repeated = await addGuestsToWedding({...importInput,candidates:[{name:"Same contact",phone:"+919876543210"}],skipDuplicates:true});
    assert.equal(repeated.added.length,0);
    assert.equal(repeated.duplicatesFlagged.length,1);

    console.log("Memorica platform tests passed (RBAC, invites, planned dates privacy, social, family polls, INR finance & bookings)");
  } finally {
    await prisma.$disconnect();
    cleanupDb();
  }
})().catch((err) => {
  console.error(err);
  cleanupDb();
  process.exit(1);
});
