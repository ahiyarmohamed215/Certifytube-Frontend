import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginPage } from "./LoginPage";
import { SignupPage } from "./SignupPage";
import { getMe, login, resendVerification, signup } from "../../api/auth";
import { useAuthStore } from "../../store/useAuthStore";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../api/auth", () => ({
  signup: vi.fn(),
  login: vi.fn(),
  resendVerification: vi.fn(),
  getMe: vi.fn(),
}));

const mockedSignup = vi.mocked(signup);
const mockedLogin = vi.mocked(login);
const mockedResendVerification = vi.mocked(resendVerification);
const mockedGetMe = vi.mocked(getMe);

function renderAuthPages(path: "/signup" | "/login") {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/home" element={<div>Learner Home</div>} />
          <Route path="/admin" element={<div>Admin Dashboard</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Auth production UX", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    useAuthStore.setState({ token: null, user: null, isLoggedIn: false });
  });

  it("signup shows email verification confirmation without auto-login", async () => {
    const user = userEvent.setup();
    mockedSignup.mockResolvedValue({
      userId: 1,
      email: "learner@example.com",
      role: "USER",
      emailVerified: false,
      message: "Verification email sent",
    });
    renderAuthPages("/signup");

    await user.type(screen.getByLabelText("Full Name"), "Learner One");
    await user.type(screen.getByLabelText("Email"), "learner@example.com");
    await user.type(screen.getByLabelText("Password"), "password-123");
    await user.type(screen.getByLabelText("Confirm Password"), "password-123");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => {
      expect(mockedSignup).toHaveBeenCalledWith("learner@example.com", "password-123", "Learner One");
    });
    expect(await screen.findByText("Check your email to verify account")).toBeInTheDocument();
    expect(localStorage.getItem("ct_token")).toBeNull();
  });

  it("login unverified state shows resend verification action", async () => {
    const user = userEvent.setup();
    mockedGetMe.mockResolvedValue({
      userId: 1,
      email: "learner@example.com",
      role: "USER",
      name: "Learner One",
    });
    mockedLogin.mockRejectedValue({
      status: 400,
      data: { message: "Email not verified. Verify your email first." },
      message: "Email not verified. Verify your email first.",
    });
    mockedResendVerification.mockResolvedValue({ message: "Verification email sent again." });
    renderAuthPages("/login");

    await user.type(screen.getByLabelText("Email"), "learner@example.com");
    await user.type(screen.getByLabelText("Password"), "password-123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/email is not verified/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /resend verification/i }));

    await waitFor(() => {
      expect(mockedResendVerification).toHaveBeenCalledWith("learner@example.com");
    });
    expect(await screen.findByText("Verification email sent again.")).toBeInTheDocument();
  });

  it("login sends admin users to the admin dashboard", async () => {
    const user = userEvent.setup();
    mockedLogin.mockResolvedValue({
      userId: 99,
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
      emailVerified: true,
      token: "token-1",
      tokenType: "Bearer",
    });
    mockedGetMe.mockResolvedValue({
      userId: 99,
      email: "admin@example.com",
      role: "ADMIN",
      name: "Admin",
    });
    renderAuthPages("/login");

    await user.type(screen.getByLabelText("Email"), "admin@example.com");
    await user.type(screen.getByLabelText("Password"), "password-123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockedLogin).toHaveBeenCalledWith("admin@example.com", "password-123");
    });
    expect(await screen.findByText("Admin Dashboard")).toBeInTheDocument();
    expect(screen.queryByText("Learner Home")).not.toBeInTheDocument();
  });
});
