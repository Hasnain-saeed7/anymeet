import { Router } from "express";
import { customAlphabet } from "nanoid";
import { prisma } from "../lib/prisma.js";
import { requireAuth, optionalAuth } from "../lib/auth.js";
import {
  createJoinToken,
  ensureRoomExists,
  removeParticipant,
  muteParticipant,
  deleteRoom,
  startRecording,
  stopRecording,
} from "../lib/livekit.js";
import { downloadRecording } from "../lib/supabaseStorage.js";
import { transcribeAudio, generateMeetingNotes } from "../lib/transcription.js";

const router = Router();
const activeRecordings = new Map(); // roomCode -> { egressId, filepath }

// Lowercase letters only, no ambiguous chars - gives us codes like "abc-defg-hjk"
const nanoid = customAlphabet("abcdefghjkmnpqrstuvwxyz", 8);
function generateRoomCode() {
  const raw = nanoid(); // 8 random chars
  return `${raw.slice(0, 3)}-${raw.slice(3, 7)}-${raw.slice(7, 8)}${nanoid().slice(0, 2)}`;
}

// ---- Create a meeting (must be logged in) ----
router.post("/", requireAuth, async (req, res) => {
  const title = (req.body?.title || "").trim() || "Untitled meeting";
  const code = generateRoomCode();

  const meeting = await prisma.meeting.create({
    data: { code, title, hostId: req.user.id },
  });

  await ensureRoomExists(code);

  res.status(201).json({ meeting });
});

// ---- Get basic meeting info (for the pre-join / "knock" screen) ----
router.get("/:code", optionalAuth, async (req, res) => {
  const meeting = await prisma.meeting.findUnique({
    where: { code: req.params.code },
    include: { host: { select: { id: true, name: true } } },
  });

  if (!meeting || meeting.endedAt) {
    return res.status(404).json({ error: "Meeting not found or has ended" });
  }

  res.json({
    title: meeting.title,
    hostName: meeting.host.name,
    locked: meeting.locked,
  });
});

// ---- Join a meeting (logged-in users AND anonymous guests) ----
router.post("/:code/join", optionalAuth, async (req, res) => {
  const { code } = req.params;
  const displayName = (req.body?.displayName || req.user?.name || "").trim();

  if (!displayName) {
    return res.status(400).json({ error: "displayName is required" });
  }

  const meeting = await prisma.meeting.findUnique({ where: { code } });
  if (!meeting || meeting.endedAt) {
    return res.status(404).json({ error: "Meeting not found or has ended" });
  }

  const isHost = req.user && req.user.id === meeting.hostId;

  if (meeting.locked && !isHost) {
    return res
      .status(423)
      .json({ error: "This meeting is locked by the host" });
  }

  // Identity must be unique per participant in the LiveKit room.
  // Logged-in users use their real user id; guests get a random one.
  const identity = req.user
    ? req.user.id
    : `guest-${customAlphabet("1234567890abcdef", 10)()}`;
  const role = isHost ? "host" : "participant";
  const livekitDisplayName = isHost ? `${displayName} (Host)` : displayName;

  const participant = await prisma.participant.create({
    data: {
      meetingId: meeting.id,
      userId: req.user?.id ?? null,
      displayName,
      isAnonymous: !req.user,
      role,
    },
  });

  const livekitToken = await createJoinToken({
    roomCode: code,
    identity,
    name: livekitDisplayName,
    role,
  });

  res.json({
    livekitToken,
    livekitUrl: process.env.LIVEKIT_URL,
    participantId: participant.id,
    role,
  });
});

// ---- Host: lock the meeting so no one new can join ----
router.post("/:code/lock", requireAuth, async (req, res) => {
  const meeting = await prisma.meeting.findUnique({
    where: { code: req.params.code },
  });
  if (!meeting) return res.status(404).json({ error: "Meeting not found" });
  if (meeting.hostId !== req.user.id) {
    return res
      .status(403)
      .json({ error: "Only the host can lock this meeting" });
  }

  const updated = await prisma.meeting.update({
    where: { code: req.params.code },
    data: { locked: !meeting.locked },
  });

  res.json({ locked: updated.locked });
});

// ---- Host: end the meeting for everyone ----
router.post("/:code/end", requireAuth, async (req, res) => {
  const meeting = await prisma.meeting.findUnique({
    where: { code: req.params.code },
  });
  if (!meeting) return res.status(404).json({ error: "Meeting not found" });
  if (meeting.hostId !== req.user.id) {
    return res
      .status(403)
      .json({ error: "Only the host can end this meeting" });
  }

  await prisma.meeting.update({
    where: { code: req.params.code },
    data: { endedAt: new Date() },
  });
  await deleteRoom(req.params.code);
  res.json({ ended: true });
});

