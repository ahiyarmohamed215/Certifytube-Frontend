import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "./AppShell";
import { SearchPage } from "../features/search/SearchPage";
import { LoginPage } from "../features/auth/LoginPage";
import { SignupPage } from "../features/auth/SignupPage";
import { HomePage } from "../features/dashboard/HomePage";
import { WatchPage } from "../features/player/WatchPage";
import { AnalyzePage } from "../features/analyze/AnalyzePage";
import { QuizPage } from "../features/quiz/QuizPage";
import { ResultPage } from "../features/result/ResultPage";
import { CertificatePage } from "../features/certificate/CertificatePage";
import { VerifyPage } from "../features/verify/VerifyPage";
import { AdminPage } from "../features/admin/AdminPage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("ct_token");
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

const wrap = (el: React.ReactNode, protect = false) => {
  const content = <AppShell>{el}</AppShell>;
  return protect ? <ProtectedRoute>{content}</ProtectedRoute> : content;
};

export const router = createBrowserRouter([
  // Public
  { path: "/", element: wrap(<SearchPage />) },
  { path: "/login", element: <LoginPage /> },
  { path: "/signup", element: <SignupPage /> },
  { path: "/verify/:token", element: wrap(<VerifyPage />) },

  // Protected
  { path: "/home", element: wrap(<HomePage />, true) },
  { path: "/watch/:videoId", element: wrap(<WatchPage />, true) },
  { path: "/analyze/:sessionId", element: wrap(<AnalyzePage />, true) },
  { path: "/quiz/:quizId", element: wrap(<QuizPage />, true) },
  { path: "/result/:quizId", element: wrap(<ResultPage />, true) },
  { path: "/certificate/:certificateId", element: wrap(<CertificatePage />, true) },
  { path: "/admin", element: wrap(<AdminPage />, true) },
]);
