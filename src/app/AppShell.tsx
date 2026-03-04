import { PropsWithChildren } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Search, Home, Shield, LogOut, LogIn, UserPlus } from "lucide-react";
import { useAuthStore } from "../store/useAuthStore";
import { logout as apiLogout } from "../api/auth";
import toast from "react-hot-toast";

export function AppShell({ children }: PropsWithChildren) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isLoggedIn, user, clearAuth } = useAuthStore();

  const isActive = (path: string) => location.pathname === path;

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
          <Link to="/" className="ct-logo">
            CertifyTube
          </Link>

          <nav className="ct-nav">
            <Link
              to="/"
              className={`ct-nav-link ${isActive("/") ? "active" : ""}`}
            >
              <Search size={15} style={{ marginRight: 4, verticalAlign: "middle" }} />
              Search
            </Link>

            {isLoggedIn && (
              <Link
                to="/home"
                className={`ct-nav-link ${isActive("/home") ? "active" : ""}`}
              >
                <Home size={15} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Dashboard
              </Link>
            )}

            {isLoggedIn && user?.role === "ADMIN" && (
              <Link
                to="/admin"
                className={`ct-nav-link ${isActive("/admin") ? "active" : ""}`}
              >
                <Shield size={15} style={{ marginRight: 4, verticalAlign: "middle" }} />
                Admin
              </Link>
            )}

            {isLoggedIn ? (
              <div className="ct-nav-user">
                <span className="ct-nav-email">{user?.email}</span>
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
