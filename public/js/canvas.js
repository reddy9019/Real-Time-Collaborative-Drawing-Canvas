export class CanvasEngine {
    constructor(canvasId, cursorsId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.cursorsLayer = document.getElementById(cursorsId);
        this.isDrawing = false;
        this.currentColor = '#ffffff';
        this.brushSize = 5;
        this.remoteStrokes = new Map(); // Map<userId, { lastPoint, color, width }>

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

        // Save content before resize
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.canvas, 0, 0);

        this.canvas.width = rect.width;
        this.canvas.height = rect.height;

        // Restore content
        this.ctx.drawImage(tempCanvas, 0, 0, this.canvas.width, this.canvas.height);
    }

    getNormalizedCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX || e.touches[0].clientX) - rect.left;
        const y = (e.clientY || e.touches[0].clientY) - rect.top;

        // Normalize to 0-1 range for cross-platform consistency
        return {
            x: x / rect.width,
            y: y / rect.height
        };
    }

    getCanvasCoords(normPos) {
        return {
            x: normPos.x * this.canvas.width,
            y: normPos.y * this.canvas.height
        };
    }

    startStroke(normPos, color, width) {
        this.isDrawing = true;
        this.currentColor = color;
        this.currentWidth = width;

        const pos = this.getCanvasCoords(normPos);
        this.lastLocalPoint = pos;
    }

    drawStep(normPos) {
        if (!this.isDrawing) return;

        const pos = this.getCanvasCoords(normPos);

        this.ctx.beginPath();
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentWidth;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.moveTo(this.lastLocalPoint.x, this.lastLocalPoint.y);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();

        this.lastLocalPoint = pos;
    }

    endStroke() {
        this.isDrawing = false;
    }

    drawRemoteStep(userId, normPos, color, width) {
        const pos = this.getCanvasCoords(normPos);
        let stroke = this.remoteStrokes.get(userId);

        if (!stroke) {
            stroke = { lastPoint: pos, color, width };
            this.remoteStrokes.set(userId, stroke);
            return;
        }

        // Update metadata if provided (usually only on start)
        if (color) stroke.color = color;
        if (width) stroke.width = width;

        this.ctx.beginPath();
        this.ctx.strokeStyle = stroke.color;
        this.ctx.lineWidth = stroke.width;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.moveTo(stroke.lastPoint.x, stroke.lastPoint.y);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();

        stroke.lastPoint = pos;
    }

    endRemoteStroke(userId) {
        this.remoteStrokes.delete(userId);
    }

    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    redrawHistory(history) {
        this.clear();
        history.forEach(stroke => {
            this.ctx.beginPath();
            this.ctx.strokeStyle = stroke.color;
            this.ctx.lineWidth = stroke.width;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';

            if (stroke.points.length > 0) {
                const startPos = this.getCanvasCoords(stroke.points[0]);
                this.ctx.moveTo(startPos.x, startPos.y);

                for (let i = 1; i < stroke.points.length; i++) {
                    const pos = this.getCanvasCoords(stroke.points[i]);
                    this.ctx.lineTo(pos.x, pos.y);
                }
                this.ctx.stroke();
            }
        });
    }

    async replayHistory(history) {
        if (this.isReplaying) return;
        this.isReplaying = true;
        this.clear();

        if (!history || history.length === 0) {
            this.isReplaying = false;
            return;
        }

        // Sort history by startTime
        const sortedHistory = [...history].sort((a, b) => a.startTime - b.startTime);
        const sessionStart = sortedHistory[0].startTime;

        // Flatten all points into a single event timeline
        const events = [];
        sortedHistory.forEach(stroke => {
            stroke.points.forEach((point, index) => {
                events.push({
                    time: stroke.startTime + (point.t || 0) - sessionStart,
                    type: index === 0 ? 'start' : 'draw',
                    point: point,
                    color: stroke.color,
                    width: stroke.width,
                    userId: stroke.userId
                });
            });
        });

        // Sort all events by time
        events.sort((a, b) => a.time - b.time);

        const startTime = Date.now();

        // Use a persistent map for current paths being drawn to handle concurrency
        const activePaths = new Map(); // userId -> lastPoint

        for (const event of events) {
            const elapsed = Date.now() - startTime;
            const waitTime = event.time - elapsed;

            if (waitTime > 0) {
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }

            const pos = this.getCanvasCoords(event.point);

            if (event.type === 'start') {
                activePaths.set(event.userId, pos);
            } else {
                const lastPoint = activePaths.get(event.userId);
                if (lastPoint) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = event.color;
                    this.ctx.lineWidth = event.width;
                    this.ctx.lineCap = 'round';
                    this.ctx.lineJoin = 'round';
                    this.ctx.moveTo(lastPoint.x, lastPoint.y);
                    this.ctx.lineTo(pos.x, pos.y);
                    this.ctx.stroke();
                    activePaths.set(event.userId, pos);
                }
            }
        }

        this.isReplaying = false;
    }

    updateCursor(userId, pos, color, username) {
        let cursor = document.getElementById(`cursor-${userId}`);
        if (!cursor) {
            cursor = document.createElement('div');
            cursor.id = `cursor-${userId}`;
            cursor.className = 'ghost-cursor';
            cursor.innerHTML = `
        <svg class="cursor-icon" viewBox="0 0 24 24" fill="${color}">
          <path d="M7 2l12 11.2-5.8.8 3.3 6.7-2.2 1.1-3.5-6.9L7 22V2z"/>
        </svg>
        <div class="cursor-label">${username || userId}</div>
      `;
            this.cursorsLayer.appendChild(cursor);
        }

        const canvasRect = this.canvas.getBoundingClientRect();
        const x = pos.x * canvasRect.width;
        const y = pos.y * canvasRect.height;
        cursor.style.transform = `translate(${x}px, ${y}px)`;
    }

    removeCursor(userId) {
        const cursor = document.getElementById(`cursor-${userId}`);
        if (cursor) cursor.remove();
    }
}
