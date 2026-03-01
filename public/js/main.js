import { CanvasEngine } from './canvas.js';
import { SocketClient } from './websocket.js';

const canvas = new CanvasEngine('drawing-canvas', 'cursors-layer');
const socket = new SocketClient("https://real-time-collaborative-drawing-canvas-515l.onrender.com");

const colorBtns = document.querySelectorAll('.color-btn');
const customColorInput = document.getElementById('custom-color');
const brushSizeInput = document.getElementById('brush-size');
const brushSizeVal = document.getElementById('brush-size-val');
const eraserBtn = document.getElementById('eraser-btn');
const undoBtn = document.getElementById('undo-btn');
const clearBtn = document.getElementById('clear-btn');
const replayBtn = document.getElementById('replay-btn');
const undoBtnHeader = document.getElementById('header-undo');
const redoBtnHeader = document.getElementById('header-redo');
const usersContainer = document.getElementById('users-container');
const userCountBadge = document.getElementById('user-count');

let username = prompt('Enter your name:') || 'Anonymous';
socket.join(username);

// UI Events
undoBtnHeader.addEventListener('click', () => {
    socket.emitUndo();
});

redoBtnHeader.addEventListener('click', () => {
    socket.emitRedo();
});
replayBtn.addEventListener('click', () => {
    // Fetch latest history from server for replay
    socket.socket.emit('get_history', (history) => {
        canvas.replayHistory(history);
    });
});
colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        canvas.currentColor = btn.dataset.color;
        canvas.isEraser = false;
    });
});

customColorInput.addEventListener('input', (e) => {
    colorBtns.forEach(b => b.classList.remove('active'));
    canvas.currentColor = e.target.value;
    canvas.isEraser = false;
});

brushSizeInput.addEventListener('input', (e) => {
    const val = e.target.value;
    canvas.brushSize = val;
    brushSizeVal.textContent = `${val}px`;
});

eraserBtn.addEventListener('click', () => {
    canvas.isEraser = true;
    canvas.currentColor = '#000000'; // Eraser matches canvas background
    colorBtns.forEach(b => b.classList.remove('active'));
});

undoBtn.addEventListener('click', () => {
    socket.emitUndo();
});

clearBtn.addEventListener('click', () => {
    if (confirm('Clear the entire canvas for everyone?')) {
        socket.emitClear();
    }
});

// Canvas Events
canvas.canvas.addEventListener('mousedown', (e) => {
    const normPos = canvas.getNormalizedCoords(e);
    canvas.startStroke(normPos, canvas.currentColor, canvas.brushSize);
    socket.emitStart({ point: normPos, color: canvas.currentColor, width: canvas.brushSize });
});

window.addEventListener('mousemove', (e) => {
    const normPos = canvas.getNormalizedCoords(e);
    socket.emitCursor(normPos);

    if (canvas.isDrawing) {
        canvas.drawStep(normPos);
        socket.emitStep(normPos);
    }
});

window.addEventListener('mouseup', () => {
    if (canvas.isDrawing) {
        canvas.endStroke();
        socket.emitEnd();
    }
});

// Socket Events
socket.onInit((data) => {
    canvas.redrawHistory(data.history);
    canvas.currentColor = data.color;
    // Add self
    updateUserList(data.userId, username, data.color, true);
    // Add others
    if (data.activeUsers) {
        data.activeUsers.forEach(user => {
            if (user.userId !== data.userId) {
                updateUserList(user.userId, user.username, user.color);
            }
        });
    }
});

socket.onRemoteStart((stroke) => {
    canvas.drawRemoteStep(stroke.userId, stroke.points[0], stroke.color, stroke.width);
});

socket.onRemoteStep((data) => {
    canvas.drawRemoteStep(data.userId, data.point);
});

socket.onRemoteEnd((data) => {
    canvas.endRemoteStroke(data.userId);
});

socket.onRemoteCursor((data) => {
    canvas.updateCursor(data.userId, data.pos, data.color, data.username);
});

socket.onUserJoined((data) => {
    updateUserList(data.userId, data.username, data.color);
});

socket.onUserLeft((userId) => {
    canvas.removeCursor(userId);
    const userEl = document.getElementById(`user-${userId}`);
    if (userEl) userEl.remove();
    updateUserCount();
});

socket.onStateReset((history) => {
    canvas.redrawHistory(history);
});

function updateUserList(userId, username, color, isSelf = false) {
    let userEl = document.getElementById(`user-${userId}`);
    if (!userEl) {
        userEl = document.createElement('div');
        userEl.id = `user-${userId}`;
        userEl.className = 'user-item';
        usersContainer.appendChild(userEl);
    }
    userEl.innerHTML = `
    <div class="user-dot" style="background-color: ${color}"></div>
    <span>${username}${isSelf ? ' (You)' : ''}</span>
  `;
    updateUserCount();
}

function updateUserCount() {
    const count = usersContainer.children.length;
    userCountBadge.textContent = `${count} user${count !== 1 ? 's' : ''} online`;
}
