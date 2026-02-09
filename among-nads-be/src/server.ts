import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3001;

import { GameEngine, GamePhase } from "./engine/GameEngine";
import { contractClient } from "./services/contractClient";

// Initialize SINGLE global simulation game
const SIM_GAME_ID = "sim-1";
const game = new GameEngine(
  SIM_GAME_ID,
  (phase) => {
    io.to(SIM_GAME_ID).emit("phase_change", phase);
  },
  (state) => {
    // Broadcast full state update every tick
    io.to(SIM_GAME_ID).emit("game_state_update", state);
  },
  (msg) => {
    // Broadcast chat message from bots
    io.to(SIM_GAME_ID).emit("new_message", msg);
  },
);

// Start the automation immediately
game.startAutomatedLoop();

// On-chain: fetch the next game ID for the first round (free view call)
contractClient.fetchNextGameId().catch((err: Error) =>
  console.error("[ContractClient] Initial fetchNextGameId failed:", err)
);

io.on("connection", (socket) => {
  console.log("Spectator connected:", socket.id);

  // Auto-join the simulation room
  socket.join(SIM_GAME_ID);

  // Send immediate state
  socket.emit("lobby_update", game.getState());

  // Handle Spectator Chat
  socket.on("send_message", (data: { gameId: string; message: string }) => {
    io.to(SIM_GAME_ID).emit("new_message", {
      sender: "Spectator",
      content: data.message,
      timestamp: Date.now(),
      type: "chat",
    });
  });

  socket.on("disconnect", () => {
    console.log("Spectator disconnected:", socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Simulation 'sim-1' started automatically.`);
});
