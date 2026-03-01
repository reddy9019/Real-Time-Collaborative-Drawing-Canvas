const io = window.io;
export class SocketClient {
    constructor(uri) {
        this.socket = io(uri);
        this.userId = null;
        this.roomId = 'default-room'; // Can be dynamic later
        this.color = '#ffffff';
    }

    join(username) {
        this.socket.emit('join_room', { roomId: this.roomId, username });
    }

    onInit(callback) {
        this.socket.on('init_state', (data) => {
            this.userId = data.userId;
            this.color = data.color;
            callback(data);
        });
    }

    onRemoteStart(callback) {
        this.socket.on('remote_start_stroke', callback);
    }

    onRemoteStep(callback) {
        this.socket.on('remote_drawing_step', callback);
    }

    onRemoteEnd(callback) {
        this.socket.on('remote_end_stroke', callback);
    }

    onRemoteCursor(callback) {
        this.socket.on('remote_cursor_move', callback);
    }

    onUserJoined(callback) {
        this.socket.on('user_joined', callback);
    }

    onUserLeft(callback) {
        this.socket.on('user_left', callback);
    }

    onStateReset(callback) {
        this.socket.on('state_reset', callback);
    }

    emitStart(strokeData) {
        this.socket.emit('start_stroke', strokeData);
    }

    emitStep(point) {
        this.socket.emit('drawing_step', point);
    }

    emitEnd() {
        this.socket.emit('end_stroke');
    }

    emitCursor(pos) {
        this.socket.emit('cursor_move', pos);
    }

    emitUndo() {
        this.socket.emit('undo_request');
    }

    emitRedo() {
        this.socket.emit('redo_request');
    }

    emitClear() {
        this.socket.emit('clear_request');
    }
}
