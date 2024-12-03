import { WebSocketServer, WebSocket, RawData } from "ws";
import dotenv from 'dotenv';

interface ExtendedWebSocket extends WebSocket {
  clientId: string;
  name: string;
}

dotenv.config();
const port = parseInt(process.env.PORT || "8080");

let wss: WebSocketServer;

const startServer = (port: number) => {
  wss = new WebSocketServer({ port: port });

  wss.on("listening", () => {
    console.log(`Server started on port ${port}`);
  });

  wss.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${port} is already in use, trying port ${port + 1}`);
      startServer(port + 1);
    } else {
      console.error("Server error:", err);
    }
  });

  wss.on("connection", (ws: ExtendedWebSocket) => {
    ws.clientId = generateId();
    ws.name = "Anonymous";

    ws.on("message", (data) => {
      handleMessage(ws, data);
    });

    ws.on("close", () => {
      handleDisconnect(ws);
    });

    setInterval(() => {
      ws.send(
        JSON.stringify({
          rooms: rooms.map((room) => room.roomId),
        })
      );
    }, 3000);
    ws.send(
      JSON.stringify({
        message: "connected",
        clientId: ws.clientId,
      })
    );

    console.log(`Client connected with ID: ${ws.clientId}`);
  });
};

startServer(port);

type Room = {
  roomId: string;
  members: WebSocket[];
};
const rooms: Room[] = [];

const handleMessage = (ws: ExtendedWebSocket, data: RawData) => {
  try {
    const parsedMsg = JSON.parse(data.toString());

    switch (parsedMsg.type) {
      case "set-name":
        ws.name = parsedMsg.payload.name;
        ws.send(
          JSON.stringify({
            message: `Name set to ${ws.name}`,
          })
        );
        break;
      case "send-message":
        sendMessage(ws, parsedMsg.payload.roomId, parsedMsg.payload.message);
        break;
      case "create-room":
        createRoom(ws);
        break;
      case "join-room":
        joinRoom(ws, parsedMsg.payload.roomId);
        break;
      case "leave-room":
        leaveRoom(ws, parsedMsg.payload.roomId);
        break;
      default:
        ws.send(
          JSON.stringify({
            message: "invalid message type",
          })
        );
    }
  } catch (err) {
    console.error("Error handling message:", err);
    ws.send(
      JSON.stringify({
        message: "Invalid message format",
      })
    );
  }
};

const sendMessage = (ws: ExtendedWebSocket, roomId: string, message: any) => {
  const room = rooms.find((room) => room.roomId === roomId);
  if (room) {
    room.members.forEach((member) => {
      member.send(
        JSON.stringify({
          chatMsg: {
            text: message.text,
            by: ws.name,
          },
        })
      );
    });
  } else {
    ws.send(
      JSON.stringify({
        message: "Room not found",
      })
    );
  }
};

const createRoom = (ws: WebSocket) => {
  const roomId = generateId();
  console.log(`Room created with ID: ${roomId}`);
  rooms.push({ roomId, members: [ws] });
  ws.send(
    JSON.stringify({
      message: `Room created with ID: ${roomId}`,
      roomId: roomId,
    })
  );
};

const joinRoom = (ws: WebSocket, roomId: string) => {
  const room = rooms.find((room) => room.roomId === roomId);
  if (room) {
    room.members.push(ws);
    ws.send(
      JSON.stringify({
        message: `Joined room ${roomId}`,
      })
    );
  } else {
    ws.send(
      JSON.stringify({
        message: "Room not found",
      })
    );
  }
};

const leaveRoom = (ws: WebSocket, roomId: string) => {
  const room = rooms.find((room) => room.roomId === roomId);
  if (room) {
    room.members = room.members.filter((member) => member !== ws);
    if (room.members.length === 0) {
      const index = rooms.indexOf(room);
      rooms.splice(index, 1);
    }
    ws.send(
      JSON.stringify({
        message: `Left room ${roomId}`,
      })
    );
  } else {
    ws.send(
      JSON.stringify({
        message: "Room not found",
      })
    );
  }
};

const generateId = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const handleDisconnect = (ws: WebSocket) => {
  rooms.forEach((room) => {
    room.members = room.members.filter((member) => member !== ws);
    if (room.members.length === 0) {
      const index = rooms.indexOf(room);
      rooms.splice(index, 1);
    }
  });
  console.log("Client disconnected");
};

const shutdown = () => {
  console.log("Shutting down WebSocket server...");
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.close(1001, "Server shutting down");
    }
  });
  wss.close(() => {
    console.log("WebSocket server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
