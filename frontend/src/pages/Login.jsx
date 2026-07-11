import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Could not log in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans flex items-center justify-center px-6">
      <div className="max-w-sm w-full">
        <Link to="/" className="font-display text-2xl font-semibold block text-center mb-8">
          anymeet
        </Link>

        <div className="bg-surface border border-surfaceHover rounded-3xl p-8 shadow-sm">
          <h2 className="font-display text-2xl font-semibold mb-1">Welcome back</h2>
          <p className="text-muted text-sm mb-6">Log in to start or manage your meetings.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-canvas border border-surfaceHover rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium block mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-canvas border border-surfaceHover rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral"
                placeholder="••••••••"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-coral text-white font-medium py-2.5 rounded-portal shadow-glow hover:opacity-90 transition disabled:opacity-60"
            >
              {submitting ? "Logging in..." : "Log in"}
            </button>
          </form>

          <p className="text-sm text-muted text-center mt-6">
            Don't have an account?{" "}
            <Link to="/signup" className="text-coral font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}