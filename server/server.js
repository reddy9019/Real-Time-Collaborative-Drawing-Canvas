import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { DrawingState } from './drawing-state.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*",
    }
});

const drawingState = new DrawingState();

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

const users = new Map(); // Map<socketId, { userId, color, roomId }>

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', ({ roomId, username }) => {
        const userId = socket.id;
        const color = `hsl(${Math.random() * 360}, 70%, 50%)`;

        users.set(socket.id, { userId, color, roomId, username });
        socket.join(roomId);

        // Send initial state
        const activeUsers = Array.from(users.values())
            .filter(u => u.roomId === roomId)
            .map(u => ({ userId: u.userId, username: u.username, color: u.color }));

        socket.emit('init_state', {
            history: drawingState.getHistory(roomId),
            userId,
            color,
            activeUsers
        });

        // Notify others
        socket.to(roomId).emit('user_joined', { userId, username, color });

        console.log(`${username || userId} joined room ${roomId}`);
    });

    socket.on('start_stroke', (data) => {
        const user = users.get(socket.id);
        if (!user) return;

        const stroke = drawingState.startStroke(user.roomId, user.userId, data);
        socket.to(user.roomId).emit('remote_start_stroke', stroke);
    });

    socket.on('drawing_step', (point) => {
        const user = users.get(socket.id);
        if (!user) return;

        const stroke = drawingState.addPoint(user.roomId, user.userId, point);
        if (stroke) {
            socket.to(user.roomId).emit('remote_drawing_step', {
                userId: user.userId,
                point
            });
        }
    });

    socket.on('end_stroke', () => {
        const user = users.get(socket.id);
        if (!user) return;

        drawingState.endStroke(user.roomId, user.userId);
        socket.to(user.roomId).emit('remote_end_stroke', { userId: user.userId });
    });

    socket.on('cursor_move', (pos) => {
        const user = users.get(socket.id);
        if (!user) return;

        socket.to(user.roomId).emit('remote_cursor_move', {
            userId: user.userId,
            pos,
            color: user.color,
            username: user.username
        });
    });

    socket.on('undo_request', () => {
        const user = users.get(socket.id);
        if (!user) return;

        const success = drawingState.undo(user.roomId, user.userId);
        if (success) {
            io.to(user.roomId).emit('state_reset', drawingState.getHistory(user.roomId));
        }
    });

    socket.on('redo_request', () => {
        const user = users.get(socket.id);
        if (!user) return;

        const success = drawingState.redo(user.roomId, user.userId);
        if (success) {
            io.to(user.roomId).emit('state_reset', drawingState.getHistory(user.roomId));
        }
    });

    socket.on('clear_request', () => {
        const user = users.get(socket.id);
        if (!user) return;

        drawingState.clear(user.roomId);
        io.to(user.roomId).emit('state_reset', []);
    });

    socket.on('get_history', (callback) => {
        const user = users.get(socket.id);
        if (user && typeof callback === 'function') {
            callback(drawingState.getHistory(user.roomId));
        }
    });

    socket.on('disconnect', () => {
        const user = users.get(socket.id);
        if (user) {
            socket.to(user.roomId).emit('user_left', user.userId);
            users.delete(socket.id);
        }
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
