import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Sparkles,
  DoorOpen,
  ScreenShare,
  MessageSquareText,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../lib/api.js";
import meetingBoardroom from "../assets/meeting-boardroom.jpg";
import dualMonitor from "../assets/dual-monitor.jpg";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Portal tiles, not a grid",
    desc: "Rounded, glowing video tiles that highlight whoever's speaking — calls that feel warm, not clinical.",
  },
  {
    icon: MessageSquareText,
    title: "AI notes, automatically",
    desc: "Every meeting gets a transcript, a summary, and action items — no one has to take notes by hand.",
  },
  {
    icon: DoorOpen,
    title: "Knock to join",
    desc: "Guests can join with just a name — no account needed — and the host approves who gets in.",
  },
  {
    icon: ScreenShare,
    title: "Share, react, present",
    desc: "Screen share, live reactions, and hand-raise built in, without digging through menus.",
  },
];

function PortalIllustration() {
  return (
    <svg
      viewBox="0 0 420 300"
      className="w-full max-w-md mx-auto"
      role="img"
      aria-label="Three people on a video call in portal-style tiles"
    >
      {/* Tile 1 */}
      <rect
        x="20"
        y="40"
        width="115"
        height="220"
        rx="28"
        fill="#FFFFFF"
        stroke="#FF6B4A"
        strokeWidth="2"
      />
      <circle cx="77" cy="115" r="30" fill="#FFE4DB" />
      <circle cx="77" cy="105" r="16" fill="#FF6B4A" />
      <path
        d="M47 165 Q77 135 107 165 L107 175 Q77 150 47 175 Z"
        fill="#FF6B4A"
      />
      <circle cx="106" cy="222" r="6" fill="#3DDC97" />

      {/* Tile 2 (center, slightly taller = "speaking") */}
      <rect
        x="152"
        y="20"
        width="115"
        height="260"
        rx="28"
        fill="#FFFFFF"
        stroke="#3DDC97"
        strokeWidth="2.5"
      />
      <circle cx="209" cy="105" r="32" fill="#DDF7EA" />
      <circle cx="209" cy="94" r="17" fill="#3DDC97" />
      <path
        d="M177 158 Q209 126 241 158 L241 169 Q209 141 177 169 Z"
        fill="#3DDC97"
      />
      <circle cx="238" cy="242" r="6" fill="#3DDC97" />
      {/* speaking glow ring */}
      <rect
        x="152"
        y="20"
        width="115"
        height="260"
        rx="28"
        fill="none"
        stroke="#3DDC97"
        strokeOpacity="0.3"
        strokeWidth="8"
      />

      {/* Tile 3 */}
      <rect
        x="284"
        y="40"
        width="115"
        height="220"
        rx="28"
        fill="#FFFFFF"
        stroke="#FF6B4A"
        strokeWidth="2"
      />
      <circle cx="341" cy="115" r="30" fill="#FFE4DB" />
      <circle cx="341" cy="105" r="16" fill="#FF6B4A" />
      <path
        d="M311 165 Q341 135 371 165 L371 175 Q341 150 311 175 Z"
        fill="#FF6B4A"
      />
      <circle cx="370" cy="222" r="6" fill="#94A3B8" />
    </svg>
  );
}
export default function Landing() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [meetingTitle, setMeetingTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleCreateMeeting() {
    setError("");
    setCreating(true);
    try {
      const res = await api.post("/rooms", { title: meetingTitle.trim() });
      navigate(`/join/${res.data.meeting.code}`);
    } catch (err) {
      setError(err.response?.data?.error || "Could not create meeting");
    } finally {
      setCreating(false);
    }
  }

  function handleJoin(e) {
    e.preventDefault();
    const code = joinCode.trim().toLowerCase();
    if (!code) return;
    navigate(`/join/${code}`);
  }

  if (loading) return null;

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans">
      <header className="flex items-center justify-between px-8 py-6">
        <h1 className="font-display text-2xl font-semibold">anymeet</h1>
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-muted text-sm">Hi, {user.name}</span>
              <button
                onClick={logout}
                className="text-sm text-muted hover:text-ink transition"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="text-sm text-muted hover:text-ink transition"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="text-sm bg-coral text-white px-4 py-2 rounded-full hover:opacity-90 transition"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero */}
      <main className="px-6 md:px-16 py-10 grid md:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
        <div>
          <h2 className="font-display text-4xl md:text-5xl font-semibold mb-4 leading-tight">
            Meetings that feel like a window, not a grid.
          </h2>
          <p className="text-muted mb-8 text-lg">
            Start an instant call or join one with a code — with AI notes and a
            UI that doesn't feel like work software.
          </p>

          {user ? (
            <>
              <input
                value={meetingTitle}
                onChange={(e) => setMeetingTitle(e.target.value)}
                placeholder="Meeting name (optional)"
                className="w-full bg-surface border border-surfaceHover rounded-portal px-4 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-coral"
              />
              <button
                onClick={handleCreateMeeting}
                disabled={creating}
                className="bg-coral text-white font-medium py-3 px-6 rounded-portal shadow-glow hover:opacity-90 transition disabled:opacity-60 mb-4"
              >
                {creating ? "Creating..." : "Start an instant meeting"}
              </button>
            </>
          ) : (
            <p className="text-sm text-muted mb-4">
              <Link to="/login" className="text-coral font-medium">
                Log in
              </Link>{" "}
              to start a meeting.
            </p>
          )}

          <form onSubmit={handleJoin} className="flex gap-2 max-w-md">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter a code (abc-defg-hjk)"
              className="flex-1 bg-surface border border-surfaceHover rounded-portal px-4 py-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-coral"
            />
            <button
              type="submit"
              className="bg-surface border border-surfaceHover px-5 rounded-portal font-medium hover:bg-surfaceHover transition"
            >
              Join
            </button>
          </form>

          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
        </div>

        <PortalIllustration />
      </main>

      {/* Features */}
      <section className="px-6 md:px-16 py-16 max-w-6xl mx-auto">
        <h3 className="font-display text-2xl font-semibold text-center mb-10">
          Built to feel different from a regular call
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="bg-surface border border-surfaceHover rounded-2xl p-6 hover:shadow-md transition"
            >
              <div className="w-11 h-11 rounded-xl bg-coral/10 flex items-center justify-center mb-4">
                <Icon size={22} className="text-coral" />
              </div>
              <h4 className="font-semibold mb-2">{title}</h4>
              <p className="text-sm text-muted leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Product showcase */}
      <section className="px-6 md:px-16 py-16 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-coral font-semibold mb-3">
            Product tour
          </p>
          <h3 className="font-display text-2xl md:text-3xl font-semibold mb-3">
            Built for polished calls, from boardroom to desktop.
          </h3>
          <p className="text-muted">
            These scenes show how anymeet stays clear, camera-friendly, and easy
            to follow whether the meeting is in a conference room or on a second
            screen.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-[2rem] overflow-hidden border border-surfaceHover bg-surface shadow-lg">
            <div className="p-5 md:p-6 flex items-start justify-between gap-4 border-b border-surfaceHover/70">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted mb-2">
                  Team room
                </p>
                <h4 className="font-semibold text-lg mb-1">
                  Conference-ready presence
                </h4>
                <p className="text-sm text-muted leading-relaxed">
                  A clean layout that keeps everyone visible and makes the room
                  feel active without visual clutter.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-coral/10 text-coral text-xs font-semibold px-3 py-1.5">
                Boardroom view
              </span>
            </div>
            <img
              src={meetingBoardroom}
              alt="A team in a conference room on an anymeet video call"
              className="w-full h-auto object-cover"
            />
          </article>

          <article className="rounded-[2rem] overflow-hidden border border-surfaceHover bg-surface shadow-lg">
            <div className="p-5 md:p-6 flex items-start justify-between gap-4 border-b border-surfaceHover/70">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted mb-2">
                  Dual display
                </p>
                <h4 className="font-semibold text-lg mb-1">
                  Made for multitasking
                </h4>
                <p className="text-sm text-muted leading-relaxed">
                  The interface stays readable across screens, so notes, tiles,
                  and controls feel organized instead of cramped.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-emerald-500/10 text-emerald-600 text-xs font-semibold px-3 py-1.5">
                Desktop view
              </span>
            </div>
            <img
              src={dualMonitor}
              alt="anymeet call interface shown on two monitors"
              className="w-full h-auto object-cover"
            />
          </article>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-surfaceHover bg-white/70 p-4">
            <p className="font-semibold mb-1">Clear hierarchy</p>
            <p className="text-sm text-muted">
              The most important speakers and surfaces stay easy to scan at a
              glance.
            </p>
          </div>
          <div className="rounded-2xl border border-surfaceHover bg-white/70 p-4">
            <p className="font-semibold mb-1">Room-friendly design</p>
            <p className="text-sm text-muted">
              Layouts feel composed on a projector, laptop, or shared monitor.
            </p>
          </div>
          <div className="rounded-2xl border border-surfaceHover bg-white/70 p-4">
            <p className="font-semibold mb-1">Professional tone</p>
            <p className="text-sm text-muted">
              Visual labels and concise copy make the showcase feel intentional
              and finished.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
