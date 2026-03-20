import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CertificatePage } from "./CertificatePage";
import { getCertificate } from "../../api/certificate";
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
}));

vi.mock("../../api/auth", () => ({
  getMe: vi.fn(),
}));

const mockedGetCertificate = vi.mocked(getCertificate);
const mockedGetMe = vi.mocked(getMe);

function renderCertificatePage(
  initialEntries: Array<string | { pathname: string; state?: unknown }> = ["/certificate/cert-1"],
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/certificate/:certificateId" element={<CertificatePage />} />
          <Route path="/certified" element={<div>Certified Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("CertificatePage", () => {
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

  it("renders certificate summary and actions", async () => {
    renderCertificatePage();

    expect(await screen.findByText("Certificate of Achievement")).toBeInTheDocument();
    expect(screen.getByText("Certificate Verified")).toBeInTheDocument();
    expect(screen.getByLabelText("Download certificate PDF")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy verification link")).toBeInTheDocument();
  });

  it("shows active status badge", async () => {
    renderCertificatePage();

    expect(await screen.findByText("Certificate of Achievement")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
  });

  it("closes to certified page when certificate was opened from quiz flow", async () => {
    const user = userEvent.setup();
    renderCertificatePage([
      {
        pathname: "/certificate/cert-1",
        state: { fromStatus: "quiz", fromPath: "/my-learnings?status=quiz" },
      },
    ]);

    expect(await screen.findByText("Certificate of Achievement")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close/i }));

    expect(await screen.findByText("Certified Page")).toBeInTheDocument();
  });
});
