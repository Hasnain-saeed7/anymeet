import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import api from "../lib/api.js";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  VideoTrack,
  useIsSpeaking,
  useLocalParticipant,
  useChat,
  useRoomContext,
  useParticipants,
  useDataChannel,
} from "@livekit/components-react";
import { Track } from "livekit-client";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  ScreenShare,
  PhoneOff,
  MessageSquare,
  Copy,
  Check,
  Send,
  Lock,
  LogOut,
  Users,
  Circle,
  Smile,
  Hand,
  Captions,
} from "lucide-react";

function useLiveCaptions(captionsEnabled) {
  const [captions, setCaptions] = useState({});
  const { localParticipant } = useLocalParticipant();
  const recognitionRef = useRef(null);
  const shouldListenRef = useRef(false);

  const handleMessage = useCallback((msg) => {
    try {
      const { identity, name, text } = JSON.parse(
        new TextDecoder().decode(msg.payload)
      );
      setCaptions((prev) => ({ ...prev, [identity]: { name, text } }));
    } catch (err) {
      console.error("Bad caption payload", err);
    }
  }, []);

  const { send } = useDataChannel("captions", handleMessage);

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!captionsEnabled || !SpeechRecognition) {
      shouldListenRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {
        // Already stopped - ignore.
      }
      return;
    }

    shouldListenRef.current = true;

    function safeStart() {
      if (!shouldListenRef.current) return;
      try {
        recognitionRef.current.start();
      } catch {
        // Already running or mid-transition - browser will settle, just skip this attempt.
      }
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      const text = result[0].transcript;

      setCaptions((prev) => ({
        ...prev,
        [localParticipant.identity]: { name: localParticipant.name, text },
      }));

      send(
        new TextEncoder().encode(
          JSON.stringify({
            identity: localParticipant.identity,
            name: localParticipant.name,
            text,
          })
        ),
        { reliable: false }
      );
    };

    // Restart on both natural end AND errors (e.g. "no-speech" after a pause).
    recognition.onend = () => {
      if (shouldListenRef.current) setTimeout(safeStart, 300);
    };
    recognition.onerror = (event) => {
      console.warn("Speech recognition error:", event.error);
      if (shouldListenRef.current) setTimeout(safeStart, 300);
    };

    recognitionRef.current = recognition;
    safeStart();

    return () => {
      shouldListenRef.current = false;
      try {
        recognition.stop();
      } catch {
        // Ignore.
      }
    };
  }, [captionsEnabled, localParticipant, send]);

  return captions;
}

