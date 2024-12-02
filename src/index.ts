import { WebSocketServer, WebSocket, RawData } from "ws";
import dotenv from 'dotenv';
// Extend WebSocket type to include clientId and name
interface ExtendedWebSocket extends WebSocket {
  clientId: string;
  name: string;
}

dotenv.config(); // Load environment variables from .env file
const port = parseInt(process.env.PORT || "8080"); // Ensure port is a number
const wss = new WebSocketServer({ port: port });
console.log(`Server started on port ${port}`);

type message = {
  id: number;
  text: string;
  by: WebSocket;
};

type Room = {
  roomId: string;
  members: WebSocket[];
};
const rooms: Room[] = [];

// wss.on("connection", (ws) => {
//   ws.on("error", console.error);

//   ws.on("message", (data) => {
//     handleMessage(ws, data);
//   });

//   ws.send(
//     JSON.stringify({
//       message: "connected",
//     })
//   );
//   console.log("Client connected");

  // ws.on("close", () => {
  //   handleDisconnect(ws);
  // });
// });

// const handleMessage = (ws: WebSocket, data: RawData) => {
//   try {
//     const parsedMsg = JSON.parse(data.toString());
//     console.log(parsedMsg);
//     console.log(parsedMsg.payload.message);

//     switch (parsedMsg.type) {
//       case "create-room":
//         createRoom(ws);
//         break;
//       case "join-room":
//         joinRoom(ws, parsedMsg.payload.roomId);
//         break;
//       case "leave-room":
//         leaveRoom(ws, parsedMsg.payload.roomId);
//         break;
//       case "send-message":
//         sendMessage(ws, parsedMsg.payload.roomId, parsedMsg.payload.message);
//         break;
//       default:
//         ws.send(
//           JSON.stringify({
//             message: "invalid message type1",
//           })
//         );
//     }
//   } catch (err) {
//     console.log("error ====>", err);
//     ws.send(
//       JSON.stringify({
//         message: "invalid message type2",
//       })
//     );
//   }
// };



// const sendMessage = (ws: WebSocket, roomId: string, message: any) => {
//   const room = rooms.find((room) => room.roomId === roomId);
//   if (room) {
//     console.log("msg=>", message);
//     console.log("msg=>", typeof message);
//     console.log("msg=>", message.by);
//     room.members.forEach((member) => {
//       member.send(JSON.stringify({chatMsg:message})); // convert message object to JSON string
//     });
//   } else {
//     ws.send(
//       JSON.stringify({
//         message: "Room not found",
//       })
//     );
//   }
// };

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

// const generateRoomId = () => {
//   return Math.floor(100000 + Math.random() * 900000).toString(); // Ensures a 6-digit number
// };

// ---------------------

wss.on("connection", (ws: ExtendedWebSocket) => {
  ws.clientId = generateId(); // Assign unique client ID
  ws.name = "Anonymous"; // Default name for the client

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

const handleMessage = (ws: ExtendedWebSocket, data: RawData) => {
  try {
    const parsedMsg = JSON.parse(data.toString());

    switch (parsedMsg.type) {
      case "set-name":
        ws.name = parsedMsg.payload.name; // Update the name for the client
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
      case "send-message":
        sendMessage(ws, parsedMsg.payload.roomId, parsedMsg.payload.message);
        break;
      default:
        ws.send(
          JSON.stringify({
            message: "invalid message type1",
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
            by: ws.name, // Use the name of the sender
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
      roomId:roomId,
    })
  );
  console.log(rooms, "end");
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
  return Math.floor(100000 + Math.random() * 900000).toString(); // Ensures a 6-digit number
};
