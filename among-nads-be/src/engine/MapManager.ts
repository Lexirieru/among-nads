export enum RoomType {
  ENGINE_ROOM = "Engine Room",
  WEAPONS_TOP = "Weapons (Top)",
  WEAPONS_BOTTOM = "Weapons (Bottom)",
  MEDBAY = "MedBay",
  CAFETERIA = "Cafeteria",
  STORAGE = "Storage",
  ADMIN = "Admin",
  NAVIGATION = "Navigation",
  BRIDGE = "Bridge",
  SHIELDS = "Shields",
  HALLWAY = "Hallway",
}

export interface Room {
  id: RoomType;
  connections: RoomType[];
  hasVent: boolean;
  hasTask: boolean;
}

export const SPACESHIP_MAP: Record<RoomType, Room> = {
  [RoomType.ENGINE_ROOM]: {
    id: RoomType.ENGINE_ROOM,
    connections: [RoomType.WEAPONS_TOP, RoomType.WEAPONS_BOTTOM, RoomType.CAFETERIA],
    hasVent: true,
    hasTask: true,
  },
  [RoomType.WEAPONS_TOP]: {
    id: RoomType.WEAPONS_TOP,
    connections: [RoomType.ENGINE_ROOM, RoomType.CAFETERIA, RoomType.MEDBAY],
    hasVent: true,
    hasTask: true,
  },
  [RoomType.WEAPONS_BOTTOM]: {
    id: RoomType.WEAPONS_BOTTOM,
    connections: [RoomType.ENGINE_ROOM, RoomType.STORAGE],
    hasVent: true,
    hasTask: true,
  },
  [RoomType.MEDBAY]: {
    id: RoomType.MEDBAY,
    connections: [RoomType.WEAPONS_TOP, RoomType.CAFETERIA],
    hasVent: true,
    hasTask: true,
  },
  [RoomType.CAFETERIA]: {
    id: RoomType.CAFETERIA,
    connections: [
      RoomType.ENGINE_ROOM,
      RoomType.WEAPONS_TOP,
      RoomType.MEDBAY,
      RoomType.STORAGE,
      RoomType.ADMIN,
      RoomType.NAVIGATION,
    ],
    hasVent: false,
    hasTask: true,
  },
  [RoomType.ADMIN]: {
    id: RoomType.ADMIN,
    connections: [RoomType.CAFETERIA, RoomType.STORAGE, RoomType.NAVIGATION],
    hasVent: false,
    hasTask: true,
  },
  [RoomType.STORAGE]: {
    id: RoomType.STORAGE,
    connections: [RoomType.WEAPONS_BOTTOM, RoomType.CAFETERIA, RoomType.ADMIN, RoomType.SHIELDS],
    hasVent: false,
    hasTask: true,
  },
  [RoomType.NAVIGATION]: {
    id: RoomType.NAVIGATION,
    connections: [RoomType.CAFETERIA, RoomType.ADMIN, RoomType.BRIDGE, RoomType.SHIELDS],
    hasVent: true,
    hasTask: true,
  },
  [RoomType.BRIDGE]: {
    id: RoomType.BRIDGE,
    connections: [RoomType.NAVIGATION, RoomType.SHIELDS],
    hasVent: false,
    hasTask: true,
  },
  [RoomType.SHIELDS]: {
    id: RoomType.SHIELDS,
    connections: [RoomType.STORAGE, RoomType.NAVIGATION, RoomType.BRIDGE],
    hasVent: true,
    hasTask: true,
  },
  [RoomType.HALLWAY]: {
    id: RoomType.HALLWAY,
    connections: [],
    hasVent: false,
    hasTask: false,
  },
};

// ---------------------------------------------------------------------------
// Waypoint network — every point is in % matching the frontend ROOM_COORDS
// coordinate space (x: 0-100 left→right, y: 0-100 top→bottom).
// Room centres are the "anchor" waypoints where characters linger.
// Corridor waypoints sit at doorways / bends so the path follows the hallways
// visible in amongnads-map.png.
// ---------------------------------------------------------------------------

interface Pos { x: number; y: number; }

