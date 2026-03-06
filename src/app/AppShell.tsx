import type { PropsWithChildren } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, BookOpen, User, Shield, LogOut, LogIn, UserPlus } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { logout as apiLogout } from "../api/auth";
import toast from "react-hot-toast";

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, clearAuth } = useAuthStore();

  const isHomeActive = location.pathname === "/" || location.pathname === "/home";
  const isLearnActive = location.pathname === "/my-learnings"
    || location.pathname.startsWith("/watch/")
    || location.pathname.startsWith("/analyze/")
    || location.pathname.startsWith("/quiz/")
    || location.pathname.startsWith("/result/")
    || location.pathname.startsWith("/certificate/");
  const isProfileActive = location.pathname === "/profile";

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

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="ct-header">
        <div className="ct-header-inner">
          <Link to={isLoggedIn ? "/home" : "/"} className="ct-logo">
            certifytube
          </Link>

          <nav className="ct-nav">
            {isLoggedIn && (
              <Link
                to="/home"
                className={`ct-nav-link ${isHomeActive ? "active" : ""}`}
              >
                <Home size={15} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Home
              </Link>
            )}

            {isLoggedIn && (
              <Link
                to="/my-learnings"
                className={`ct-nav-link ${isLearnActive ? "active" : ""}`}
              >
                <BookOpen size={15} style={{ marginRight: 4, verticalAlign: "middle" }} />
                My Learnings
              </Link>
            )}

            {isLoggedIn && (
              <Link
                to="/profile"
                className={`ct-nav-link ${isProfileActive ? "active" : ""}`}
              >
                <User size={15} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Profile
              </Link>
            )}

            {isLoggedIn && user?.role === "ADMIN" && (
              <Link
                to="/admin"
                className={`ct-nav-link ${location.pathname === "/admin" ? "active" : ""}`}
              >
                <Shield size={15} style={{ marginRight: 4, verticalAlign: "middle" }} />
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
                  <Home size={15} style={{ marginRight: 4, verticalAlign: "middle" }} />
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
        </div>
      </header>

      <main className="ct-main ct-fade-in">{children}</main>
    </div>
  );
}
