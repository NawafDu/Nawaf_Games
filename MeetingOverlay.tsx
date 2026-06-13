import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { useMeetingChat } from '@/hooks/useMeetingChat';
import { sendChatMessage } from '@/lib/chatService';
import { castVote } from '@/lib/gameActions/meetings';
import { withDevLatency } from '@/lib/devtools/devToolsStore';
import type { GameState, RoomPlayer } from '@/types';

interface MeetingOverlayProps {
  roomCode: string;
  game: GameState;
  myUid: string;
  roomPlayers: Record<string, RoomPlayer>;
}

export default function MeetingOverlay({ roomCode, game, myUid, roomPlayers }: MeetingOverlayProps) {
  const meeting = game.meeting;
  if (!meeting) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-40 bg-ink-950 flex flex-col safe-top safe-bottom"
    >
      <MeetingHeader meeting={meeting} roomPlayers={roomPlayers} />

      {meeting.phase === 'discussion' && (
        <DiscussionView roomCode={roomCode} meeting={meeting} myUid={myUid} roomPlayers={roomPlayers} />
      )}
      {meeting.phase === 'voting' && (
        <VotingView roomCode={roomCode} game={game} myUid={myUid} roomPlayers={roomPlayers} />
      )}
      {meeting.phase === 'results' && <ResultsView game={game} roomPlayers={roomPlayers} />}
    </motion.div>
  );
}

function MeetingHeader({
  meeting,
  roomPlayers,
}: {
  meeting: NonNullable<GameState['meeting']>;
  roomPlayers: Record<string, RoomPlayer>;
}) {
  const title =
    meeting.type === 'body_report'
      ? `Body Found${meeting.reportedBody ? ` — ${roomPlayers[meeting.reportedBody]?.displayName ?? 'Unknown'}` : ''}`
      : `Emergency Meeting — called by ${roomPlayers[meeting.calledBy]?.displayName ?? 'Unknown'}`;

  const phaseLabel: Record<typeof meeting.phase, string> = {
    discussion: 'Discussion',
    voting: 'Voting',
    results: 'Results',
    closed: 'Closed',
  };

  return (
    <div className="px-4 py-3 border-b border-ink-700 text-center">
      <h2 className="font-display text-base text-white">{title}</h2>
      <p className="text-xs text-white/40 mt-0.5">{phaseLabel[meeting.phase]}</p>
    </div>
  );
}

