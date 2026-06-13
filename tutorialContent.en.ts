// -----------------------------------------------------------------------
// Tutorial content (English).
//
// Written specifically for Shadow Circuit's implemented mechanics, for a
// reader who has never played any social deduction game before. Each
// section becomes one swipeable card in the Tutorial screen.
//
// Keep this in sync with src/types/index.ts (settings ranges/defaults)
// and src/lib/mapGenerator.ts / future Phase 3 gameplay modules — if a
// mechanic changes, update the relevant section here.
// -----------------------------------------------------------------------

export interface TutorialSection {
  id: string;
  emoji: string;
  title: string;
  body: string[]; // paragraphs
  example?: { label: string; text: string };
  // Small "at a glance" bullet list shown as chips — used for sections
  // where a quick visual summary helps (roles, icons used in-game, etc.)
  chips?: string[];
}

export const TUTORIAL_SECTIONS_EN: TutorialSection[] = [
  {
    id: 'objective',
    emoji: '🎯',
    title: 'What Is This Game?',
    body: [
      "Shadow Circuit is a game for 4 to 12 players. At the start of every match, the game secretly gives each player a hidden role: Citizen or Saboteur. Nobody can see anyone else's role.",
      'Citizens want to either finish all of their tasks as a team, or figure out who the Saboteurs are and vote them out before it\'s too late.',
      "Saboteurs want to secretly eliminate Citizens, one at a time, while pretending to be normal Citizens — until there are as many Saboteurs left as Citizens.",
      'The game is played entirely on your phone. You move between locations, do small activities, talk with other players in a chat box, and vote.',
    ],
    example: {
      label: 'In short',
      text: 'It\'s a game of "who do you trust?" — everyone looks the same, but some players are secretly trying to take the group down from the inside.',
    },
  },
  {
    id: 'roles',
    emoji: '🎭',
    title: 'Your Role: Citizen or Saboteur',
    body: [
      'When a match begins, you\'ll see a screen telling you your secret role. Only you can see this — keep it to yourself!',
      'Citizen (most players): You get a personal checklist of tasks scattered around the map. Your goals are to complete them, stay alive, and help spot Saboteurs.',
      'Saboteur (1–3 players, depending on group size): You also get a task checklist that looks identical to a Citizen\'s — but "completing" it doesn\'t actually help your team. It exists so you can blend in and look busy. Your real goal is to eliminate Citizens without getting caught.',
      'The number of Saboteurs depends on how many people are playing: with 4–6 players there\'s 1 Saboteur, with 7–9 players there can be 1–2, and with 10–12 players there can be 1–3. The host sets the exact number within that range.',
    ],
    chips: ['🟢 Citizen — complete tasks, find Saboteurs', '🔴 Saboteur — eliminate Citizens, stay hidden'],
    example: {
      label: 'Example',
      text: 'In a game with 8 players, the game might secretly choose 2 of them to be Saboteurs and the other 6 to be Citizens. If you\'re one of the 6, your screen says "Citizen." If you\'re one of the 2, your screen says "Saboteur" — and you also secretly know who your fellow Saboteur is.',
    },
  },
  {
    id: 'rounds',
    emoji: '🔁',
    title: 'How a Round Works',
    body: [
      'A "round" is one full match, from start to finish. Here\'s the overall flow:',
      '1. The host starts the match. Everyone gets their secret role and a personal task list. A map of locations is randomly created.',
      '2. Everyone spreads out, moves around the map, and works on tasks (or pretends to, if you\'re a Saboteur).',
      '3. At some point, a Saboteur eliminates a Citizen. Eventually someone finds the body and reports it — or someone calls an emergency meeting.',
      '4. Everyone discusses in the meeting, then votes on who to eject.',
      '5. Play resumes (move, do tasks, maybe more eliminations) until one side meets its win condition.',
      '6. When the round ends, everyone sees the result and returns to the lobby. The room stays open, so you can immediately start another round — the map and roles are randomized again.',
    ],
    example: {
      label: 'Example',
      text: 'A typical round might go: spread out → do a few tasks → a body is found → meeting and vote → an ejection happens → play continues → eventually either all tasks finish or one side runs out of people.',
    },
  },
  {
    id: 'movement',
    emoji: '🗺️',
    title: 'Moving Around the Map',
    body: [
      'Instead of a big open map you walk around freely, Shadow Circuit uses a node map — a set of location "cards" connected to each other, shown on your screen.',
      'Each location is connected to a few neighboring locations (usually 2 to 4). To move, tap a connected location — you arrive there instantly, no walking animation.',
      'After you move, there\'s a short cooldown before you can move again. How long depends on the Movement Speed setting: Very Slow (6 seconds), Slow (4 seconds), Normal (2.5 seconds), or Fast (1 second).',
      'Every new round, the map layout is randomly regenerated — which locations exist and how they connect changes each time, so you can\'t memorize a fixed path. But it\'s always guaranteed that you can reach any location from any other by hopping through neighbors.',
      'The map has between 6 and 12 locations, depending on the host\'s settings.',
    ],
    example: {
      label: 'Example scenario',
      text: 'You\'re in the "Cafeteria," which is connected to "Workshop" and "Storage." You tap "Workshop" and instantly move there. A small cooldown timer appears — once it finishes, you can move to one of Workshop\'s connected locations.',
    },
  },
  {
    id: 'tasks',
    emoji: '✅',
    title: 'Tasks: Your To-Do List',
    body: [
      'At the start of the match, everyone — Citizens and Saboteurs alike — gets a personal list of tasks. Each task is tied to one location on the map and is one of 9 quick activities: tap-timing, memory matching, pattern matching, sequence repeating, repair puzzles, logic puzzles, or filling a progress bar.',
      'Tasks come in three lengths — Short, Medium, and Long — and take a few seconds to a bit longer to finish. The host decides how many of each length are in the game.',
      'To do a task: move to the location shown on the task card, then tap the task to open the activity. Complete it to mark that task as done.',
      'If you\'re a Citizen: finishing your tasks is real progress — if every Citizen finishes every task, the Citizens win immediately, even if Saboteurs are still around.',
      'If you\'re a Saboteur: your tasks are fake. You can still play them (it looks completely normal to anyone watching), but finishing them doesn\'t count toward the Citizens\' task goal. Many Saboteurs play their fake tasks anyway, just to blend in.',
    ],
    example: {
      label: 'Example',
      text: 'Your task list shows "Sort Samples — Lab (Short)" and "Realign Antenna — Comms Tower (Long)." You travel to the Lab, tap the task, quickly match a few pairs in a memory minigame, and it\'s marked complete. Later you head to the Comms Tower for the longer one.',
    },
  },
  {
    id: 'eliminations',
    emoji: '🔪',
    title: 'Eliminations (If You\'re a Saboteur)',
    body: [
      'Only Saboteurs can eliminate other players. To eliminate someone, you need to be alone together with them at the same location — no other players around — and your kill cooldown must be finished.',
      'The kill cooldown is a timer that starts after each elimination, so Saboteurs can\'t eliminate people back-to-back instantly. The host sets this cooldown anywhere from 10 to 60 seconds (25 seconds by default).',
      'After an elimination, the eliminated player\'s "body" stays at that location until someone finds it. The eliminated player is now out of the round — but the game keeps going for everyone else.',
      'A smart Saboteur thinks about alibis: if you eliminate someone, can you explain where you were and what you were doing if people ask later?',
    ],
    chips: ['👤 Alone together = opportunity', '⏱️ Cooldown must be ready', '🕵️ Think about your alibi'],
    example: {
      label: 'Example scenario',
      text: 'You (a Saboteur) and one other player are the only two people in the "Server Room," and your kill cooldown bar is full. You eliminate them. Their body remains in the Server Room. You quickly move to a busy location so other players remember seeing you there "the whole time."',
    },
  },
  {
    id: 'witnessing',
    emoji: '👁️',
    title: 'Witnessing Suspicious Activity',
    body: [
      'You don\'t only know what happens in your own location — depending on the Visibility setting (Low, Medium, or High), you can sometimes notice things happening in neighboring locations too, like who recently entered or left.',
      'Citizens and Saboteurs can have different visibility settings — the host can make Saboteurs see less (so it\'s harder for them to plan safely) or Citizens see more (so it\'s easier to catch suspicious movement).',
      'This information becomes useful during meetings. If you were near a location around the time something happened, you might be able to say "I saw so-and-so leave that room right before the body was found there."',
      'Pay attention to where you are and when — your own movements are also part of the story other players can use.',
    ],
    example: {
      label: 'Example scenario',
      text: 'You\'re in the "Workshop," which is next to the "Server Room." With Medium or High visibility, you notice another player enter the Server Room a little while ago. Later, a body is reported in the Server Room. Now you have useful information to share at the meeting.',
    },
  },
  {
    id: 'reporting',
    emoji: '🚨',
    title: 'Reporting a Body',
    body: [
      'If you move to a location and find an eliminated player\'s body there, you\'ll see a "Report" button. Tapping it immediately starts a meeting for everyone.',
      'You don\'t have to report immediately if you don\'t want to — but the longer a body goes unreported, the more time Saboteurs have to act again (their kill cooldown keeps counting down).',
      'Anyone can report a body they find — Citizen or Saboteur. A Saboteur might even report a body themselves to look helpful and innocent.',
    ],
    example: {
      label: 'Example',
      text: 'You move into the "Med Bay" to do a task and instead find a body. You tap "Report" — a meeting starts immediately for all players, no matter where they currently are.',
    },
  },
  {
    id: 'meetings',
    emoji: '📢',
    title: 'Meetings',
    body: [
      'A meeting can start two ways: someone reports a body, or a player taps "Call Emergency Meeting" (this also has a cooldown, set by the host, so it can\'t be spammed).',
      'When a meeting starts, everyone stops moving and the screen switches to a Discussion phase with a countdown timer (the host sets this length, by default 45 seconds).',
      'During discussion, everyone talks using a text chat box — there\'s no voice chat. This is where you share what you saw, ask questions, defend yourself, or point fingers.',
      'When the discussion timer runs out, the game automatically moves to the Voting phase.',
    ],
    example: {
      label: 'Example scenario',
      text: 'A body is reported in the Greenhouse. Everyone is pulled into a meeting. In the chat, one player writes "I was in the Cafeteria the whole time with Quinn" while another says "I saw Vex leave the Greenhouse just before this." The 45-second timer counts down while everyone reads and responds.',
    },
  },
  {
    id: 'voting',
    emoji: '🗳️',
    title: 'Voting',
    body: [
      'When voting starts, every player sees a list of everyone still in the game. To vote, tap the avatar of the player you want to eject — or tap "Skip" if you don\'t want to vote anyone out.',
      'Voting is anonymous: nobody — not even the game host — can see who voted for whom while voting is happening. Your choice is private.',
      'You have until the voting timer runs out (the host sets this length, by default 30 seconds) to cast your vote. If you don\'t vote, it\'s treated the same as choosing Skip.',
      'When the timer ends, results are revealed all at once: the player with the most votes is ejected from the game immediately. Depending on the host\'s settings, the ejected player\'s role (Citizen or Saboteur) may be revealed to everyone, or kept secret.',
      'If there\'s a tie for the most votes (including ties with Skip), nobody is ejected and the round continues.',
    ],
    example: {
      label: 'Example',
      text: 'There are 7 players left. When voting ends: 3 votes for "Quinn," 2 votes for "Ryx," 2 votes for "Skip." Quinn has the most votes, so Quinn is ejected. If instead it had been 3 votes for Quinn, 3 for Ryx, and 1 Skip, that\'s a tie for first place — nobody is ejected.',
    },
  },
  {
    id: 'winning',
    emoji: '🏆',
    title: 'How Someone Wins',
    body: [
      'Citizens win immediately if either of these happens: every Citizen finishes every task on their list, OR every Saboteur has been ejected from the game.',
      'Saboteurs win immediately if the number of Saboteurs remaining becomes equal to or greater than the number of Citizens remaining — meaning enough Citizens have been eliminated or ejected that the Saboteurs effectively control the room.',
      'When either of these happens, the round ends right away, even if it\'s in the middle of movement or tasks. Everyone sees a result screen, then returns to the lobby.',
      'From the lobby, the host can start a new round with the same group — a fresh map and fresh roles are generated automatically.',
    ],
    example: {
      label: 'Example scenario',
      text: 'A match starts with 6 Citizens and 2 Saboteurs. If Saboteurs manage to eliminate 4 Citizens (leaving 2 Citizens and 2 Saboteurs), the Saboteurs win instantly — they now equal the Citizens in number. If instead the Citizens find and eject both Saboteurs first, the Citizens win instantly, even if some tasks are still unfinished.',
    },
  },
  {
    id: 'bots',
    emoji: '🤖',
    title: 'Playing With Bots',
    body: [
      'If you don\'t have enough friends online, you can add bots to fill empty seats — the host does this from the lobby with one tap, choosing Easy, Medium, or Hard difficulty.',
      'You can also play entirely solo using "Practice with Bots" from the home screen — every other seat is a bot, so you can learn the game at your own pace.',
      'Bots follow the exact same rules as human players. Citizen bots move around, do tasks, report bodies they find, and vote based only on what they\'ve personally seen — they don\'t secretly know who the Saboteurs are. Saboteur bots look for isolated targets, respect the kill cooldown, and try to act normal afterward.',
      'Harder bots pay closer attention to suspicious patterns (like someone\'s movements not matching their story) and vote more accurately because of it.',
    ],
    example: {
      label: 'Example',
      text: 'You start a Practice match with 7 bots (you\'re the 8th player). If you\'re a Citizen, some bots are also Citizens working on tasks, and 1–2 bots are secretly Saboteurs — you won\'t know which ones until eliminations or meetings give you clues, just like with real players.',
    },
  },
  {
    id: 'settings',
    emoji: '⚙️',
    title: 'Settings the Host Can Change',
    body: [
      'Before a match starts, the host can open Settings from the lobby and adjust:',
      '• Max Players (4–12) and number of Saboteurs (automatically limited to a safe range for your group size)',
      '• Number of map locations (6–12)',
      '• Movement Speed (Very Slow / Slow / Normal / Fast)',
      '• How many Short, Medium, and Long tasks each player gets',
      '• Kill Cooldown (10–60 seconds) and Meeting Cooldown',
      '• Citizen Visibility and Saboteur Visibility (Low / Medium / High), set separately',
      '• Discussion Time and Voting Time for meetings',
      '• Whether an ejected player\'s role is revealed',
      '• Bot Difficulty (Easy / Medium / Hard)',
      'These settings apply to the whole room and stay set for future rounds until the host changes them again.',
    ],
  },
  {
    id: 'tips',
    emoji: '💡',
    title: 'Quick Tips for New Players',
    body: [
      'Pay attention to who is where, and when. The most useful thing you can do — whether you\'re a Citizen trying to catch Saboteurs, or a Saboteur trying to build an alibi — is keep track of movement.',
      'Don\'t go everywhere alone if you\'re worried about Saboteurs — but don\'t be too scared to move, either, or you\'ll fall behind on tasks.',
      'During meetings, say what you actually saw, even if it seems small. Small details often matter more than big accusations.',
      'If you\'re a Saboteur, acting "too helpful" (instantly reporting bodies, accusing people confidently) can look suspicious — but so can being too quiet. Try to act like a normal Citizen would.',
      'It\'s okay to be wrong sometimes! Voting is anonymous, ties mean nobody is ejected, and a new round starts right after — every round is a fresh chance to do better.',
    ],
  },
];