/** Centre of each room (linger targets). Must match frontend ROOM_COORDS. */
const ROOM_CENTER: Record<RoomType, Pos> = {
  [RoomType.ENGINE_ROOM]:     { x: 10, y: 50 },
  [RoomType.WEAPONS_TOP]:     { x: 22, y: 22 },
  [RoomType.WEAPONS_BOTTOM]:  { x: 22, y: 75 },
  [RoomType.MEDBAY]:          { x: 34, y: 40 },
  [RoomType.CAFETERIA]:       { x: 50, y: 20 },
  [RoomType.STORAGE]:         { x: 48, y: 65 },
  [RoomType.ADMIN]:           { x: 60, y: 48 },
  [RoomType.NAVIGATION]:      { x: 73, y: 18 },
  [RoomType.SHIELDS]:         { x: 73, y: 72 },
  [RoomType.BRIDGE]:          { x: 92, y: 50 },
  [RoomType.HALLWAY]:         { x: 50, y: 50 },
};

/**
 * Corridor waypoints for each directed edge A→B.
 * These are the intermediate points the character walks through between
 * leaving room A's centre and arriving at room B's centre.
 * Key is "A|B". The array does NOT include A's centre or B's centre —
 * those are prepended / appended automatically.
 *
 * Designed by tracing the hallways in amongnads-map.png:
 *   - Left side:  Engine ↔ WeaponsTop  via left vertical corridor
 *   - Left side:  Engine ↔ WeaponsBot  via left vertical corridor
 *   - Top:        WeaponsTop ↔ Cafeteria  via upper corridor
 *   - Mid-left:   WeaponsTop ↔ MedBay  short horizontal
 *   - Mid-left:   MedBay ↔ Cafeteria  via doorway
 *   - Center:     Cafeteria ↔ Storage  via central vertical corridor
 *   - Center:     Cafeteria ↔ Admin  via central junction
 *   - Right-top:  Cafeteria ↔ Navigation  via top corridor
 *   - Center:     Storage ↔ Admin  short horizontal
 *   - Center-bot: Storage ↔ WeaponsBot  via left-lower corridor
 *   - Center-bot: Storage ↔ Shields  via lower corridor
 *   - Right:      Admin ↔ Navigation  short vertical
 *   - Right:      Navigation ↔ Bridge  via right corridor
 *   - Right-bot:  Navigation ↔ Shields  via right vertical
 *   - Far-right:  Shields ↔ Bridge  via right corridor
 */