function CaptionsBar({ captions }) {
  const activeCaptions = Object.values(captions).filter((c) => c.text?.trim());

  if (activeCaptions.length === 0) return null;

  return (
    <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-full px-4">
      <div className="bg-ink/85 text-white rounded-2xl px-5 py-3 space-y-1">
        {activeCaptions.map((c, i) => (
          <p key={i} className="text-sm">
            <span className="font-semibold text-coral">{c.name}: </span>
            {c.text}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function Room() {
  const { code } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const { livekitToken, livekitUrl, role } = location.state || {};

  if (!livekitToken || !livekitUrl) {
    navigate(`/join/${code}`, { replace: true });
    return null;
  }

  async function handleDisconnected() {
    try {
      const res = await api.get(`/rooms/${code}/recorded`);
      if (res.data.recorded) {
        const wantsNotes = confirm(
          "This meeting was recorded. Would you like to view the meeting notes?"
        );
        if (wantsNotes) {
          navigate(`/notes/${code}`);
          return;
        }
      }
    } catch {
      // If the check fails for any reason, just fall through to home.
    }
    navigate("/");
  }

  return (
    <LiveKitRoom
      token={livekitToken}
      serverUrl={livekitUrl}
      connect={true}
      video={true}
      audio={true}
      style={{ height: "100vh" }}
      onDisconnected={handleDisconnected}
    >
      <RoomAudioRenderer />
      <MeetingRoom code={code} isHost={role === "host"} />
    </LiveKitRoom>
  );
}

function useHandRaise() {
  const [raisedHands, setRaisedHands] = useState({}); // identity -> boolean
  const { localParticipant } = useLocalParticipant();

  const handleMessage = useCallback((msg) => {
    try {
      const { identity, raised } = JSON.parse(
        new TextDecoder().decode(msg.payload)
      );
      setRaisedHands((prev) => ({ ...prev, [identity]: raised }));
    } catch (err) {
      console.error("Bad hand-raise payload", err);
    }
  }, []); // stable reference - same reason as the reactions fix earlier

  const { send } = useDataChannel("hand-raise", handleMessage);

  const isOwnHandRaised = !!raisedHands[localParticipant.identity];

  function toggleHand() {
    const next = !isOwnHandRaised;

    // Update our own screen immediately - don't wait for a round-trip,
    // since LiveKit's data channel doesn't echo your own message back to you.
    setRaisedHands((prev) => ({ ...prev, [localParticipant.identity]: next }));

    send(
      new TextEncoder().encode(
        JSON.stringify({ identity: localParticipant.identity, raised: next })
      ),
      { reliable: true }
    );
  }

  return { raisedHands, isOwnHandRaised, toggleHand };
}

function MeetingRoom({ code, isHost }) {
  const [chatOpen, setChatOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);
  const { raisedHands, isOwnHandRaised, toggleHand } = useHandRaise();
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const captions = useLiveCaptions(captionsEnabled);

  async function handleToggleLock() {
    try {
      const res = await api.post(`/rooms/${code}/lock`);
      setLocked(res.data.locked);
    } catch (err) {
      alert(err.response?.data?.error || "Could not update lock");
    }
  }

  async function handleEndMeeting() {
    if (!confirm("End this meeting for everyone?")) return;
    try {
      await api.post(`/rooms/${code}/end`);
    } catch (err) {
      alert(err.response?.data?.error || "Could not end meeting");
    }
  }

  async function handleToggleRecording() {
    setRecordingBusy(true);
    try {
      if (recording) {
        await api.post(`/rooms/${code}/record/stop`);
        setRecording(false);
      } else {
        await api.post(`/rooms/${code}/record/start`);
        setRecording(true);
      }
    } catch (err) {
      alert(err.response?.data?.error || "Could not update recording");
    } finally {
      setRecordingBusy(false);
    }
  }

  function handleCopyCode() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="h-screen bg-canvas flex flex-col font-sans overflow-hidden">
      {/* Top bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-3 bg-surface border-b border-surfaceHover">
        <span className="font-display font-semibold text-lg sm:text-base">
          anymeet
        </span>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {isHost && (
            <>
              <button
                onClick={handleToggleLock}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:text-sm border transition ${
                  locked
                    ? "bg-coral text-white border-coral"
                    : "bg-canvas border-surfaceHover"
                }`}
              >
                <Lock size={14} />
                {locked ? "Locked" : "Lock"}
              </button>

              {isHost && (
                <>
                  <button
                    onClick={handleToggleRecording}
                    disabled={recordingBusy}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:text-sm border transition disabled:opacity-60 ${
                      recording
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-canvas border-surfaceHover"
                    }`}
                  >
                    <Circle
                      size={12}
                      className={recording ? "fill-white animate-pulse" : ""}
                    />
                    {recording ? "Recording" : "Record"}
                  </button>

                  <button
                    onClick={handleEndMeeting}
                    className="flex items-center gap-1.5 bg-red-500 text-white rounded-full px-3 py-1.5 text-xs sm:text-sm hover:bg-red-600 transition"
                  >
                    <LogOut size={14} />
                    End for all
                  </button>
                </>
              )}
            </>
          )}
          <button
            onClick={handleCopyCode}
            className="flex items-center gap-2 bg-canvas border border-surfaceHover rounded-full px-4 py-1.5 text-xs sm:text-sm font-mono hover:bg-surfaceHover transition"
          >
            {copied ? (
              <Check size={14} className="text-mint" />
            ) : (
              <Copy size={14} />
            )}
            {code}
          </button>
        </div>
      </div>

      {/* Main area: video stage + optional side panels */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative min-h-0">
        <Stage raisedHands={raisedHands} />
        <ReactionsLayer
          open={reactionsOpen}
          onClose={() => setReactionsOpen(false)}
        />

        <CaptionsBar captions={captions} />
        {participantsOpen && (
          <ParticipantsPanel
            isHost={isHost}
            code={code}
            onClose={() => setParticipantsOpen(false)}
          />
        )}
        {chatOpen && <ChatPanel onClose={() => setChatOpen(false)} />}
      </div>
      <ControlsBar
        chatOpen={chatOpen}
        onToggleChat={() => setChatOpen((v) => !v)}
        participantsOpen={participantsOpen}
        onToggleParticipants={() => setParticipantsOpen((v) => !v)}
        reactionsOpen={reactionsOpen}
        onToggleReactions={() => setReactionsOpen((v) => !v)}
        isHandRaised={isOwnHandRaised}
        onToggleHand={toggleHand}
        captionsEnabled={captionsEnabled}
        onToggleCaptions={() => setCaptionsEnabled((v) => !v)}
      />
    </div>
  );
}

function Stage({ raisedHands }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );

  const count = tracks.length || 1;
  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);

  return (
    <div
      className="flex-1 min-h-[42vh] md:min-h-0 p-3 sm:p-4 grid gap-3 sm:gap-4 overflow-hidden"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
      }}
    >
      {tracks.map((trackRef) => (
        <PortalTile
          key={trackRef.participant.identity + trackRef.source}
          trackRef={trackRef}
          isHandRaised={!!raisedHands[trackRef.participant.identity]}
        />
      ))}
    </div>
  );
}

function PortalTile({ trackRef, isHandRaised }) {
  const participant = trackRef.participant;
  const { localParticipant } = useLocalParticipant();
  const isYou = participant.identity === localParticipant.identity;
  const isSpeaking = useIsSpeaking(participant);
  const micOn = participant.isMicrophoneEnabled;
  const hasVideo = !!trackRef.publication && !trackRef.publication.isMuted;

  return (
    <div
      className={`relative rounded-portal overflow-hidden bg-surface border-2 h-full w-full transition-shadow ${
        isSpeaking ? "border-mint shadow-glowMint" : "border-surfaceHover"
      }`}
    >
      {hasVideo ? (
        <VideoTrack
          trackRef={trackRef}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-surfaceHover">
          <div className="w-16 h-16 rounded-full bg-coral/20 flex items-center justify-center text-coral font-display text-xl font-semibold">
            {participant.name?.[0]?.toUpperCase() || "?"}
          </div>
        </div>
      )}

      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-ink/70 text-white text-xs px-2.5 py-1 rounded-full">
        {!micOn && <MicOff size={12} />}
        <span>
          {participant.name || "Guest"}
          {isYou ? " (You)" : ""}
        </span>
      </div>
      {isHandRaised && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-coral rounded-full flex items-center justify-center">
          <Hand size={16} className="text-white" />
        </div>
      )}
    </div>
  );
}

