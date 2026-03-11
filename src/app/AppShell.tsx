import type { PropsWithChildren } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { type LucideIcon, Home, BookOpen, Award, User, Shield, LogOut, LogIn, UserPlus } from "lucide-react";
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

  const isHomeActive = location.pathname === "/" || location.pathname === "/home";
  const isLearnActive = location.pathname === "/my-learnings"
    || location.pathname.startsWith("/watch/")
    || location.pathname.startsWith("/analyze/")
    || location.pathname.startsWith("/quiz/")
    || location.pathname.startsWith("/result/");
  const isCertifiedActive = location.pathname === "/certified"
    || location.pathname.startsWith("/certificate/");
  const isProfileActive = location.pathname === "/profile";
  const isAdminActive = location.pathname === "/admin";
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

  const primaryItems: NavItem[] = [
    { to: "/home", label: "Home", icon: Home, active: isHomeActive },
    { to: "/my-learnings", label: "Learnings", icon: BookOpen, active: isLearnActive },
    { to: "/certified", label: "Certified", icon: Award, active: isCertifiedActive },
    { to: "/profile", label: "Profile", icon: User, active: isProfileActive },
  ];

  const mobileItems: NavItem[] = isLoggedIn
    ? [
      ...primaryItems,
      ...(user?.role === "ADMIN"
        ? [{ to: "/admin", label: "Admin", icon: Shield, active: isAdminActive }]
        : []),
    ]
    : [
      { to: "/", label: "Home", icon: Home, active: isHomeActive },
      { to: "/login", label: "Login", icon: LogIn, active: isLoginActive },
      { to: "/signup", label: "Sign Up", icon: UserPlus, active: isSignupActive },
    ];
  const footerExploreLinks = isLoggedIn
    ? [
      { to: "/home", label: "Home" },
      { to: "/my-learnings", label: "My Learnings" },
      { to: "/certified", label: "Certified" },
      { to: "/profile", label: "Profile" },
    ]
    : [
      { to: "/", label: "Home" },
      { to: "/login", label: "Login" },
      { to: "/signup", label: "Sign Up" },
    ];

  return (
    <div className={`ct-shell ${mobileItems.length > 0 ? "ct-shell-with-tabbar" : ""}`}>
      <header className="ct-header">
        <div className="ct-header-inner">
          <Link to={isLoggedIn ? "/home" : "/"} className="ct-logo">
            CertifyTube
          </Link>

          <nav className="ct-nav ct-nav-desktop">
            {isLoggedIn && primaryItems.map(({ to, label, icon: Icon, active }) => (
              <Link
                key={to}
                to={to}
                className={`ct-nav-link ${active ? "active" : ""}`}
              >
                <Icon size={15} className="ct-nav-link-icon" />
                {label}
              </Link>
            ))}

            {isLoggedIn && user?.role === "ADMIN" && (
              <Link
                to="/admin"
                className={`ct-nav-link ${isAdminActive ? "active" : ""}`}
              >
                <Shield size={15} className="ct-nav-link-icon" />
                Admin
              </Link>
            )}

            {isLoggedIn ? (
              <div className="ct-nav-user">
                <button
                  className="ct-btn ct-btn-ghost ct-btn-sm"
                  onClick={handleLogout}
                >
                  <LogOut size={14} />
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
              className="ct-btn ct-btn-ghost ct-btn-sm ct-mobile-logout"
              onClick={handleLogout}
              aria-label="Log out"
              title="Log out"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </header>

      <main className="ct-main">
        <div key={location.pathname} className="ct-route-switch">
          {children}
        </div>
      </main>

      <footer className="ct-footer">
        <div className="ct-footer-inner">
          <div className="ct-footer-top">
            <div className="ct-footer-brand">
              <Link to={isLoggedIn ? "/home" : "/"} className="ct-footer-logo">
                CertifyTube
              </Link>
              <p className="ct-footer-description">
                A verification-first learning platform for tracking progress, proving knowledge,
                and sharing trusted certificates.
              </p>
            </div>

            <div className="ct-footer-columns">
              <div className="ct-footer-column">
                <h4>Explore</h4>
                <div className="ct-footer-links">
                  {footerExploreLinks.map((link) => (
                    <Link key={link.to} to={link.to}>
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="ct-footer-column">
                <h4>Platform</h4>
                <div className="ct-footer-points">
                  <span>Engagement Analytics</span>
                  <span>Quiz Qualification</span>
                  <span>Certificate Verification</span>
                </div>
              </div>
            </div>
          </div>

          <div className="ct-footer-bottom">
            <span className="ct-footer-text">
              Copyright {new Date().getFullYear()} CertifyTube. All rights reserved.
            </span>
            <span className="ct-footer-meta">Watch. Learn. Get Certified.</span>
          </div>
        </div>
      </footer>

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