const CORRIDOR_WAYPOINTS: Record<string, Pos[]> = {
  // ── Engine Room ↔ Weapons Top  (left vertical corridor, go up) ──
  [`${RoomType.ENGINE_ROOM}|${RoomType.WEAPONS_TOP}`]:    [{ x: 13, y: 40 }, { x: 16, y: 28 }],
  [`${RoomType.WEAPONS_TOP}|${RoomType.ENGINE_ROOM}`]:    [{ x: 16, y: 28 }, { x: 13, y: 40 }],

  // ── Engine Room ↔ Weapons Bottom  (left vertical corridor, go down) ──
  [`${RoomType.ENGINE_ROOM}|${RoomType.WEAPONS_BOTTOM}`]: [{ x: 13, y: 60 }, { x: 16, y: 72 }],
  [`${RoomType.WEAPONS_BOTTOM}|${RoomType.ENGINE_ROOM}`]: [{ x: 16, y: 72 }, { x: 13, y: 60 }],

  // ── Engine Room ↔ Cafeteria  (long corridor up and right) ──
  [`${RoomType.ENGINE_ROOM}|${RoomType.CAFETERIA}`]:      [{ x: 15, y: 38 }, { x: 22, y: 15 }, { x: 35, y: 14 }],
  [`${RoomType.CAFETERIA}|${RoomType.ENGINE_ROOM}`]:      [{ x: 35, y: 14 }, { x: 22, y: 15 }, { x: 15, y: 38 }],

  // ── Weapons Top ↔ MedBay  (short horizontal) ──
  [`${RoomType.WEAPONS_TOP}|${RoomType.MEDBAY}`]:         [{ x: 27, y: 30 }],
  [`${RoomType.MEDBAY}|${RoomType.WEAPONS_TOP}`]:         [{ x: 27, y: 30 }],

  // ── Weapons Top ↔ Cafeteria  (corridor going right along top) ──
  [`${RoomType.WEAPONS_TOP}|${RoomType.CAFETERIA}`]:      [{ x: 30, y: 16 }, { x: 38, y: 16 }],
  [`${RoomType.CAFETERIA}|${RoomType.WEAPONS_TOP}`]:      [{ x: 38, y: 16 }, { x: 30, y: 16 }],

  // ── MedBay ↔ Cafeteria  (doorway up) ──
  [`${RoomType.MEDBAY}|${RoomType.CAFETERIA}`]:           [{ x: 38, y: 30 }, { x: 42, y: 22 }],
  [`${RoomType.CAFETERIA}|${RoomType.MEDBAY}`]:           [{ x: 42, y: 22 }, { x: 38, y: 30 }],

  // ── Cafeteria ↔ Storage  (central vertical corridor) ──
  [`${RoomType.CAFETERIA}|${RoomType.STORAGE}`]:          [{ x: 48, y: 30 }, { x: 48, y: 45 }, { x: 48, y: 57 }],
  [`${RoomType.STORAGE}|${RoomType.CAFETERIA}`]:          [{ x: 48, y: 57 }, { x: 48, y: 45 }, { x: 48, y: 30 }],

  // ── Cafeteria ↔ Admin  (down through central junction then right) ──
  [`${RoomType.CAFETERIA}|${RoomType.ADMIN}`]:            [{ x: 50, y: 30 }, { x: 55, y: 42 }],
  [`${RoomType.ADMIN}|${RoomType.CAFETERIA}`]:            [{ x: 55, y: 42 }, { x: 50, y: 30 }],

  // ── Cafeteria ↔ Navigation  (top corridor going right) ──
  [`${RoomType.CAFETERIA}|${RoomType.NAVIGATION}`]:       [{ x: 58, y: 16 }, { x: 65, y: 16 }],
  [`${RoomType.NAVIGATION}|${RoomType.CAFETERIA}`]:       [{ x: 65, y: 16 }, { x: 58, y: 16 }],

  // ── Weapons Bottom ↔ Storage  (corridor going right) ──
  [`${RoomType.WEAPONS_BOTTOM}|${RoomType.STORAGE}`]:     [{ x: 28, y: 78 }, { x: 35, y: 72 }, { x: 42, y: 68 }],
  [`${RoomType.STORAGE}|${RoomType.WEAPONS_BOTTOM}`]:     [{ x: 42, y: 68 }, { x: 35, y: 72 }, { x: 28, y: 78 }],

  // ── Storage ↔ Admin  (short corridor up-right) ──
  [`${RoomType.STORAGE}|${RoomType.ADMIN}`]:              [{ x: 54, y: 58 }],
  [`${RoomType.ADMIN}|${RoomType.STORAGE}`]:              [{ x: 54, y: 58 }],

  // ── Storage ↔ Shields  (lower corridor going right) ──
  [`${RoomType.STORAGE}|${RoomType.SHIELDS}`]:            [{ x: 55, y: 70 }, { x: 63, y: 74 }],
  [`${RoomType.SHIELDS}|${RoomType.STORAGE}`]:            [{ x: 63, y: 74 }, { x: 55, y: 70 }],

  // ── Admin ↔ Navigation  (short vertical) ──
  [`${RoomType.ADMIN}|${RoomType.NAVIGATION}`]:           [{ x: 64, y: 36 }, { x: 67, y: 24 }],
  [`${RoomType.NAVIGATION}|${RoomType.ADMIN}`]:           [{ x: 67, y: 24 }, { x: 64, y: 36 }],

  // ── Navigation ↔ Bridge  (right corridor) ──
  [`${RoomType.NAVIGATION}|${RoomType.BRIDGE}`]:          [{ x: 80, y: 22 }, { x: 86, y: 35 }],
  [`${RoomType.BRIDGE}|${RoomType.NAVIGATION}`]:          [{ x: 86, y: 35 }, { x: 80, y: 22 }],

  // ── Navigation ↔ Shields  (right vertical corridor) ──
  [`${RoomType.NAVIGATION}|${RoomType.SHIELDS}`]:         [{ x: 72, y: 35 }, { x: 72, y: 50 }, { x: 72, y: 62 }],
  [`${RoomType.SHIELDS}|${RoomType.NAVIGATION}`]:         [{ x: 72, y: 62 }, { x: 72, y: 50 }, { x: 72, y: 35 }],

  // ── Shields ↔ Bridge  (right corridor going up) ──
  [`${RoomType.SHIELDS}|${RoomType.BRIDGE}`]:             [{ x: 80, y: 65 }, { x: 86, y: 58 }],
  [`${RoomType.BRIDGE}|${RoomType.SHIELDS}`]:             [{ x: 86, y: 58 }, { x: 80, y: 65 }],
};

/** Build the full waypoint path for a directed edge: [roomA_center, ...corridor, roomB_center] */
function buildPath(from: RoomType, to: RoomType): Pos[] {
  const key = `${from}|${to}`;
  const mid = CORRIDOR_WAYPOINTS[key] || [];
  return [ROOM_CENTER[from], ...mid, ROOM_CENTER[to]];
}

