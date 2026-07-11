import { AccessToken, RoomServiceClient, EgressClient, EncodedFileOutput, S3Upload } from "livekit-server-sdk";

const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;

// The server SDK talks over HTTP, but LIVEKIT_URL is a ws:// URL (for browser clients).
// So we derive the HTTP equivalent here instead of needing a second env var.
const LIVEKIT_HTTP_URL = LIVEKIT_URL.replace(/^ws/, "http");

export const roomService = new RoomServiceClient(
  LIVEKIT_HTTP_URL,
  LIVEKIT_API_KEY,
  LIVEKIT_API_SECRET
); 

export const egressService = new EgressClient(LIVEKIT_HTTP_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

/**
 * Mints a signed join token for one participant.
 * @param {object} opts
 * @param {string} opts.roomCode - the meeting code, used as the LiveKit room name
 * @param {string} opts.identity - unique id for this participant (user id or a generated anon id)
 * @param {string} opts.name - display name shown in the UI
 * @param {"host"|"cohost"|"participant"} opts.role
 */
export async function createJoinToken({ roomCode, identity, name, role }) {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    name,
    ttl: "10h",
  });

  const isHost = role === "host" || role === "cohost";

  at.addGrant({
    room: roomCode,
    roomJoin: true,
    canPublish: true,      // can send their own audio/video
    canSubscribe: true,    // can receive others' audio/video
    canPublishData: true,  // chat, reactions, etc. over LiveKit's data channel
    roomAdmin: isHost,     // needed for host controls (mute others, remove, etc.)
    roomRecord: isHost,
  });

  return at.toJwt();
}

/** Explicitly creates the LiveKit room ahead of time (optional — LiveKit can also auto-create). */
export async function ensureRoomExists(roomCode) {
  try {
    await roomService.createRoom({
      name: roomCode,
      emptyTimeout: 300,     // close room 5 min after everyone leaves
      departureTimeout: 20,
    });
  } catch (err) {
    // Ignore "already exists" - anything else should bubble up.
    if (!String(err.message).toLowerCase().includes("already exists")) {
      throw err;
    }
  }
}

export async function removeParticipant(roomCode, identity) {
  return roomService.removeParticipant(roomCode, identity);
}

export async function muteParticipant(roomCode, identity, trackSid) {
  return roomService.mutePublishedTrack(roomCode, identity, trackSid, true);
} 


export async function deleteRoom(roomCode) {
  return roomService.deleteRoom(roomCode);
} 


/**
 * Tells LiveKit Cloud to start recording the room and upload the
 * result directly to our Supabase Storage bucket (S3-compatible).
 * Returns the egressId (needed to stop it later) and the filepath
 * we chose, so we can find the file again afterward.
 */
export async function startRecording(roomCode) {
  const filepath = `${roomCode}/${Date.now()}.mp4`;

  const fileOutput = new EncodedFileOutput({
    filepath,
    output: {
      case: "s3",
      value: new S3Upload({
        accessKey: process.env.SUPABASE_S3_ACCESS_KEY_ID,
        secret: process.env.SUPABASE_S3_SECRET_ACCESS_KEY,
        bucket: process.env.SUPABASE_S3_BUCKET,
        endpoint: process.env.SUPABASE_S3_ENDPOINT,
        region: process.env.SUPABASE_S3_REGION,
        forcePathStyle: true, // required for non-AWS S3-compatible services
      }),
    },
  });

  const info = await egressService.startRoomCompositeEgress(roomCode, { file: fileOutput });
  return { egressId: info.egressId, filepath };
}

/** Tells LiveKit to stop recording and finalize the upload. */
export async function stopRecording(egressId) {
  return egressService.stopEgress(egressId);
}