"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Add a note to the group whiteboard. */
export async function addNote(groupId: string, content: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };
  if (!content.trim()) return { error: "Note cannot be empty." };

  try {
    const note = await prisma.groupNote.create({
      data: { groupId, authorId: session.user.id, content: content.trim() },
    });
    return { note: { id: note.id, content: note.content, authorId: note.authorId, createdAt: note.createdAt.toISOString() } };
  } catch (error) {
    console.error("Add note failed:", error);
    return { error: "Failed to add note." };
  }
}

/** Get all notes for a group. */
export async function getNotes(groupId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  try {
    const notes = await prisma.groupNote.findMany({
      where: { groupId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return {
      notes: notes.map((n) => ({
        id: n.id,
        content: n.content,
        authorId: n.authorId,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  } catch (error) {
    console.error("Get notes failed:", error);
    return { error: "Failed to load notes." };
  }
}

/** Delete a note (author only). */
export async function deleteNote(noteId: string) {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  try {
    const note = await prisma.groupNote.findUnique({ where: { id: noteId } });
    if (!note) return { error: "Note not found." };
    if (note.authorId !== session.user.id) return { error: "You can only delete your own notes." };

    await prisma.groupNote.delete({ where: { id: noteId } });
    return { success: true };
  } catch (error) {
    console.error("Delete note failed:", error);
    return { error: "Failed to delete note." };
  }
}
