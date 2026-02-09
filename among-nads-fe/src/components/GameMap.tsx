import { useMemo, useState, useEffect } from 'react';
import { RoomType } from '@/types';
import { useSmoothedPositions } from '@/hooks/useSmoothedPositions';

interface GameMapProps {
    players: Record<string, any>;
    currentPlayerId?: string;
    messages?: { sender: string, content: string, timestamp?: number, type?: "chat" | "meeting" }[];
    phase: string;
    meetingContext?: {
        reporter?: string;
        bodyFound?: string;
        votesReceived: Record<string, string>;
    };
    winner?: string | null;
    sabotage?: { name: string; timer: number } | null;
}

// Posisi tengah tiap room, disesuaikan dengan gambar amongnads-map.png
const ROOM_COORDS: Record<RoomType, { x: number, y: number }> = {
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

/** Kembalikan src gambar yang tepat — selalu pakai karakter warna masing-masing */
function getAvatarSrc(player: any): string {
    return player.avatar || "/characters/molandak-black-tg.png";
}

export function GameMap({ players, currentPlayerId, messages, phase, meetingContext, winner, sabotage }: GameMapProps) {
    // Build target positions directly from server-sent x/y (waypoint-driven).
    // Fallback to ROOM_COORDS only if x/y are missing (e.g. first lobby tick).
    const targetPositions = useMemo(() => {
        const targets: Record<string, { x: number; y: number }> = {};
        Object.values(players).forEach((player: any) => {
            if (player.x != null && player.y != null) {
                targets[player.id] = { x: player.x, y: player.y };
            } else {
                const room = (player.room || RoomType.CAFETERIA) as RoomType;
                const coords = ROOM_COORDS[room] || ROOM_COORDS[RoomType.CAFETERIA];
                targets[player.id] = { x: coords.x, y: coords.y };
            }
        });
        return targets;
    }, [players]);

    // Smoothly interpolated positions (lerp each frame, like moltbook-town).
    const smoothedPositions = useSmoothedPositions(targetPositions);

    // Derived Meeting Data
    const reporter = meetingContext?.reporter ? players[meetingContext.reporter] : null;
    const body = meetingContext?.bodyFound ? players[meetingContext.bodyFound] : null;
    const recentMessages = messages ? messages.filter((m) => m.type === "meeting").slice(-4) : [];

    // Two-stage meeting: 'intro' shows the emergency image, 'discuss' shows the panel.
    // Resets to 'intro' every time the phase flips back to MEETING.
    const [meetingStage, setMeetingStage] = useState<'intro' | 'discuss'>('intro');

    useEffect(() => {
        if (phase === 'MEETING') {
            setMeetingStage('intro');
            const timer = setTimeout(() => setMeetingStage('discuss'), 2500);
            return () => clearTimeout(timer);
        }
    }, [phase]);

    return (
        <div className="relative w-full rounded-xl overflow-hidden border border-slate-700 shadow-2xl" style={{ aspectRatio: '11 / 6' }}>
            {/* Map background image */}
            <img src="/maps/amongnads-map.png" alt="Among Nads Map" className="absolute inset-0 w-full h-full object-cover" />

            {/* Draw Players - HIDE during meeting to focus on overlay */}
            {phase !== 'MEETING' && Object.values(players).map((player: any, i) => {
                 // Use smoothed (lerped) position; skip render until first interpolation tick.
                 const pos = smoothedPositions[player.id];
                 if (!pos) return null;

                 return (
                    <div
                        key={player.id || i}
                        className="absolute flex flex-col items-center transform -translate-x-1/2 -translate-y-1/2 z-20"
                        style={{ left: `${pos.x}%`, top: `${pos.y}%`, willChange: 'transform' }}
                    >
                        {/* Avatar */}
                        <div
                            className={`relative w-12 h-12 sm:w-16 sm:h-16 ${!player.alive ? 'grayscale opacity-60' : ''}`}
                            style={player.alive && player.role === 'Impostor' ? { filter: 'drop-shadow(0 0 6px #ef4444)' } : {}}
                        >
                            <img
                                src={getAvatarSrc(player)}
                                alt={player.name}
                                className="w-full h-full object-contain"
                            />
                            {!player.alive && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-2xl drop-shadow-lg" style={{ textShadow: '0 0 4px #000' }}>💀</span>
                                </div>
                            )}
                        </div>
                        
                        {/* Name Label */}
                        <div className={`mt-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-sm rounded text-[8px] text-white font-mono whitespace-nowrap ${player.role === 'Impostor' ? 'text-red-400' : ''}`}>
                            {player.name || player.id.slice(0,8)}
                        </div>
                    </div>
                 );
            })}
            
            {/* SABOTAGE WARNING BANNER — shown at top of map during active sabotage */}
            {phase === 'ACTION' && sabotage && (
                <div className="absolute top-0 left-0 right-0 z-30 bg-red-900/90 border-b border-red-700 px-4 py-2 flex items-center justify-center gap-3 animate-pulse">
                    <span className="text-red-200 text-xs font-black uppercase tracking-widest">
                        {sabotage.name}
                    </span>
                    <span className="text-red-300 text-xs font-bold">
                        — Fix in {sabotage.timer}s or lose
                    </span>
                </div>
            )}

            {/* ENDED OVERLAY */}
            {phase === 'ENDED' && winner && (() => {
                const crewWon = winner.includes("Crewmates");
                const crewmates = Object.values(players).filter((p: any) => p.role === 'Crewmate');
                const impostors = Object.values(players).filter((p: any) => p.role === 'Impostor');

                return (
                    <div className="absolute inset-0 bg-slate-900/97 flex flex-col items-center justify-center z-50 animate-in fade-in duration-500 p-4">
                        {/* Winner Banner */}
                        <div className="text-center mb-2">
                            <div className={`text-[10px] font-bold tracking-widest uppercase mb-1 ${crewWon ? 'text-blue-400' : 'text-red-400'}`}>
                                GAME OVER
                            </div>
                            <h2 className={`text-4xl md:text-6xl font-black uppercase italic drop-shadow-lg ${crewWon ? 'text-blue-400' : 'text-red-500'}`} style={crewWon ? {} : { textShadow: '0 0 20px rgba(239,68,68,0.6)' }}>
                                {crewWon ? 'CREWMATES WIN' : 'IMPOSTORS WIN'}
                            </h2>
                            <p className="text-slate-500 text-xs mt-2 font-bold">
                                {winner === 'Time Limit Reached'
                                    ? 'The impostors survived long enough.'
                                    : winner?.includes('Sabotage')
                                        ? 'Critical sabotage was not repaired in time.'
                                        : winner?.includes('Tasks')
                                            ? 'The crew completed all tasks.'
                                            : crewWon
                                                ? 'All impostors have been eliminated.'
                                                : 'The impostors outnumbered the crew.'}
                            </p>
                        </div>

                        {/* Player Roster — two columns */}
                        <div className="flex gap-4 mt-4 w-full max-w-2xl">
                            {/* Crewmates */}
                            <div className="flex-1 bg-slate-950/60 border border-blue-900/40 rounded-xl p-3">
                                <div className={`text-[10px] font-bold tracking-widest mb-2 text-center uppercase ${crewWon ? 'text-blue-400' : 'text-blue-600'}`}>
                                    Crewmates {crewWon && '— VICTORY'}
                                </div>
                                <div className="space-y-1.5">
                                    {crewmates.map((p: any) => (
                                        <div key={p.id} className={`flex items-center gap-2 px-2 py-1 rounded-lg ${p.alive ? 'bg-blue-900/20' : 'bg-slate-800/40 opacity-50'}`}>
                                            <div className={`w-7 h-7 flex-shrink-0 ${!p.alive ? 'grayscale' : ''}`}>
                                                <img src={p.avatar || '/characters/molandak-black-tg.png'} alt={p.name} className="w-full h-full object-contain" />
                                            </div>
                                            <span className="text-xs text-slate-300 truncate">{p.name}</span>
                                            {!p.alive && <span className="ml-auto text-[9px] text-red-400 font-bold flex-shrink-0">DEAD</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Impostors */}
                            <div className="flex-1 bg-slate-950/60 border border-red-900/40 rounded-xl p-3">
                                <div className={`text-[10px] font-bold tracking-widest mb-2 text-center uppercase ${!crewWon ? 'text-red-400' : 'text-red-700'}`}>
                                    Impostors {!crewWon && '— VICTORY'}
                                </div>
                                <div className="space-y-1.5">
                                    {impostors.map((p: any) => (
                                        <div key={p.id} className={`flex items-center gap-2 px-2 py-1 rounded-lg ${p.alive ? 'bg-red-900/20' : 'bg-slate-800/40 opacity-50'}`}>
                                            <div className={`w-7 h-7 flex-shrink-0 ${!p.alive ? 'grayscale' : ''}`}>
                                                <img src={p.avatar || '/characters/molandak-black-tg.png'} alt={p.name} className="w-full h-full object-contain" />
                                            </div>
                                            <span className="text-xs text-slate-300 truncate">{p.name}</span>
                                            {!p.alive && <span className="ml-auto text-[9px] text-red-400 font-bold flex-shrink-0">DEAD</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* MEETING OVERLAY */}
            {phase === 'MEETING' && (
                <div className="absolute inset-0 z-50">

                    {/* STAGE 1 — Emergency image burst (auto-dismisses after 2.5s) */}
                    {meetingStage === 'intro' && (
                        <div className="absolute inset-0 animate-red-flash flex items-center justify-center">
                            <img
                                src="/among-nads-emergency-meeting-tg.png"
                                alt="Emergency Meeting"
                                className="animate-meeting-burst max-w-[90%] max-h-[90%] object-contain drop-shadow-2xl"
                            />
                        </div>
                    )}

                    {/* STAGE 2 — Discuss panel */}
                    {meetingStage === 'discuss' && (
                        <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center animate-in fade-in duration-300 p-4">

                            {/* Header */}
                            <div className="text-center mb-6">
                                <h2 className="text-3xl md:text-5xl font-black text-red-500 animate-pulse uppercase italic">
                                    {meetingContext?.bodyFound ? "DEAD BODY REPORTED" : "EMERGENCY MEETING"}
                                </h2>
                                {meetingContext?.bodyFound && body && (
                                    <div className="text-slate-400 mt-2 text-sm font-bold flex items-center gap-2 justify-center">
                                        <span>Found body of </span>
                                        <span className="bg-red-900/50 px-2 py-1 rounded text-red-200">{body.name}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex w-full max-w-5xl gap-6 h-[60%]">

                                {/* LEFT: Player Grid & Voting */}
                                <div className="flex-1 bg-slate-950/50 rounded-xl border border-slate-700 p-4 overflow-y-auto">
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        {Object.values(players).map((p: any) => {
                                            const hasVoted = meetingContext?.votesReceived && meetingContext.votesReceived[p.id];
                                            return (
                                                <div key={p.id} className={`flex items-center gap-3 p-2 rounded-lg border ${p.alive ? 'bg-slate-800 border-slate-700' : 'bg-red-900/20 border-red-900/50 opacity-60'}`}>
                                                    <div className={`w-12 h-12 flex-shrink-0 ${!p.alive ? 'grayscale opacity-60' : ''}`}>
                                                        <img src={p.avatar || "/characters/molandak-black-tg.png"} alt={p.name} className="w-full h-full object-contain" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold truncate text-slate-200">{p.name}</div>
                                                        {hasVoted && (
                                                            <div className="text-[10px] text-green-400 font-bold">VOTED</div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                                {/* RIGHT: Discussion Bubbles */}
                                <div className="flex-1 bg-slate-800/50 rounded-xl border border-slate-700 p-4 flex flex-col relative overflow-hidden">
                                    <div className="text-xs font-bold text-slate-500 mb-2 uppercase tracking-widest">DISCUSS!</div>

                                    <div className="space-y-3 overflow-y-auto flex-1 flex flex-col justify-end">
                                        {recentMessages.map((msg, idx) => {
                                            const sender = players[msg.sender];
                                            return (
                                                <div key={idx} className="flex gap-3 animate-in slide-in-from-bottom-2 fade-in duration-300">
                                                     <div className="w-10 h-10 flex-shrink-0">
                                                        <img src={sender?.avatar || "/characters/molandak-black-tg.png"} alt={sender?.name} className="w-full h-full object-contain" />
                                                     </div>
                                                     <div className="bg-white text-black p-2 rounded-lg rounded-tl-none shadow-lg max-w-[80%]">
                                                         <div className="text-[10px] font-bold text-slate-500 mb-0.5">{sender?.name || 'Unknown'}</div>
                                                         <div className="text-xs font-medium leading-relaxed">{msg.content}</div>
                                                     </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>

                            </div>

                        </div>
                    )}

                </div>
            )}
        </div>
    );
}
