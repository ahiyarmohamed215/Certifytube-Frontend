import type { PropsWithChildren } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { type LucideIcon, Home, BookOpen, Award, User, Shield, LogIn, UserPlus } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { logout as apiLogout } from "../api/auth";
import toast from "react-hot-toast";

type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  active: boolean;
};

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, clearAuth } = useAuthStore();

  const isAdmin = isLoggedIn && user?.role === "ADMIN";

  const isHomeActive = location.pathname === "/" || location.pathname === "/home";
  const isLandingPage = location.pathname === "/";
  const isHomePage = location.pathname === "/home";
  const isLearnActive = location.pathname === "/my-learnings"
    || location.pathname.startsWith("/watch/")
    || location.pathname.startsWith("/analyze/")
    || location.pathname.startsWith("/quiz/")
    || location.pathname.startsWith("/result/");
  const isCertifiedActive = location.pathname === "/certified"
    || location.pathname.startsWith("/certificate/");
  const isProfileActive = location.pathname === "/profile" || location.pathname.startsWith("/profile/");
  const isAdminActive = location.pathname === "/admin"
    || location.pathname.startsWith("/admin/engagement")
    || location.pathname.startsWith("/admin/learners");
  const isLoginActive = location.pathname === "/login";
  const isSignupActive = location.pathname === "/signup";

  const handleLogout = async () => {
    try {
      await apiLogout();
    } catch {
      // even if fail, clear local
    }
    clearAuth();
    toast.success("Logged out");
    navigate("/login");
  };

  /* ── Learner nav (unchanged) ── */
  const primaryItems: NavItem[] = [
    { to: "/home", label: "Home", icon: Home, active: isHomeActive },
    { to: "/my-learnings", label: "Learnings", icon: BookOpen, active: isLearnActive },
    { to: "/certified", label: "Certified", icon: Award, active: isCertifiedActive },
    { to: "/profile", label: "Profile", icon: User, active: isProfileActive },
  ];

  /* ── Mobile items depend on role ── */
  const mobileItems: NavItem[] = isAdmin
    ? [
      { to: "/admin", label: "ML Dashboard", icon: Shield, active: isAdminActive },
    ]
    : isLoggedIn
      ? [
        ...primaryItems,
      ]
      : [
        { to: "/", label: "Home", icon: Home, active: isHomeActive },
        { to: "/login", label: "Login", icon: LogIn, active: isLoginActive },
        { to: "/signup", label: "Sign Up", icon: UserPlus, active: isSignupActive },
      ];

  return (
    <div className={`ct-shell ${mobileItems.length > 0 ? "ct-shell-with-tabbar" : ""}`}>
      <header className="ct-header">
        <div className="ct-header-inner">
          <Link to={isAdmin ? "/admin" : isLoggedIn ? "/home" : "/"} className="ct-logo">
            CertifyTube
          </Link>

          <nav className="ct-nav ct-nav-desktop">
            {/* Admin sees only ML Dashboard link */}
            {isAdmin && (
              <Link
                to="/admin"
                className={`ct-nav-link ${isAdminActive ? "active" : ""}`}
              >
                <Shield size={15} className="ct-nav-link-icon" />
                ML Dashboard
              </Link>
            )}

            {/* Learner sees standard nav */}
            {isLoggedIn && !isAdmin && primaryItems.map(({ to, label, icon: Icon, active }) => (
              <Link
                key={to}
                to={to}
                className={`ct-nav-link ${active ? "active" : ""}`}
              >
                <Icon size={15} className="ct-nav-link-icon" />
                {label}
              </Link>
            ))}

            {isLoggedIn ? (
              <div className="ct-nav-user">
                <button
                  className="ct-btn ct-btn-primary ct-btn-sm ct-rounded-pill ct-logout-btn"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="ct-nav-user">
                <Link to="/" className={`ct-nav-link ${isHomeActive ? "active" : ""}`}>
                  <Home size={15} className="ct-nav-link-icon" />
                  Home
                </Link>
                <Link to="/login" className="ct-btn ct-btn-ghost ct-btn-sm">
                  <LogIn size={14} />
                  Login
                </Link>
                <Link to="/signup" className="ct-btn ct-btn-primary ct-btn-sm">
                  <UserPlus size={14} />
                  Sign Up
                </Link>
              </div>
            )}
          </nav>

          {isLoggedIn && (
            <button
              className="ct-btn ct-btn-primary ct-btn-sm ct-rounded-pill ct-mobile-logout-btn"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
            >
              Logout
            </button>
          )}
        </div>
      </header>

      <main className="ct-main">
        <div key={location.pathname} className="ct-route-switch">
          {children}
        </div>
      </main>

      {/* Footer only for learner (non-admin) on landing/profile pages */}
      {!isAdmin && ((isLandingPage || isProfileActive) && !isHomePage) && (
        <footer className="ct-footer ct-footer-compact">
          <div className="ct-footer-compact-inner">
            <div className="ct-footer-main">
              <div className="ct-footer-brand">
                <Link to={isLoggedIn ? "/home" : "/"} className="ct-footer-logo">
                  CertifyTube
                </Link>
                <p className="ct-footer-description" style={{ marginTop: "8px", fontSize: "13px", color: "#666", maxWidth: "500px", lineHeight: "1.5", textAlign: "left" }}>
                  A verification-first learning platform for tracking progress, proving knowledge, and sharing trusted certificates from YouTube content.
                </p>
              </div>
              <div className="ct-footer-links-inline">
                <Link to="/">How it Works</Link>
                <Link to="/home">Courses</Link>
                <Link to="/verify/demo">Verify</Link>
                <Link to="/profile">Portfolio</Link>
              </div>
            </div>
            <div className="ct-footer-bottom-line">
              <span>Copyright {new Date().getFullYear()} CertifyTube. All rights reserved.</span>
              <span>Watch. Learn. Get Certified.</span>
            </div>
          </div>
        </footer>
      )}

      {mobileItems.length > 0 && (
        <nav className="ct-mobile-tabbar" aria-label="Mobile app navigation">
          {mobileItems.map(({ to, label, icon: Icon, active }) => (
            <Link
              key={to}
              to={to}
              className={`ct-mobile-tab ${active ? "active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
