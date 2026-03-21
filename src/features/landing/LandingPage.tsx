import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Brain, Award, ShieldCheck, PlayCircle, ClipboardCheck, BadgeCheck } from "lucide-react";
import { useAuthStore } from "../../store/useAuthStore";
import { getDefaultAppPath } from "../../app/defaultAppPath";
import { getPublicPlatformStats } from "../../api/public";
import type { PublicPlatformStatsResponse } from "../../types/api";

const steps = [
  {
    icon: PlayCircle,
    title: "Watch and Track",
    desc: "Learn from YouTube videos while CertifyTube records real engagement and progress.",
  },
  {
    icon: Brain,
    title: "Analyze and Qualify",
    desc: "Pass engagement rules, then unlock quiz eligibility for true learning validation.",
  },
  {
    icon: Award,
    title: "Get Certified",
    desc: "Pass the quiz and receive a verifiable certificate with secure token-based validation.",
  },
];

const highlights = [
  {
    icon: ShieldCheck,
    title: "Verification-First",
    desc: "Every certificate has a public verification link and QR flow for trust.",
  },
  {
    icon: ClipboardCheck,
    title: "Dual Validation",
    desc: "Engagement score plus quiz performance ensures quality, not just watch time.",
  },
  {
    icon: BadgeCheck,
    title: "Learner Portfolio",
    desc: "Build a clean history of active sessions, completed progress, and certified outcomes.",
  },
];

function formatTrustCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "0";
  return value.toLocaleString("en-US");
}

export function LandingPage() {
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuthStore();
  const isAdmin = user?.role?.toUpperCase() === "ADMIN";
  const defaultAppPath = getDefaultAppPath(user?.role);
  const [trustStats, setTrustStats] = useState<PublicPlatformStatsResponse | null>(null);
  const [statsUnavailable, setStatsUnavailable] = useState(false);

  useEffect(() => {
    let active = true;

    getPublicPlatformStats()
      .then((stats) => {
        if (!active) return;
        setTrustStats(stats);
      })
      .catch(() => {
        if (!active) return;
        setStatsUnavailable(true);
      });

    return () => {
      active = false;
    };
  }, []);

  const handlePrimary = () => {
    navigate(isLoggedIn ? defaultAppPath : "/home");
  };

  const handleSecondary = () => {
    navigate(isLoggedIn ? defaultAppPath : "/login");
  };

  return (
    <div className="ct-landing ct-slide-up">
      <section className="ct-landing-hero">
        <span className="ct-landing-kicker">
          Learn. Prove. Succeed.
        </span>

        <h1 className="ct-landing-title">
          Turn Knowledge Into
          <span> Credentials.</span>
        </h1>

        <p className="ct-landing-subtitle">
          CertifyTube analyzes your viewing engagement and validates your understanding, issuing definitive certificates for self-taught expertise.
        </p>

        <div className="ct-landing-trust" aria-live="polite">
          <article className="ct-landing-trust-card">
            <span className="ct-landing-trust-value">
              {trustStats ? formatTrustCount(trustStats.learnerCount) : statsUnavailable ? "Growing" : "Loading..."}
            </span>
            <span className="ct-landing-trust-label">Learners Signed Up</span>
          </article>
          <article className="ct-landing-trust-card">
            <span className="ct-landing-trust-value">
              {trustStats ? formatTrustCount(trustStats.certificateCount) : statsUnavailable ? "Growing" : "Loading..."}
            </span>
            <span className="ct-landing-trust-label">Certificates Generated</span>
          </article>
        </div>

        <div className="ct-landing-actions">
          <button className="ct-btn ct-btn-primary ct-btn-lg" onClick={handlePrimary}>
            {isLoggedIn ? "Go to Dashboard" : "Start Learning"}
            <ArrowRight size={16} />
          </button>
          <button className="ct-btn ct-btn-secondary ct-btn-lg" onClick={handleSecondary}>
            {isLoggedIn ? (isAdmin ? "Open Admin Panel" : "Browse Content") : "Log In"}
          </button>
        </div>

        <div className="ct-landing-chips">
          <span className="ct-cert-chip">Engagement Tracking</span>
          <span className="ct-cert-chip">Skill Validation</span>
          <span className="ct-cert-chip">Instant Verification</span>
        </div>
      </section>

      <section className="ct-landing-steps">
        {steps.map(({ icon: Icon, title, desc }) => (
          <article key={title} className="ct-landing-step-card">
            <div className="ct-landing-step-icon">
              <Icon size={20} />
            </div>
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </section>

      <section className="ct-landing-features">
        <div className="ct-landing-features-head">
          <h2>Validation for serious learners.</h2>
          <p>
            Build a definitive portfolio of your expertise with verifiable certificates backed by real data.
          </p>
        </div>
        <div className="ct-landing-feature-grid">
          {highlights.map(({ icon: Icon, title, desc }) => (
            <article key={title} className="ct-landing-feature-card">
              <Icon size={22} />
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