function ChatPanel({ onClose }) {
  const { chatMessages, send, isSending } = useChat();
  const [text, setText] = useState("");

  function handleSend(e) {
    e.preventDefault();
    if (!text.trim()) return;
    send(text.trim());
    setText("");
  }

  return (
    <div className="w-full md:w-80 bg-surface border-t md:border-t-0 md:border-l border-surfaceHover flex flex-col max-h-[36vh] md:max-h-none md:h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surfaceHover">
        <h3 className="font-semibold text-sm">In-call messages</h3>
        <button onClick={onClose} className="text-muted hover:text-ink text-sm">
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {chatMessages.length === 0 && (
          <p className="text-muted text-sm text-center mt-6">No messages yet</p>
        )}
        {chatMessages.map((msg) => (
          <div key={msg.id} className="text-sm">
            <span className="font-medium text-coral">
              {msg.from?.name || "Guest"}:
            </span>{" "}
            <span>{msg.message}</span>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSend}
        className="p-3 border-t border-surfaceHover flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Send a message"
          className="flex-1 bg-canvas border border-surfaceHover rounded-full px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-coral"
        />
        <button
          type="submit"
          disabled={isSending}
          className="w-9 h-9 rounded-full bg-coral text-white flex items-center justify-center disabled:opacity-60"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

function ParticipantsPanel({ isHost, code, onClose }) {
  const participants = useParticipants();

  async function handleMute(identity, trackSid) {
    try {
      await api.post(`/rooms/${code}/mute/${identity}/${trackSid}`);
    } catch (err) {
      alert(err.response?.data?.error || "Could not mute participant");
    }
  }

  async function handleRemove(identity) {
    if (!confirm("Remove this participant from the meeting?")) return;
    try {
      await api.post(`/rooms/${code}/remove/${identity}`);
    } catch (err) {
      alert(err.response?.data?.error || "Could not remove participant");
    }
  }

  return (
    <div className="w-full md:w-80 bg-surface border-t md:border-t-0 md:border-l border-surfaceHover flex flex-col max-h-[36vh] md:max-h-none md:h-full min-h-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-surfaceHover">
        <h3 className="font-semibold text-sm">
          Participants ({participants.length})
        </h3>
        <button onClick={onClose} className="text-muted hover:text-ink text-sm">
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-0">
        {participants.map((p) => {
          const micTrack = p.getTrackPublication?.(Track.Source.Microphone);
          return (
            <div key={p.identity} className="flex items-center justify-between">
              <span className="text-sm">{p.name || "Guest"}</span>
              {isHost && !p.isLocal && (
                <div className="flex gap-2">
                  {micTrack && !micTrack.isMuted && (
                    <button
                      onClick={() => handleMute(p.identity, micTrack.trackSid)}
                      className="text-xs text-muted hover:text-coral"
                      title="Mute"
                    >
                      <MicOff size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleRemove(p.identity)}
                    className="text-xs text-red-500 hover:text-red-600"
                    title="Remove"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const REACTION_EMOJIS = ["👍", "❤️", "😂", "👏", "🎉"];

function ReactionsLayer({ open, onClose }) {
  const [floatingReactions, setFloatingReactions] = useState([]);

  const handleReaction = useCallback((msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload));
      const id = `${Date.now()}-${Math.random()}`;
      setFloatingReactions((prev) => [...prev, { id, ...payload }]);
      setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
      }, 2500);
    } catch (err) {
      console.error("Bad reaction payload", err);
    }
  }, []); // stable reference - fixes the re-subscribe bug

  const { send } = useDataChannel("reactions", handleReaction);

  function sendReaction(emoji) {
    // Send to other participants
    send(new TextEncoder().encode(JSON.stringify({ emoji })), {
      reliable: true,
    });

    // Show reaction locally immediately
    const id = `${Date.now()}-${Math.random()}`;
    setFloatingReactions((prev) => [...prev, { id, emoji }]);
    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2500);

    onClose();
  }

  return (
    <>
      {/* Floating emoji animations - covers the whole screen, never blocks clicks */}
      <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {floatingReactions.map((r) => (
          <span
            key={r.id}
            className="absolute text-4xl bottom-28 animate-float-up"
            style={{ left: `${20 + Math.random() * 60}%` }}
          >
            {r.emoji}
          </span>
        ))}
      </div>

      {/* Popover box - only visible when toggled on, sits right above the control bar */}
      {open && (
        <div className="fixed bottom-24 sm:bottom-20 left-1/2 -translate-x-1/2 z-50 flex gap-1 bg-surface border border-surfaceHover rounded-full px-3 py-2 shadow-lg max-w-[calc(100vw-1.5rem)] overflow-x-auto">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="text-2xl hover:scale-125 transition-transform px-1"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
function ControlsBar({
  chatOpen,
  onToggleChat,
  participantsOpen,
  onToggleParticipants,
  reactionsOpen,
  onToggleReactions,
  isHandRaised,
  onToggleHand,
  captionsEnabled,
  onToggleCaptions,
}) {
  const room = useRoomContext();
  const {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
  } = useLocalParticipant();

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 px-3 py-3 bg-surface border-t border-surfaceHover">
      <button
        onClick={() =>
          localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
        }
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition ${
          isMicrophoneEnabled ? "bg-canvas text-ink" : "bg-ink text-white"
        }`}
      >
        {isMicrophoneEnabled ? <Mic size={17} /> : <MicOff size={17} />}
      </button>

      <button
        onClick={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition ${
          isCameraEnabled ? "bg-canvas text-ink" : "bg-ink text-white"
        }`}
      >
        {isCameraEnabled ? <Video size={17} /> : <VideoOff size={17} />}
      </button>

      <button
        onClick={() =>
          localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
        }
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition ${
          isScreenShareEnabled ? "bg-mint text-white" : "bg-canvas text-ink"
        }`}
      >
        <ScreenShare size={17} />
      </button>

      <button
        onClick={onToggleHand}
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition ${
          isHandRaised ? "bg-coral text-white" : "bg-canvas text-ink"
        }`}
      >
        <Hand size={17} />
      </button>

      <button
        onClick={onToggleCaptions}
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition ${
          captionsEnabled ? "bg-coral text-white" : "bg-canvas text-ink"
        }`}
      >
        <Captions size={17} />
      </button>

      <button
        onClick={onToggleReactions}
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition ${
          reactionsOpen ? "bg-coral text-white" : "bg-canvas text-ink"
        }`}
      >
        <Smile size={17} />
      </button>

      <button
        onClick={onToggleParticipants}
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition ${
          participantsOpen ? "bg-coral text-white" : "bg-canvas text-ink"
        }`}
      >
        <Users size={17} />
      </button>

      <button
        onClick={onToggleChat}
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition ${
          chatOpen ? "bg-coral text-white" : "bg-canvas text-ink"
        }`}
      >
        <MessageSquare size={17} />
      </button>

      <button
        onClick={() => room.disconnect()}
        className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition ml-0 sm:ml-2"
      >
        <PhoneOff size={17} />
      </button>
    </div>
  );
}