function Countdown({ endsAt }: { endsAt: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  const remainingSec = Math.max(0, Math.ceil((endsAt - now) / 1000));
  return <span className="tabular-nums">{remainingSec}s</span>;
}

function DiscussionView({
  roomCode,
  meeting,
  myUid,
  roomPlayers,
}: {
  roomCode: string;
  meeting: NonNullable<GameState['meeting']>;
  myUid: string;
  roomPlayers: Record<string, RoomPlayer>;
}) {
  const messages = useMeetingChat(roomCode, meeting.id);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    const myName = roomPlayers[myUid]?.displayName ?? 'Player';
    setSending(true);
    setDraft('');
    try {
      await sendChatMessage(roomCode, meeting.id, myUid, myName, text);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-2 text-center text-xs text-white/50 border-b border-ink-800">
        Voting begins in <Countdown endsAt={meeting.discussionEndsAt} />
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-center text-xs text-white/30 mt-8">No messages yet. Discuss what happened.</p>
        )}
        {messages.map((msg) => {
          const isMine = msg.senderUid === myUid;
          const rp = roomPlayers[msg.senderUid];
          return (
            <div key={msg.id} className={`flex items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
              {!isMine && <Avatar avatarId={rp?.avatarId ?? 'orb'} colorId={rp?.colorId ?? 'teal'} size={28} />}
              <div className={`max-w-[75%] ${isMine ? 'text-right' : 'text-left'}`}>
                {!isMine && <div className="text-[10px] text-white/40 mb-0.5">{msg.senderName}</div>}
                <div
                  className={[
                    'inline-block rounded-2xl px-3 py-2 text-sm break-words',
                    isMine ? 'bg-signal text-ink-950' : 'bg-ink-800 text-white',
                  ].join(' ')}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-3 py-3 border-t border-ink-700 flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          maxLength={280}
          placeholder="Type a message..."
          className="flex-1 bg-ink-800 border border-ink-700 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-signal"
        />
        <Button
          onClick={handleSend}
          pending={sending}
          disabled={!draft.trim()}
          className="!min-h-0 !px-4 !py-2.5 rounded-full"
        >
          Send
        </Button>
      </div>
    </div>
  );
}

function VotingView({
  roomCode,
  game,
  myUid,
  roomPlayers,
}: {
  roomCode: string;
  game: GameState;
  myUid: string;
  roomPlayers: Record<string, RoomPlayer>;
}) {
  const meeting = game.meeting!;
  const myVote = meeting.votes[myUid];
  const [pending, setPending] = useState(false);

  const livingPlayers = Object.values(game.players).filter((p) => p.alive);
  const me = game.players[myUid];
  const canVote = me?.alive && !myVote;

  const handleVote = async (targetUid: string) => {
    if (!canVote || pending) return;
    setPending(true);
    try {
      await withDevLatency(() => castVote(roomCode, myUid, targetUid));
    } catch {
      /* error surfaced via state not changing; player can retry */
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 py-2 text-center text-xs text-white/50 border-b border-ink-800">
        Results in <Countdown endsAt={meeting.votingEndsAt} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {!me?.alive && (
          <p className="text-center text-xs text-white/40 mb-4">You were eliminated and cannot vote.</p>
        )}

        <div className="grid grid-cols-3 gap-3">
          {livingPlayers.map((player) => {
            const rp = roomPlayers[player.uid];
            const isSelected = myVote === player.uid;
            return (
              <button
                key={player.uid}
                type="button"
                disabled={!canVote || pending}
                onClick={() => handleVote(player.uid)}
                className={[
                  'flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 transition-colors min-h-[44px]',
                  isSelected ? 'border-signal bg-signal/10' : 'border-ink-700 bg-ink-900',
                  !canVote ? 'opacity-50' : 'active:bg-ink-800',
                ].join(' ')}
              >
                <Avatar avatarId={rp?.avatarId ?? 'orb'} colorId={rp?.colorId ?? 'teal'} size={40} />
                <span className="text-xs text-white/80 truncate w-full text-center">
                  {rp?.displayName ?? '?'}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!canVote || pending}
          onClick={() => handleVote('skip')}
          className={[
            'w-full mt-4 rounded-xl border-2 py-3 text-sm font-medium transition-colors min-h-[44px]',
            myVote === 'skip' ? 'border-signal bg-signal/10 text-signal' : 'border-ink-700 bg-ink-900 text-white/70',
            !canVote ? 'opacity-50' : 'active:bg-ink-800',
          ].join(' ')}
        >
          Skip Vote
        </button>

        {myVote && <p className="text-center text-xs text-white/40 mt-3">Your vote is locked in.</p>}
      </div>
    </div>
  );
}

function ResultsView({ game, roomPlayers }: { game: GameState; roomPlayers: Record<string, RoomPlayer> }) {
  const meeting = game.meeting!;
  const result = meeting.result;

  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-white/50 text-sm">Tallying votes...</p>
      </div>
    );
  }

  const ejected = result.ejectedUid ? roomPlayers[result.ejectedUid] : null;
  const ejectedPlayer = result.ejectedUid ? game.players[result.ejectedUid] : null;
  const revealRole = game.settings.revealRoleOnElimination;
  const skipCount = result.tally.skip ?? 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 text-center">
      {result.wasTie ? (
        <>
          <p className="text-white/60 text-sm">The vote was tied.</p>
          <p className="font-display text-lg text-white">No one was ejected.</p>
        </>
      ) : ejected && ejectedPlayer ? (
        <>
          <Avatar avatarId={ejected.avatarId} colorId={ejected.colorId} size={72} />
          <div>
            <p className="font-display text-lg text-white">{ejected.displayName} was ejected.</p>
            {revealRole && (
              <p className="text-sm text-white/50 mt-1">
                They were a{' '}
                <span className={ejectedPlayer.role === 'saboteur' ? 'text-alert' : 'text-signal'}>
                  {ejectedPlayer.role === 'saboteur' ? 'Saboteur' : 'Citizen'}
                </span>
                .
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <p className="text-white/60 text-sm">Most players voted to skip.</p>
          <p className="font-display text-lg text-white">No one was ejected.</p>
        </>
      )}

      <div className="w-full max-w-xs space-y-1.5 mt-2">
        {Object.entries(result.tally)
          .sort((a, b) => b[1] - a[1])
          .map(([candidate, count]) => {
            if (candidate === 'skip') return null;
            const rp = roomPlayers[candidate];
            return (
              <div key={candidate} className="flex items-center justify-between text-xs text-white/50">
                <span>{rp?.displayName ?? 'Unknown'}</span>
                <span className="tabular-nums">
                  {count} vote{count !== 1 ? 's' : ''}
                </span>
              </div>
            );
          })}
        {skipCount > 0 && (
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>Skip</span>
            <span className="tabular-nums">
              {skipCount} vote{skipCount !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
