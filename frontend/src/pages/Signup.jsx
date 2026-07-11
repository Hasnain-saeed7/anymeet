import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signup(name, email, password);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Could not create account");
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
          <h2 className="font-display text-2xl font-semibold mb-1">Create your account</h2>
          <p className="text-muted text-sm mb-6">Start hosting meetings in a minute.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium block mb-1">Name</label>
              <input
                type="text"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-canvas border border-surfaceHover rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral"
                placeholder="Your name"
              />
            </div>

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
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-canvas border border-surfaceHover rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-coral"
                placeholder="At least 8 characters"
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-coral text-white font-medium py-2.5 rounded-portal shadow-glow hover:opacity-90 transition disabled:opacity-60"
            >
              {submitting ? "Creating account..." : "Sign up"}
            </button>
          </form>

          <p className="text-sm text-muted text-center mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-coral font-medium">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}