"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToParentElement, restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

/**
 * A reorderable list. Used for navigation items and dashboard widgets.
 *
 * ── Why @dnd-kit ────────────────────────────────────────────────────────────
 * It ships a keyboard sensor. Tab to an item, Space to lift it, arrows to move,
 * Space to drop — with live announcements to screen readers. `react-beautiful-
 * dnd` is mouse-first and unmaintained.
 *
 * That matters more here than it might elsewhere: customisation exists partly
 * so people can adapt the app to how they work. Making the customisation itself
 * mouse-only would exclude a chunk of exactly that group.
 *
 * ── Why the drag handle is separate ─────────────────────────────────────────
 * Nav items are links. If the whole row were draggable, every click would risk
 * being read as the start of a drag, and navigating would become unreliable.
 * The handle is only rendered in customise mode, so the rest of the time these
 * are ordinary links.
 */
export default function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  disabled = false,
  className = "",
}: {
  items: T[];
  onReorder: (next: T[]) => void;
  renderItem: (item: T, handle: React.ReactNode) => React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const sensors = useSensors(
    // A small distance threshold means a click that moves a pixel or two is
    // still a click, not a one-pixel drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = items.findIndex((i) => i.id === active.id);
    const to = items.findIndex((i) => i.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(items, from, to));
  }

  if (disabled) {
    return (
      <div className={className}>
        {items.map((item) => (
          <div key={item.id}>{renderItem(item, null)}</div>
        ))}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up ${active.id}.`,
          onDragOver: ({ active, over }) =>
            over ? `${active.id} is now over ${over.id}.` : `${active.id} is no longer over a target.`,
          onDragEnd: ({ active, over }) =>
            over ? `${active.id} dropped onto ${over.id}.` : `${active.id} returned to where it started.`,
          onDragCancel: ({ active }) => `Cancelled. ${active.id} returned to where it started.`,
        },
      }}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableRow key={item.id} id={item.id}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (handle: React.ReactNode) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  // `setNodeRef` marks the row — that is what moves and what others drop onto.
  // `setActivatorNodeRef` marks the grip — the only part that starts a drag.
  // Putting the node ref on the handle instead makes the *handle* the sortable
  // element, so rows jump to the wrong positions.
  const handle = (
    <button
      type="button"
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Reorder ${id}`}
      className="cursor-grab touch-none rounded p-1 text-ink-subtle transition hover:text-ink-muted focus-visible:ring-2 focus-visible:ring-brand-500 active:cursor-grabbing dark:hover:text-white"
    >
      <GripVertical className="h-4 w-4" aria-hidden />
    </button>
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // Lifted rows sit above their neighbours, and fade so the drop target
        // underneath stays readable.
        zIndex: isDragging ? 20 : undefined,
        opacity: isDragging ? 0.85 : undefined,
      }}
      data-dragging={isDragging || undefined}
    >
      {children(handle)}
    </div>
  );
}
