import { getGoogleAccessTokenForUser, updateTaskRow } from "./db";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "./google";
import type { Task } from "./types";

const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;

interface SyncResult {
  warning: string | null;
}

/**
 * מסנכרן תזכורת ביומן Google של היוצר/ת ושל האחראי/ת (סנכרון דו-צדדי).
 * אם השניים הם אותו אדם, נוצר אירוע אחד בלבד (לא כפול). אם אין due_at
 * או שהאדם לא חיבר Google — מדלגים בשקט על הצד הזה.
 */
export async function syncTaskCalendarEvents(task: Task): Promise<SyncResult> {
  const isDone = task.status === "done";
  const titlePrefix = isDone ? "✔ " : "משימה: ";
  const description = task.completion_summary
    ? `${task.description ?? ""}\n\nסיכום: ${task.completion_summary}`.trim()
    : task.description ?? undefined;

  const warnings: string[] = [];

  async function syncFor(
    userId: string,
    existingEventId: string | null,
    onSaved: (eventId: string) => Promise<unknown>,
  ) {
    try {
      if (!task.due_at) {
        if (existingEventId) {
          const accessToken = await getGoogleAccessTokenForUser(userId);
          if (accessToken) await deleteGoogleCalendarEvent(accessToken, existingEventId);
        }
        return;
      }

      const accessToken = await getGoogleAccessTokenForUser(userId);
      if (!accessToken) return;

      const start = new Date(task.due_at);
      const end = new Date(start.getTime() + DEFAULT_EVENT_DURATION_MS);
      const input = {
        title: `${titlePrefix}${task.title}`,
        description,
        startIso: start.toISOString(),
        endIso: end.toISOString(),
      };

      if (existingEventId) {
        await updateGoogleCalendarEvent(accessToken, existingEventId, input);
      } else {
        const eventId = await createGoogleCalendarEvent(accessToken, input);
        await onSaved(eventId);
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "שגיאה בסנכרון יומן Google");
    }
  }

  const sameParticipant = task.assigned_to && task.assigned_to === task.created_by;

  await syncFor(task.created_by, task.creator_google_event_id, (eventId) =>
    updateTaskRow(task.id, { creator_google_event_id: eventId }),
  );

  if (task.assigned_to && !sameParticipant) {
    await syncFor(task.assigned_to, task.google_event_id, (eventId) =>
      updateTaskRow(task.id, { google_event_id: eventId }),
    );
  }

  return { warning: warnings.length > 0 ? warnings.join(" | ") : null };
}

export async function deleteTaskCalendarEvents(task: Task): Promise<void> {
  const sameParticipant = task.assigned_to && task.assigned_to === task.created_by;

  const deletions: Promise<unknown>[] = [];

  if (task.creator_google_event_id) {
    deletions.push(
      getGoogleAccessTokenForUser(task.created_by)
        .then((token) => {
          if (token) return deleteGoogleCalendarEvent(token, task.creator_google_event_id!);
        })
        .catch(() => undefined),
    );
  }

  if (task.google_event_id && task.assigned_to && !sameParticipant) {
    deletions.push(
      getGoogleAccessTokenForUser(task.assigned_to)
        .then((token) => {
          if (token) return deleteGoogleCalendarEvent(token, task.google_event_id!);
        })
        .catch(() => undefined),
    );
  }

  await Promise.all(deletions);
}
