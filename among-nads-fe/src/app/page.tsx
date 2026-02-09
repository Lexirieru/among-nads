'use client'

import { useAccount } from 'wagmi'
import { useState, useEffect } from 'react'
import { useGameState } from '@/hooks/useGameState'
import { GameMap } from '@/components/GameMap'
import { ChatLog } from '@/components/ChatLog'
import { BettingPanel } from '@/components/BettingPanel'

export default function Home() {
  const { address, isConnected } = useAccount()
  const [isMounted, setIsMounted] = useState(false)
  
  // Auto-connect to sim-1
  const { gameState, isConnected: isBackendConnected, sendMessage } = useGameState("sim-1")

  useEffect(() => {
    setIsMounted(true)
  }, [])

  if (!isMounted) return null;

  return (
    <main className="text-white p-4 sm:px-8 sm:pb-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Game HUD bar */}
        <div className="flex items-center justify-between retro-panel p-3 rounded-lg">
          <div className="flex items-center gap-4">
             <div className={`flex items-center gap-2 text-[8px] font-pixel ${isBackendConnected ? 'text-[#88d8b0]' : 'text-[#ff6b6b]'}`}>
                 <div className={`w-2 h-2 rounded-full ${isBackendConnected ? 'bg-[#88d8b0]' : 'bg-[#ff6b6b]'} animate-pulse`} />
                 {isBackendConnected ? 'LIVE' : 'OFFLINE'}
             </div>
             <div className="text-[8px] text-[#a8d8ea] font-pixel">
                 PHASE: <span className="text-[#ffd700]">{gameState?.phase || 'SYNCING...'}</span>
             </div>
          </div>
          <div className="flex flex-col items-center">
              <span className="text-[7px] text-[#a8d8ea]/50 uppercase tracking-widest font-pixel">Timer</span>
              <div className={`text-lg font-pixel ${gameState?.timer && gameState.timer < 10 ? 'text-[#ff6b6b] animate-pulse text-glow-red' : 'text-[#ffd700] text-glow-gold'}`}>
                  {gameState?.timer || '00'}s
              </div>
          </div>
        </div>

        {/* ROW 1: Map (left) + Betting Panel (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-8">
                <GameMap
                    players={gameState?.players || {}}
                    currentPlayerId={address}
                    messages={gameState?.messages || []}
                    phase={gameState?.phase || 'LOBBY'}
                    meetingContext={gameState?.meetingContext}
                    winner={gameState?.winner}
                    sabotage={gameState?.sabotage}
                />
            </div>
            <div className="lg:col-span-4">
                <BettingPanel
                    phase={gameState?.phase || 'LOBBY'}
                    winner={gameState?.winner}
                    onChainGameId={gameState?.onChainGameId}
                    bettingOpen={gameState?.bettingOpen}
                    bettingTimer={gameState?.bettingTimer}
                    bettingOpensIn={gameState?.bettingOpensIn}
                />
            </div>
        </div>

        {/* ROW 2: Stats bar — full width */}
        {(() => {
            const phase = gameState?.phase || 'LOBBY';
            const showTasks = phase === 'ACTION' || phase === 'MEETING';
            const taskTotal = gameState?.taskProgress?.total || 0;
            const taskCompleted = gameState?.taskProgress?.completed || 0;
            return (
            <div className={`grid gap-3 ${showTasks ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <div className="retro-panel p-3 text-center">
                    <div className="text-lg font-pixel text-[#a8d8ea] text-glow-gold">{Object.values(gameState?.players || {}).filter(p => p.role !== 'Impostor' && p.alive).length}</div>
                    <div className="text-[8px] uppercase text-[#a8d8ea]/60 font-pixel tracking-wider">Crewmates</div>
                </div>
                <div className="retro-panel p-3 text-center">
                    <div className="text-lg font-pixel text-[#ff6b6b] text-glow-red">{Object.values(gameState?.players || {}).filter(p => p.role === 'Impostor' && p.alive).length}</div>
                    <div className="text-[8px] uppercase text-[#ff6b6b]/60 font-pixel tracking-wider">Impostors</div>
                </div>
                <div className="retro-panel border-[#ff6b6b]/30 p-3 text-center">
                    <div className="text-xl font-pixel text-[#ff6b6b] text-glow-red">
                        {Object.values(gameState?.players || {}).filter(p => !p.alive).length}
                    </div>
                    <div className="text-[8px] uppercase text-[#ff6b6b] font-pixel tracking-wider">DEAD</div>
                </div>
                {showTasks && (
                    <div className={`retro-panel p-3 flex flex-col justify-center ${gameState?.sabotage ? 'border-[#ff6b6b]/50' : ''}`}>
                        <div className="flex justify-between items-center mb-1.5">
                            <div className="text-[8px] uppercase text-[#88d8b0]/60 font-pixel tracking-wider">Tasks</div>
                            <div className="text-[8px] font-pixel text-[#88d8b0]">
                                {taskTotal > 0 ? `${taskCompleted}/${taskTotal}` : '—'}
                            </div>
                        </div>
                        <div className="w-full h-2 bg-[#0a1628] rounded-sm overflow-hidden">
                            <div
                                className="h-full bg-[#88d8b0] rounded-sm transition-all duration-500"
                                style={{ width: `${taskTotal > 0 ? (taskCompleted / taskTotal) * 100 : 0}%` }}
                            />
                        </div>
                        {gameState?.sabotage && (
                            <div className="mt-1.5 text-[7px] font-pixel text-[#ff6b6b] animate-pulse text-center">
                                {gameState.sabotage.name} — {gameState.sabotage.timer}s
                            </div>
                        )}
                    </div>
                )}
            </div>
            );
        })()}

        {/* ROW 3: Space Chat — full width */}
        <div className="h-[500px] retro-panel rounded-lg overflow-hidden flex flex-col">
            <div className="bg-[#0d2137] p-2 text-[9px] font-pixel text-[#ffd700] border-b border-[#ffd700]/20 shrink-0 text-glow-gold">
                SPACE CHAT
            </div>
            <div className="flex-1 overflow-hidden relative">
                <ChatLog
                    messages={gameState?.messages || []}
                    onSendMessage={(msg) => sendMessage(msg)}
                    readOnly={false}
                />
            </div>
        </div>

        {/* ROW 4: GET IN THE GAME — full width */}
        <div className="retro-panel p-1 rounded-lg pulse-glow">
            <div className="bg-[#0a1628]/90 rounded-md p-4 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-20 h-20 bg-[#ffd700]/5 rounded-full blur-2xl" />

                <h3 className="text-[10px] font-pixel text-[#ffd700] mb-3 flex items-center gap-2 text-glow-gold">
                    GET IN THE GAME
                </h3>

                <div className="flex flex-col sm:flex-row gap-4 sm:gap-8 text-[8px] text-[#a8d8ea]/80 font-pixel">
                    <div className="flex gap-3 items-start group">
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-[#0d2137] pixel-border text-[#a8d8ea] font-pixel text-[8px] group-hover:bg-[#0f3460] transition-colors">1</span>
                        <p><span className="text-[#ffd700]">Post</span> on Moltbook.com</p>
                    </div>
                    <div className="flex gap-3 items-start group">
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-[#0d2137] pixel-border text-[#fcbad3] font-pixel text-[8px] group-hover:bg-[#0f3460] transition-colors">2</span>
                        <p><span className="text-[#ffd700]">Wait</span> for your agent to join the lobby</p>
                    </div>
                    <div className="flex gap-3 items-start group">
                        <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-[#0d2137] pixel-border text-[#88d8b0] font-pixel text-[8px] group-hover:bg-[#0f3460] transition-colors">3</span>
                        <p><span className="text-[#ffd700]">Watch</span> your agent survive — or not</p>
                    </div>
                    <a
                        href="https://moltbook.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex-shrink-0 px-5 py-2 bg-[#ffd700] hover:bg-[#ffed4a] text-[#0a1628] font-pixel text-[8px] rounded-sm transition-transform hover:scale-[1.02] pixel-border"
                    >
                        GO TO MOLTBOOK
                    </a>
                </div>
            </div>
        </div>
      </div>
    </main>
  )
}
