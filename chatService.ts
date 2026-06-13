import { ref, push, set, serverTimestamp } from 'firebase/database';
import { db } from '@/lib/firebase';

const MAX_MESSAGE_LENGTH = 280;

/**
 * Sends a chat message scoped to the current meeting
 * (`chat/{roomCode}/{meetingId}/{messageId}`). Security rules restrict
 * writes to the sender's own `senderUid` and enforce the 280-character
 * limit (see database.rules.json `chat` section).
 */
export async function sendChatMessage(
  roomCode: string,
  meetingId: string,
  senderUid: string,
  senderName: string,
  text: string
): Promise<void> {
  const trimmed = text.trim().slice(0, MAX_MESSAGE_LENGTH);
  if (!trimmed) return;

  const messagesRef = ref(db, `chat/${roomCode}/${meetingId}`);
  const newMessageRef = push(messagesRef);

  await set(newMessageRef, {
    id: newMessageRef.key,
    senderUid,
    senderName,
    text: trimmed,
    timestamp: serverTimestamp(),
  });
}