// ---------------------------------------------------------------------------
// Per-player movement state (internal to MapManager)
// ---------------------------------------------------------------------------
interface PlayerMovement {
  room: RoomType;          // current logical room (updates when path completes)
  pos: Pos;                // current interpolated position
  path: Pos[];             // remaining waypoints to walk toward (next target is [0])
  idleTimer: number;       // ticks remaining before picking a new destination
}

// How many % units the character moves per tick (1 s).
// Tuned so crossing a mid-length corridor (~25 % diagonal) takes ~4-5 ticks.
const MOVE_SPEED = 6;

// How long (ticks) a character lingers in a room before picking a new destination.
// Randomised per-idle between MIN and MAX.
const IDLE_MIN = 2;
const IDLE_MAX = 5;

export class MapManager {
  private players: Record<string, PlayerMovement> = {};

  constructor() {}

  // ── Public API ──────────────────────────────────────────────────────────

  public spawnPlayer(playerId: string) {
    const center = ROOM_CENTER[RoomType.CAFETERIA];
    this.players[playerId] = {
      room: RoomType.CAFETERIA,
      pos: { ...center },
      path: [],
      idleTimer: 0,
    };
  }

  /** Advance all players one tick (call once per second from GameEngine). */
  public tickMovement() {
    for (const id of Object.keys(this.players)) {
      this.tickPlayer(id);
    }
  }

  /** Get the current (x, y) position of a player in %. */
  public getPosition(playerId: string): Pos {
    return this.players[playerId]?.pos ?? ROOM_CENTER[RoomType.CAFETERIA];
  }

  /** Get the current logical room of a player. */
  public getRoom(playerId: string): RoomType {
    return this.players[playerId]?.room ?? RoomType.CAFETERIA;
  }

  /** Freeze a player in place (e.g. when killed). They stop moving permanently. */
  public stopPlayer(playerId: string) {
    const p = this.players[playerId];
    if (!p) return;
    p.path = [];
    p.idleTimer = 999999; // effectively infinite
  }

  /** Remove a player (e.g. on reset). */
  public removePlayer(playerId: string) {
    delete this.players[playerId];
  }

  // Legacy helpers still used by GameEngine for kill-logic (same-room check)
  public getAdjacentRooms(room: RoomType): RoomType[] {
    if (!SPACESHIP_MAP[room]) return [];
    return SPACESHIP_MAP[room].connections;
  }

  // ── Internal ────────────────────────────────────────────────────────────

  private tickPlayer(id: string) {
    const p = this.players[id];
    if (!p) return;

    // If we have waypoints to walk toward, advance.
    if (p.path.length > 0) {
      const target = p.path[0];
      const dx = target.x - p.pos.x;
      const dy = target.y - p.pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= MOVE_SPEED) {
        // Arrived at this waypoint — snap and pop.
        p.pos = { ...target };
        p.path.shift();

        // If path is now empty we've reached the destination room centre.
        if (p.path.length === 0) {
          // Update logical room to the destination
          // (the last waypoint we snapped to IS the room centre we targeted)
          p.room = this.findRoomAtPos(p.pos);
          p.idleTimer = IDLE_MIN + Math.floor(Math.random() * (IDLE_MAX - IDLE_MIN + 1));
        }
      } else {
        // Move toward target at MOVE_SPEED per tick.
        const ratio = MOVE_SPEED / dist;
        p.pos = {
          x: p.pos.x + dx * ratio,
          y: p.pos.y + dy * ratio,
        };
      }
      return;
    }

    // Idle: count down, then pick a new destination.
    if (p.idleTimer > 0) {
      p.idleTimer--;
      return;
    }

    // Pick a random adjacent room and build the corridor path.
    this.pickNewDestination(id);
  }

  private pickNewDestination(id: string) {
    const p = this.players[id];
    if (!p) return;

    const connections = SPACESHIP_MAP[p.room]?.connections;
    if (!connections || connections.length === 0) return;

    const target = connections[Math.floor(Math.random() * connections.length)];
    const fullPath = buildPath(p.room, target);

    // Drop the first element (current room centre — we're already there).
    p.path = fullPath.slice(1);
  }

  /** Given a position, find which room centre it matches (or closest). */
  private findRoomAtPos(pos: Pos): RoomType {
    let best: RoomType = RoomType.CAFETERIA;
    let bestDist = Infinity;
    for (const [room, centre] of Object.entries(ROOM_CENTER) as [RoomType, Pos][]) {
      const dx = pos.x - centre.x;
      const dy = pos.y - centre.y;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        best = room;
      }
    }
    return best;
  }
}
