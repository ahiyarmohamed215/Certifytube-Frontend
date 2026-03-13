import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CertificatePage } from "./CertificatePage";
import { deleteCertificate, getCertificate } from "../../api/certificate";
import { getMe } from "../../api/auth";
import { useAuthStore } from "../../store/useAuthStore";

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../api/certificate", () => ({
  getCertificate: vi.fn(),
  deleteCertificate: vi.fn(),
}));

vi.mock("../../api/auth", () => ({
  getMe: vi.fn(),
}));

const mockedGetCertificate = vi.mocked(getCertificate);
const mockedDeleteCertificate = vi.mocked(deleteCertificate);
const mockedGetMe = vi.mocked(getMe);

function renderCertificatePage() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/certificate/cert-1"]}>
        <Routes>
          <Route path="/certificate/:certificateId" element={<CertificatePage />} />
          <Route path="/certified" element={<div>Certified List</div>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CertificatePage delete certificate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mockedGetCertificate.mockResolvedValue({
      certificateId: "cert-1",
      certificateNumber: "CERT-0001",
      sessionId: "session-1",
      userId: 7,
      scorePercent: 90,
      verificationToken: "verify-token",
      verificationLink: "http://localhost:8080/api/certificates/verify/verify-token",
      createdAtUtc: "2026-03-10T10:00:00Z",
      status: "ACTIVE",
      valid: true,
      learnerName: "Learner",
      videoId: "vid-1",
      videoTitle: "Sample Video",
      engagementScore: 0.9,
      quizScore: 0.9,
      engagementThreshold: 0.85,
      quizThreshold: 0.8,
    });
  });

  it("opens and closes delete certificate modal", async () => {
    const user = userEvent.setup();
    renderCertificatePage();

    await screen.findByText("Certificate of Achievement");
    await user.click(screen.getByRole("button", { name: /delete certificate/i }));
    expect(screen.getByText("Delete Certificate?")).toBeInTheDocument();

    const modal = screen.getByText("Delete Certificate?").closest(".ct-modal-card");
    expect(modal).toBeTruthy();
    await user.click(within(modal as HTMLElement).getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByText("Delete Certificate?")).not.toBeInTheDocument();
    });
  });

  it("deletes certificate and redirects to certified list", async () => {
    const user = userEvent.setup();
    mockedDeleteCertificate.mockResolvedValue(undefined);
    renderCertificatePage();

    await screen.findByText("Certificate of Achievement");
    await user.click(screen.getByRole("button", { name: /delete certificate/i }));

    const modal = screen.getByText("Delete Certificate?").closest(".ct-modal-card");
    expect(modal).toBeTruthy();
    await user.click(within(modal as HTMLElement).getByRole("button", { name: /^Delete Certificate$/i }));

    await waitFor(() => {
      expect(mockedDeleteCertificate).toHaveBeenCalledWith("cert-1");
    });
    expect(await screen.findByText("Certified List")).toBeInTheDocument();
  });

  it("shows forbidden message when certificate delete is not allowed", async () => {
    const user = userEvent.setup();
    const forbidden = Object.assign(new Error("Forbidden"), { status: 403 });
    mockedDeleteCertificate.mockRejectedValue(forbidden);
    renderCertificatePage();

    await screen.findByText("Certificate of Achievement");
    await user.click(screen.getByRole("button", { name: /delete certificate/i }));

    const modal = screen.getByText("Delete Certificate?").closest(".ct-modal-card");
    expect(modal).toBeTruthy();
    await user.click(within(modal as HTMLElement).getByRole("button", { name: /^Delete Certificate$/i }));

    expect(await screen.findByText("You cannot delete this certificate")).toBeInTheDocument();
  });
});

