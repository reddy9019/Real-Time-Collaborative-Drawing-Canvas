# Architecture Documentation - Real-Time Collaborative Canvas

## 1. System Overview
This is a server-authoritative real-time collaboration system. The server maintains the source of truth for the drawing state, while clients optimistically render local strokes and reconcile remote updates.

## 2. Core Components

### 2.1 Backend (Node.js + Socket.io)
- **`server.js`**: Manages WebSocket connections, room joining, and event broadcasting.
- **`drawing-state.js`**: Stores the stroke history per room. It manages "active strokes" (points currently being streamed) and "finalized strokes" (saved to history).

### 2.2 Frontend (Vanilla JS)
- **`CanvasEngine`**: Handles the logic of drawing on the HTML5 element. It uses coordinate normalization (0 to 1 range) to ensure consistency across different screen resolutions.
- **`SocketClient`**: Abstracts the communication with the server.
- **`main.js`**: Orchestrates the UI, canvas, and network layers.

## 3. Data Flow & Communication

### 3.1 Drawing Flow
1. **Mousedown**: Client starts a local stroke and emits `start_stroke` (includes color/width).
2. **Mousemove**: Client draws segments locally and streams `drawing_step` (normalized x,y) to the server.
3. **Broadcast**: Server receives points and broadcasts them to other users in the same room.
4. **Mouseup**: Client finalizes the stroke; server moves it to the room's permanent history.

### 3.2 Ghost Cursors
Cursors are purely ephemeral. Each client emits its position on `mousemove`, and the server broadcasts it to others. Clients render these as overlay elements (SVG icons with names).

### 3.3 Undo Strategy
Because canvas is pixel-based, deleting a stroke requires a full redraw:
1. Client sends `undo_request`.
2. Server finds and removes the last stroke by that specific user.
3. Server broadcasts `state_reset` with the updated history.
4. All clients clear their canvas and redraw the entire history sequentially.

## 4. Design Decisions

### 4.1 Coordinate Normalization
**Problem**: Users on different screen sizes see the canvas differently.
**Solution**: All coordinates are normalized to a 0-1 range before being sent to the server. The client converts these back to local pixels based on its own canvas dimensions.

### 4.2 Performance Optimization
- **Optimistic Rendering**: Local strokes are drawn instantly without waiting for server acknowledgment.
- **Segment Streaming**: We send individual points as they move rather than waiting for the stroke to end, making the experience feel live.

## 5. Scalability Consideration
- **Current**: In-memory state.
- **Future**: Use Redis for persistent state and horizontally scale WebSocket servers using Socket.io Redis Adapter.
