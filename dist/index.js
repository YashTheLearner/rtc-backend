"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = require("ws");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const port = parseInt(process.env.PORT || "8080");
const wss = new ws_1.WebSocketServer({ port: port });
console.log(`Server started on port ${port}`);
const rooms = [];
wss.on("connection", (ws) => {
    ws.clientId = generateId();
    ws.name = "Anonymous";
    ws.on("message", (data) => {
        handleMessage(ws, data);
    });
    ws.on("close", () => {
        handleDisconnect(ws);
    });
    setInterval(() => {
        ws.send(JSON.stringify({
            rooms: rooms.map((room) => room.roomId),
        }));
    }, 3000);
    ws.send(JSON.stringify({
        message: "connected",
        clientId: ws.clientId,
    }));
    console.log(`Client connected with ID: ${ws.clientId}`);
});
const handleMessage = (ws, data) => {
    try {
        const parsedMsg = JSON.parse(data.toString());
        switch (parsedMsg.type) {
            case "set-name":
                ws.name = parsedMsg.payload.name;
                ws.send(JSON.stringify({
                    message: `Name set to ${ws.name}`,
                }));
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
                ws.send(JSON.stringify({
                    message: "invalid message type",
                }));
        }
    }
    catch (err) {
        console.error("Error handling message:", err);
        ws.send(JSON.stringify({
            message: "Invalid message format",
        }));
    }
};
const sendMessage = (ws, roomId, message) => {
    const room = rooms.find((room) => room.roomId === roomId);
    if (room) {
        room.members.forEach((member) => {
            member.send(JSON.stringify({
                chatMsg: {
                    text: message.text,
                    by: ws.name,
                },
            }));
        });
    }
    else {
        ws.send(JSON.stringify({
            message: "Room not found",
        }));
    }
};
const createRoom = (ws) => {
    const roomId = generateId();
    console.log(`Room created with ID: ${roomId}`);
    rooms.push({ roomId, members: [ws] });
    ws.send(JSON.stringify({
        message: `Room created with ID: ${roomId}`,
        roomId: roomId,
    }));
};
const joinRoom = (ws, roomId) => {
    const room = rooms.find((room) => room.roomId === roomId);
    if (room) {
        room.members.push(ws);
        ws.send(JSON.stringify({
            message: `Joined room ${roomId}`,
        }));
    }
    else {
        ws.send(JSON.stringify({
            message: "Room not found",
        }));
    }
};
const leaveRoom = (ws, roomId) => {
    const room = rooms.find((room) => room.roomId === roomId);
    if (room) {
        room.members = room.members.filter((member) => member !== ws);
        if (room.members.length === 0) {
            const index = rooms.indexOf(room);
            rooms.splice(index, 1);
        }
        ws.send(JSON.stringify({
            message: `Left room ${roomId}`,
        }));
    }
    else {
        ws.send(JSON.stringify({
            message: "Room not found",
        }));
    }
};
const generateId = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
const handleDisconnect = (ws) => {
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
        if (client.readyState === ws_1.WebSocket.OPEN) {
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
