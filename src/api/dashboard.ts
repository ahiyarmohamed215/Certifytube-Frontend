import { http } from "./http";
import type { DashboardResponse } from "../types/api";

export async function getDashboard(status?: string): Promise<DashboardResponse> {
    const res = await http.get<DashboardResponse>("/api/dashboard", {
        params: status ? { status } : undefined,
    });
    return res.data;
}
