import { apiClient } from "./api";

export interface AdminRegion {
  id: string;
  name: string;
  description: string;
  status: "Active" | "Inactive";
  member_count: number;
  admin_count: number;
  created_at: string;
}

export const apiRegions = () =>
  apiClient.get<{ regions: AdminRegion[] }>("/regions").then((r) => r.data.regions);

export const apiCreateRegion = (body: { name: string; description: string; status: "Active" | "Inactive" }) =>
  apiClient.post<AdminRegion>("/regions", body).then((r) => r.data);

export const apiUpdateRegion = (id: string, body: Partial<Pick<AdminRegion, "name" | "description" | "status">>) =>
  apiClient.patch<AdminRegion>(`/regions/${id}`, body).then((r) => r.data);

export const apiArchiveRegion = (id: string) =>
  apiClient.delete<{ message: string }>(`/regions/${id}`).then((r) => r.data);
