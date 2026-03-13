import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CertifiedPage } from "./CertifiedPage";
import { getDashboard } from "../../api/dashboard";
import { deleteCertificate } from "../../api/certificate";
import { useAuthStore } from "../../store/useAuthStore";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../api/dashboard", () => ({
  getDashboard: vi.fn(),
}));

vi.mock("../../api/certificate", () => ({
  deleteCertificate: vi.fn(),
}));

const mockedGetDashboard = vi.mocked(getDashboard);
const mockedDeleteCertificate = vi.mocked(deleteCertificate);

function renderCertifiedPage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/certified"]}>
        <Routes>
          <Route path="/certified" element={<CertifiedPage />} />
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/certificate/:certificateId" element={<div>Certificate Detail</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CertifiedPage delete certificate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      token: "token-1",
      user: { userId: 7, email: "learner@example.com", role: "USER", name: "Learner" },
      isLoggedIn: true,
    });

    mockedGetDashboard.mockResolvedValue({
      activeVideos: [],
      completedVideos: [],
      quizPendingVideos: [],
      certifiedVideos: [
        {
          sessionId: "session-1",
          videoId: "video-1",
          videoTitle: "Sample Certified Video",
          thumbnailUrl: "",
          lastPositionSec: 0,
          videoDurationSec: 600,
          progressPercent: 100,
          status: "CERTIFIED",
          stemEligible: true,
          engagementScore: 0.91,
          certificateId: "cert-1",
          createdAt: "2026-03-10T10:00:00Z",
        },
      ],
    });
  });

  it("opens and closes delete certificate modal", async () => {
    const user = userEvent.setup();
    renderCertifiedPage();

    await screen.findByText("Sample Certified Video");
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(screen.getByText("Delete Certificate?")).toBeInTheDocument();
    const modal = screen.getByText("Delete Certificate?").closest(".ct-modal-card");
    expect(modal).toBeTruthy();
    await user.click(within(modal as HTMLElement).getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("Delete Certificate?")).not.toBeInTheDocument();
    });
  });

  it("deletes certificate after confirmation", async () => {
    const user = userEvent.setup();
    mockedDeleteCertificate.mockResolvedValue(undefined);
    renderCertifiedPage();

    await screen.findByText("Sample Certified Video");
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    const modal = screen.getByText("Delete Certificate?").closest(".ct-modal-card");
    expect(modal).toBeTruthy();
    await user.click(within(modal as HTMLElement).getByRole("button", { name: /^Delete Certificate$/i }));

    await waitFor(() => {
      expect(mockedDeleteCertificate).toHaveBeenCalledWith("cert-1");
    });
  });

  it("shows forbidden message when delete is not allowed", async () => {
    const user = userEvent.setup();
    mockedDeleteCertificate.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    renderCertifiedPage();

    await screen.findByText("Sample Certified Video");
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    const modal = screen.getByText("Delete Certificate?").closest(".ct-modal-card");
    expect(modal).toBeTruthy();
    await user.click(within(modal as HTMLElement).getByRole("button", { name: /^Delete Certificate$/i }));

    expect(await screen.findByText("You cannot delete this certificate")).toBeInTheDocument();
  });
});
