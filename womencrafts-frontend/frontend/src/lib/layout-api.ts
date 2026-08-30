import { apiClient } from "./api";
import type {
  Breakpoint,
  Layout,
  LayoutFeatures,
  NavConfig,
  WidgetPlacement,
} from "@/layout-engine";

/**
 * Saved layout and plan entitlements.
 *
 * Every write is a small, targeted call rather than "save the whole layout".
 * Two tabs open, one resizing a sidebar and the other reordering nav, must both
 * keep their change — a whole-document save would let the later one overwrite
 * the earlier with stale data.
 */

export async function apiMyLayout() {
  const { data } = await apiClient.get<Layout>("/layout/me");
  return data;
}

export async function apiMyFeatures() {
  const { data } = await apiClient.get<LayoutFeatures>("/layout/me/features");
  return data;
}

export async function apiSaveNav(app: string, config: NavConfig) {
  const { data } = await apiClient.put<Layout>(`/layout/me/nav/${app}`, config);
  return data;
}

export async function apiSaveSidebar(breakpoint: Breakpoint, width: number) {
  const { data } = await apiClient.put<Layout>("/layout/me/sidebar", { breakpoint, width });
  return data;
}

export async function apiSavePane(key: string, breakpoint: Breakpoint, fraction: number) {
  const { data } = await apiClient.put<Layout>("/layout/me/pane", { key, breakpoint, fraction });
  return data;
}

export async function apiSaveChart(key: string, height: number) {
  const { data } = await apiClient.put<Layout>("/layout/me/chart", { key, height });
  return data;
}

export async function apiSaveColumns(key: string, widths: Record<string, number>) {
  const { data } = await apiClient.put<Layout>("/layout/me/columns", { key, widths });
  return data;
}

export async function apiSaveWidgets(screen: string, widgets: WidgetPlacement[]) {
  const { data } = await apiClient.put<Layout>("/layout/me/widgets", { screen, widgets });
  return data;
}

export async function apiResetLayout() {
  const { data } = await apiClient.delete<Layout>("/layout/me");
  return data;
}

export async function apiResetScreen(screen: string) {
  const { data } = await apiClient.delete<Layout>(`/layout/me/screen/${screen}`);
  return data;
}

export async function apiResetNav(app: string) {
  const { data } = await apiClient.delete<Layout>(`/layout/me/nav/${app}`);
  return data;
}
