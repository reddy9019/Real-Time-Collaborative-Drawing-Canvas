export class DrawingState {
  constructor() {
    this.rooms = new Map(); // Map<roomId, { strokes: [], activeStrokes: Map<userId, stroke> }>
  }

  getRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        strokes: [],
        activeStrokes: new Map(), // Tracks current stroke per user (mousedown -> mousemove -> mouseup)
        redoStack: new Map() // Map<userId, strokes[]>
      });
    }
    return this.rooms.get(roomId);
  }

  startStroke(roomId, userId, strokeData) {
    const room = this.getRoom(roomId);
    const now = Date.now();
    const stroke = {
      ...strokeData,
      userId,
      startTime: now,
      points: [{ ...strokeData.point, t: 0 }],
      id: now + Math.random().toString(36).substr(2, 9)
    };
    room.activeStrokes.set(userId, stroke);

    // redoStack will be cleared in endStroke if it was a real action
    return stroke;
  }

  addPoint(roomId, userId, point) {
    const room = this.getRoom(roomId);
    const stroke = room.activeStrokes.get(userId);
    if (stroke) {
      const relativeTime = Date.now() - stroke.startTime;
      stroke.points.push({ ...point, t: relativeTime });
      return stroke;
    }
    return null;
  }

  endStroke(roomId, userId) {
    const room = this.getRoom(roomId);
    const stroke = room.activeStrokes.get(userId);
    if (stroke) {
      room.strokes.push(stroke);
      room.activeStrokes.delete(userId);

      // Clear redo stack ONLY when a new stroke is successfully completed
      console.log(`Clearing redoStack for user ${userId} due to new action`);
      if (room.redoStack.has(userId)) {
        room.redoStack.delete(userId);
      }

      return stroke;
    }
    return null;
  }

  undo(roomId, userId) {
    const room = this.getRoom(roomId);
    // Find last stroke by this user
    for (let i = room.strokes.length - 1; i >= 0; i--) {
      if (room.strokes[i].userId === userId) {
        const stroke = room.strokes.splice(i, 1)[0];

        // Push to redo stack
        if (!room.redoStack.has(userId)) {
          room.redoStack.set(userId, []);
        }
        room.redoStack.get(userId).push(stroke);
        console.log(`Undo successful for user ${userId}. Redo stack size: ${room.redoStack.get(userId).length}`);

        return true;
      }
    }
    console.log(`Undo failed for user ${userId}: No strokes found.`);
    return false;
  }

  redo(roomId, userId) {
    const room = this.getRoom(roomId);
    const userStack = room.redoStack.get(userId);

    if (userStack && userStack.length > 0) {
      const stroke = userStack.pop();
      room.strokes.push(stroke);
      console.log(`Redo successful for user ${userId}. Remaining redo stack: ${userStack.length}`);
      return true;
    }
    console.log(`Redo failed for user ${userId}: Redo stack is empty or missing.`, { exists: !!userStack, length: userStack ? userStack.length : 0 });
    return false;
  }

  clear(roomId) {
    const room = this.getRoom(roomId);
    room.strokes = [];
    room.activeStrokes.clear();
    room.redoStack.clear();
  }

  getHistory(roomId) {
    return this.getRoom(roomId).strokes;
  }
}
