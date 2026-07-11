import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../lib/api.js";

export default function PreJoin() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [meetingInfo, setMeetingInfo] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [displayName, setDisplayName] = useState(user?.name || "");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  // Fetch basic meeting info (title, host, locked status) so we can show
  // something meaningful before the user even touches camera/mic.
  useEffect(() => {
    async function fetchMeeting() {
      try {
        const res = await api.get(`/rooms/${code}`);
        setMeetingInfo(res.data);
      } catch (err) {
        setLoadError(err.response?.data?.error || "Meeting not found");
      }
    }
    fetchMeeting();
  }, [code]);

  // Start the camera/mic preview on mount, stop all tracks on unmount so the
  // browser's camera light turns off if the user navigates away.
  useEffect(() => {
    async function startPreview() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        setCamOn(false);
        setMicOn(false);
      }
    }
    startPreview();

    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  function toggleMic() {
    const audioTrack = streamRef.current?.getAudioTracks()?.[0];
    if (audioTrack) audioTrack.enabled = !micOn;
    setMicOn(!micOn);
  }

  function toggleCam() {
    const videoTrack = streamRef.current?.getVideoTracks()?.[0];
    if (videoTrack) videoTrack.enabled = !camOn;
    setCamOn(!camOn);
  }

  async function handleJoin(e) {
    e.preventDefault();
    setJoinError("");
    if (!displayName.trim()) {
      setJoinError("Please enter your name");
      return;
    }
    setJoining(true);
    try {
      const res = await api.post(`/rooms/${code}/join`, {
        displayName: displayName.trim(),
      });
      // Stop the preview stream - the Room page will request its own via LiveKit.
      streamRef.current?.getTracks().forEach((track) => track.stop());
      navigate(`/room/${code}`, {
        state: {
          livekitToken: res.data.livekitToken,
          livekitUrl: res.data.livekitUrl,
          displayName: displayName.trim(),
          role: res.data.role,
          micOn,
          camOn,
        },
      });
    } catch (err) {
      setJoinError(err.response?.data?.error || "Could not join meeting");
      setJoining(false);
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-canvas text-ink font-sans flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <h2 className="font-display text-2xl font-semibold mb-2">Can't join this meeting</h2>
          <p className="text-muted mb-6">{loadError}</p>
          <Link to="/" className="text-coral font-medium">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans flex items-center justify-center px-6 py-10">
      <div className="max-w-3xl w-full grid md:grid-cols-2 gap-10 items-center">
        {/* Camera preview */}
        <div className="relative bg-surface border border-surfaceHover rounded-portal aspect-video overflow-hidden flex items-center justify-center">
          {camOn ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-coral/10 flex items-center justify-center">
              <VideoOff className="text-coral" size={28} />
            </div>
          )}

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
            <button
              onClick={toggleMic}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                micOn ? "bg-white text-ink" : "bg-ink text-white"
              }`}
            >
              {micOn ? <Mic size={18} /> : <MicOff size={18} />}
            </button>
            <button
              onClick={toggleCam}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition ${
                camOn ? "bg-white text-ink" : "bg-ink text-white"
              }`}
            >
              {camOn ? <Video size={18} /> : <VideoOff size={18} />}
            </button>
          </div>
        </div>

        {/* Join form */}
        <div>
          <h2 className="font-display text-2xl font-semibold mb-1">
            {meetingInfo?.title || "Joining meeting"}
          </h2>
          <p className="text-muted text-sm mb-6">
            Hosted by {meetingInfo?.hostName || "..."}
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Your name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                className="w-full bg-surface border border-surfaceHover rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral"
              />
            </div>

            {joinError && <p className="text-red-500 text-sm">{joinError}</p>}

            <button
              type="submit"
              disabled={joining}
              className="w-full bg-coral text-white font-medium py-3 rounded-portal shadow-glow hover:opacity-90 transition disabled:opacity-60"
            >
              {joining ? "Joining..." : "Join now"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}