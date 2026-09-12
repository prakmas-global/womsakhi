/**
 * WomSakhi layout engine — portable, per-user layout customisation.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * Using this in another project
 * ────────────────────────────────────────────────────────────────────────────
 * 1. Copy this folder. It imports nothing from the app around it — only
 *    `@dnd-kit/*`, `react-resizable-panels` and `lucide-react`.
 * 2. Wrap the tree in <LayoutEngineProvider>, passing `initial` (the saved
 *    layout) and `persist` (callbacks that save each kind of change).
 * 3. Render <LayoutStyle /> in the server layout's <head> to kill the jump on
 *    first paint.
 * 4. Use the primitives where you want things adjustable:
 *      <ResizableSidebar app="staff">…</ResizableSidebar>
 *      <SplitPane id="members" list={…} detail={…} />
 *      <ResizableBox screen="dashboard" id="growth">…</ResizableBox>
 *      <WidgetGrid screen="dashboard" widgets={…} />
 *      useCustomNav("staff", NAV_ITEMS)
 * 5. Put <CustomiseButton /> somewhere that can never be hidden, and render
 *    <CustomiseBar /> once near the root.
 *
 * The engine owns arrangement only. The app still owns what its nav items and
 * widgets *are*, which is what lets a new item appear for everyone — including
 * people who customised their layout long before it shipped.
 */

// LayoutStyle is deliberately NOT re-exported. It uses next/headers, which is
// server-only, and this barrel is imported by client components — one re-export
// drags the server module into every client bundle and breaks the app at
// runtime. That exact mistake cost an afternoon with the theme engine.
// Server code imports it directly:
//     import LayoutStyle from "@/layout-engine/LayoutStyle";

export {
  LayoutEngineProvider,
  useLayoutEngine,
  DEFAULT_NAV,
  ICON_ONLY_BELOW,
} from "./LayoutEngineProvider";
export type { PersistHandlers } from "./LayoutEngineProvider";

export { default as SplitPane } from "./SplitPane";
export { default as ResizableColumns } from "./ResizableColumns";
export { default as ResizableBox } from "./ResizableBox";
export { default as ResizeHandle } from "./ResizeHandle";
export { default as SortableList } from "./SortableList";
export { default as ResizeFrame, ALL_HANDLES, FLOW_HANDLES } from "./ResizeFrame";
export type { Handle, ResizeFrameProps } from "./ResizeFrame";
export { default as WidgetGrid } from "./WidgetGrid";
export type { WidgetDef } from "./WidgetGrid";
export { default as CustomiseBar, CustomiseButton } from "./CustomiseBar";

export { useCustomNav } from "./useCustomNav";
export { useSidebarVariable } from "./useSidebarVariable";
export {
  useContainerSize,
  bucketFor,
  BUCKET_WIDTH,
  SHORT_HEIGHT,
  TINY_HEIGHT,
} from "./useContainerSize";
export type { ContainerSize, SizeBucket } from "./useContainerSize";
export type { NavItem } from "./useCustomNav";

export {
  clearStoredLayout,
  currentBreakpoint,
  readStoredLayout,
  storeLayout,
  LAYOUT_COOKIE,
  LAYOUT_STORAGE_KEY,
} from "./storage";

export {
  ALL_ENABLED,
  BREAKPOINTS,
  BREAKPOINT_MIN,
  clamp,
  EMPTY_LAYOUT,
  LIMITS,
  UNHIDEABLE,
} from "./types";
export type {
  Breakpoint,
  Layout,
  LayoutFeatures,
  NavConfig,
  WidgetPlacement,
} from "./types";
