import { useEffect, useState } from 'react';
import { onValue, ref, query, limitToLast } from 'firebase/database';
import { db } from '@/lib/firebase';
import type { ChatMessage } from '@/types';

const MAX_MESSAGES = 100;

/**
 * Subscribes to chat messages for the given meeting, returning them
 * sorted oldest-first. Returns an empty array while `meetingId` is null
 * (no active meeting).
 */
export function useMeetingChat(roomCode: string | null, meetingId: string | null): ChatMessage[] {
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!roomCode || !meetingId) {
      setMessages([]);
      return;
    }

    const messagesRef = query(ref(db, `chat/${roomCode}/${meetingId}`), limitToLast(MAX_MESSAGES));
    const unsubscribe = onValue(messagesRef, (snapshot) => {
      const value = (snapshot.val() ?? {}) as Record<string, ChatMessage>;
      const list = Object.values(value).sort((a, b) => a.timestamp - b.timestamp);
      setMessages(list);
    });

    return () => unsubscribe();
  }, [roomCode, meetingId]);

  return messages;
}
