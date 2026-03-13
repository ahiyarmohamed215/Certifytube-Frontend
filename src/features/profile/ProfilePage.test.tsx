import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ProfilePage } from "./ProfilePage";
import { deleteMyAccount, getMe } from "../../api/auth";
import { getDashboard } from "../../api/dashboard";
import { useAuthStore } from "../../store/useAuthStore";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../api/auth", () => ({
  getMe: vi.fn(),
  deleteMyAccount: vi.fn(),
}));

vi.mock("../../api/dashboard", () => ({
  getDashboard: vi.fn(),
}));

const mockedGetMe = vi.mocked(getMe);
const mockedDeleteMyAccount = vi.mocked(deleteMyAccount);
const mockedGetDashboard = vi.mocked(getDashboard);

function renderProfilePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/profile"]}>
        <Routes>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/change-password" element={<div>Change Password Page</div>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ProfilePage delete account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.setState({
      token: "token-1",
      user: { userId: 7, email: "learner@example.com", role: "USER", name: "Learner" },
      isLoggedIn: true,
    });

    mockedGetMe.mockResolvedValue({
      userId: 7,
      email: "learner@example.com",
      role: "USER",
      name: "Learner",
    });
    mockedGetDashboard.mockResolvedValue({
      activeVideos: [],
      completedVideos: [],
      quizPendingVideos: [],
      certifiedVideos: [],
    });
  });

  it("opens and closes delete account confirmation modal", async () => {
    const user = userEvent.setup();
    renderProfilePage();

    await screen.findByText("Profile");
    await user.click(screen.getByRole("button", { name: /delete account/i }));
    expect(screen.getByText("Delete Account?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByText("Delete Account?")).not.toBeInTheDocument();
    });
  });

  it("deletes account and redirects to login", async () => {
    const user = userEvent.setup();
    mockedDeleteMyAccount.mockResolvedValue(undefined);
    localStorage.setItem("ct_token", "token-1");
    localStorage.setItem("ct_user", JSON.stringify({ userId: 7, email: "learner@example.com", role: "USER" }));
    localStorage.setItem("ct_test_data", "protected");

    renderProfilePage();
    await screen.findByText("Profile");

    await user.click(screen.getByRole("button", { name: /delete account/i }));
    await user.type(screen.getByPlaceholderText("Type DELETE to confirm"), "DELETE");
    const modal = screen.getByText("Delete Account?").closest(".ct-modal-card");
    expect(modal).toBeTruthy();
    await user.click(within(modal as HTMLElement).getByRole("button", { name: /^Delete Account$/i }));

    await waitFor(() => {
      expect(mockedDeleteMyAccount).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText("Login Page")).toBeInTheDocument();
    expect(localStorage.getItem("ct_token")).toBeNull();
    expect(localStorage.getItem("ct_test_data")).toBeNull();
  });

  it("shows backend message when account delete fails", async () => {
    const user = userEvent.setup();
    mockedDeleteMyAccount.mockRejectedValue(new Error("Backend says cannot delete now"));

    renderProfilePage();
    await screen.findByText("Profile");

    await user.click(screen.getByRole("button", { name: /delete account/i }));
    await user.type(screen.getByPlaceholderText("Type DELETE to confirm"), "DELETE");
    const modal = screen.getByText("Delete Account?").closest(".ct-modal-card");
    expect(modal).toBeTruthy();
    await user.click(within(modal as HTMLElement).getByRole("button", { name: /^Delete Account$/i }));

    expect(await screen.findByText("Backend says cannot delete now")).toBeInTheDocument();
  });

  it("opens dedicated change password page", async () => {
    const user = userEvent.setup();
    renderProfilePage();
    await screen.findByText("Profile");

    await user.click(screen.getByRole("button", { name: /change password/i }));
    expect(await screen.findByText("Change Password Page")).toBeInTheDocument();
  });
});
