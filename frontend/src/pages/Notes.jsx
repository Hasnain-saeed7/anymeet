import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Sparkles, CheckSquare, FileText } from "lucide-react";
import api from "../lib/api.js";

const POLL_INTERVAL_MS = 4000;
const MAX_POLL_ATTEMPTS = 30; // ~2 minutes before giving up

export default function Notes() {
  const { code } = useParams();
  const [notes, setNotes] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | none | timeout
  const attemptsRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function poll() {
      try {
        const res = await api.get(`/rooms/${code}/notes`);
        if (!cancelled) {
          setNotes(res.data);
          setStatus("ready");
        }
      } catch (err) {
        if (cancelled) return;

        if (err.response?.status === 404) {
          attemptsRef.current += 1;
          if (attemptsRef.current >= MAX_POLL_ATTEMPTS) {
            setStatus("timeout");
          } else {
            setStatus("loading");
            timer = setTimeout(poll, POLL_INTERVAL_MS);
          }
        } else {
          setStatus("none");
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code]);

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans px-6 py-10">
      <div className="max-w-2xl mx-auto">
        <Link to="/" className="font-display text-xl font-semibold block mb-8">
          anymeet
        </Link>

        {status === "loading" && (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-coral mx-auto mb-4" />
            <p className="text-muted">Generating your meeting notes...</p>
          </div>
        )}

        {status === "timeout" && (
          <div className="text-center py-20">
            <p className="text-muted mb-4">
              Notes are taking longer than expected. This meeting may not have been recorded.
            </p>
            <Link to="/" className="text-coral font-medium">Back to home</Link>
          </div>
        )}

        {status === "none" && (
          <div className="text-center py-20">
            <p className="text-muted mb-4">No notes available for this meeting.</p>
            <Link to="/" className="text-coral font-medium">Back to home</Link>
          </div>
        )}

        {status === "ready" && notes && (
          <div className="space-y-6">
            <div>
              <h1 className="font-display text-3xl font-semibold mb-1">Meeting notes</h1>
              <p className="text-muted text-sm">
                {new Date(notes.createdAt).toLocaleString()}
              </p>
            </div>

            <div className="bg-surface border border-surfaceHover rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={18} className="text-coral" />
                <h2 className="font-semibold">Summary</h2>
              </div>
              <p className="text-sm leading-relaxed">{notes.summary}</p>
            </div>

            {notes.actionItems?.length > 0 && (
              <div className="bg-surface border border-surfaceHover rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <CheckSquare size={18} className="text-mint" />
                  <h2 className="font-semibold">Action items</h2>
                </div>
                <ul className="space-y-2">
                  {notes.actionItems.map((item, i) => (
                    <li key={i} className="text-sm flex gap-2">
                      <span className="text-mint">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <details className="bg-surface border border-surfaceHover rounded-2xl p-6">
              <summary className="flex items-center gap-2 font-semibold cursor-pointer">
                <FileText size={18} className="text-muted" />
                Full transcript
              </summary>
              <p className="text-sm leading-relaxed mt-4 whitespace-pre-wrap text-muted">
                {notes.fullText}
              </p>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}