// ---- Host: start recording ----
router.post("/:code/record/start", requireAuth, async (req, res) => {
  const meeting = await prisma.meeting.findUnique({
    where: { code: req.params.code },
  });
  if (!meeting) return res.status(404).json({ error: "Meeting not found" });
  if (meeting.hostId !== req.user.id) {
    return res.status(403).json({ error: "Only the host can start recording" });
  }
  if (activeRecordings.has(req.params.code)) {
    return res.status(409).json({ error: "Recording already in progress" });
  }

  try {
    const { egressId, filepath } = await startRecording(req.params.code);
    activeRecordings.set(req.params.code, { egressId, filepath });
    res.json({ recording: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not start recording" });
  }
});

// ---- Host: stop recording ----
router.post("/:code/record/stop", requireAuth, async (req, res) => {
  const meeting = await prisma.meeting.findUnique({
    where: { code: req.params.code },
  });
  if (!meeting) return res.status(404).json({ error: "Meeting not found" });
  if (meeting.hostId !== req.user.id) {
    return res.status(403).json({ error: "Only the host can stop recording" });
  }

  const active = activeRecordings.get(req.params.code);
  if (!active) {
    return res.status(404).json({ error: "No recording in progress" });
  }

  try {
    await stopRecording(active.egressId);
    activeRecordings.delete(req.params.code);

    const recording = await prisma.recording.create({
      data: {
        meetingId: meeting.id,
        storageKey: active.filepath,
      },
    });

    // Respond right away - don't make the host wait for transcription.
    res.json({ recording });

    // Fire off transcription in the background. Not awaited on purpose.
    processTranscription(meeting.id, active.filepath).catch((err) => {
      console.error("Background transcription failed:", err);
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not stop recording" });
  }
});

/**
 * Runs after the HTTP response has already been sent. Downloads the
 * recording, transcribes it, generates notes, and saves a Transcript row.
 * LiveKit's egress can take a few seconds to fully finalize the upload,
 * so we wait briefly before attempting the download.
 */
async function processTranscription(meetingId, storageKey) {
  await new Promise((resolve) => setTimeout(resolve, 5000)); // let the upload settle

  const buffer = await downloadRecording(storageKey);
  const transcriptText = await transcribeAudio(buffer);
  const notes = await generateMeetingNotes(transcriptText);

  await prisma.transcript.create({
    data: {
      meetingId,
      fullText: transcriptText,
      summary: notes.summary,
      actionItems: notes.actionItems,
    },
  });

  console.log(`Transcript ready for meeting ${meetingId}`);
}

// ---- Get the latest transcript/notes for a meeting ----
router.get("/:code/notes", optionalAuth, async (req, res) => {
  const meeting = await prisma.meeting.findUnique({
    where: { code: req.params.code },
  });
  if (!meeting) return res.status(404).json({ error: "Meeting not found" });

  const transcript = await prisma.transcript.findFirst({
    where: { meetingId: meeting.id },
    orderBy: { createdAt: "desc" },
  });

  if (!transcript) {
    return res.status(404).json({ error: "Notes not ready yet" });
  }

  res.json({
    summary: transcript.summary,
    actionItems: transcript.actionItems,
    fullText: transcript.fullText,
    createdAt: transcript.createdAt,
  });
});

// ---- Check if this meeting has any recording (used to decide whether to prompt for notes) ----
router.get("/:code/recorded", optionalAuth, async (req, res) => {
  const meeting = await prisma.meeting.findUnique({
    where: { code: req.params.code },
  });
  if (!meeting) return res.status(404).json({ error: "Meeting not found" });

  const recording = await prisma.recording.findFirst({
    where: { meetingId: meeting.id },
  });
  res.json({ recorded: !!recording });
});

// ---- Host: remove a participant ----
router.post("/:code/remove/:identity", requireAuth, async (req, res) => {
  const meeting = await prisma.meeting.findUnique({
    where: { code: req.params.code },
  });
  if (!meeting) return res.status(404).json({ error: "Meeting not found" });
  if (meeting.hostId !== req.user.id) {
    return res
      .status(403)
      .json({ error: "Only the host can remove participants" });
  }

  await removeParticipant(req.params.code, req.params.identity);
  res.json({ removed: true });
});

// ---- Host: mute a participant's track ----
router.post(
  "/:code/mute/:identity/:trackSid",
  requireAuth,
  async (req, res) => {
    const meeting = await prisma.meeting.findUnique({
      where: { code: req.params.code },
    });
    if (!meeting) return res.status(404).json({ error: "Meeting not found" });
    if (meeting.hostId !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Only the host can mute participants" });
    }

    await muteParticipant(
      req.params.code,
      req.params.identity,
      req.params.trackSid
    );
    res.json({ muted: true });
  }
);

export default router;
