// DOM要素の取得
const form = document.getElementById('coord-form');
const pointList = document.getElementById('point-list');
const addPointBtn = document.getElementById('add-point-btn');
const removePointBtn = document.getElementById('remove-point-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const canvas = document.getElementById('plot-canvas');
const ctx = canvas.getContext('2d');
const infoDisplay = document.getElementById('info-display');
let pointCounter = 2;
let drawnPoints = []; // 描画された点を保存する配列
let selectedPoint = null; // 選択中の点を保持する変数
let previousPointForDistance = null; // 距離測定用の前回クリックした点
let distanceHistory = []; // 距離履歴を保存する配列
let drawnLines = []; // 描画された線を保存する配列
let distanceLabels = []; // 距離ラベルを保存する配列
let panOffset = { x: 0, y: 0 }; // パン（移動）のオフセット
let zoomLevel = 1; // ズームレベル
let isPanning = false; // パン中かどうか
let lastPanPoint = { x: 0, y: 0 }; // 最後のパン位置

// --- イベントリスナー ---

// 「点を追加」ボタン
addPointBtn.addEventListener('click', function() {
    const newPointInput = document.createElement('div');
    newPointInput.classList.add('point-input');
    newPointInput.innerHTML = `
        <input type="text" name="name" placeholder="点名" value="P${pointCounter}">
        <input type="number" name="x" placeholder="X座標" step="0.001" required>
        <input type="number" name="y" placeholder="Y座標" step="0.001" required>
    `;
    pointList.appendChild(newPointInput);
    pointCounter++;
});

// 「点を削除」ボタン
removePointBtn.addEventListener('click', function() {
    const pointInputs = pointList.querySelectorAll('.point-input');
    if (pointInputs.length > 1) {
        pointList.removeChild(pointInputs[pointInputs.length - 1]);
        pointCounter--;
        plotPoints(); // 再描画
    }
});

// 「距離履歴をクリア」ボタン
clearHistoryBtn.addEventListener('click', function() {
    distanceHistory = [];
    drawnLines = [];
    distanceLabels = [];
    previousPointForDistance = null;
    selectedPoint = null;
    infoDisplay.textContent = '点をクリックして選択または距離測定を開始します。';
    redrawAll();
});

// フォーム送信（描画実行）
form.addEventListener('submit', function(event) {
    event.preventDefault();
    plotPoints();
});

// --- Canvasイベント ---

// ダブルクリック/ダブルタップでパンモード切替
canvas.addEventListener('dblclick', togglePanMode);

// パン開始 (PC)
canvas.addEventListener('mousedown', startPan);
// パン実行 (PC)
canvas.addEventListener('mousemove', pan);
// パン終了 (PC)
canvas.addEventListener('mouseup', endPan);
// ズーム (PC)
canvas.addEventListener('wheel', zoom);

// タッチイベント
canvas.addEventListener('touchstart', handleTouchStart);
canvas.addEventListener('touchmove', handleTouchMove);
canvas.addEventListener('touchend', handleTouchEnd);

// クリック/タップ処理
canvas.addEventListener('click', handleCanvasClick);


// --- 関数 ---

/**
 * 座標と点名からCanvasに描画する
 */
function plotPoints() {
    // リセット
    drawnPoints = [];
    selectedPoint = null;
    previousPointForDistance = null;
    distanceHistory = [];
    drawnLines = [];
    distanceLabels = [];
    infoDisplay.textContent = '点をクリックして選択または距離測定を開始します。';

    clearCanvas();

    const pointInputs = pointList.querySelectorAll('.point-input');
    const points = [];
    pointInputs.forEach(input => {
        const name = input.querySelector('input[name="name"]').value;
        const x = parseFloat(input.querySelector('input[name="x"]').value);
        const y = parseFloat(input.querySelector('input[name="y"]').value);
        if (!isNaN(x) && !isNaN(y)) {
            points.push({ name, x, y });
        }
    });

    if (points.length === 0) {
        drawAxes();
        return;
    }

    // スケールとオフセットの計算
    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;
    points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    const padding = 50;
    const canvasWidth = canvas.width - padding * 2;
    const canvasHeight = canvas.height - padding * 2;
    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    let scale = (rangeX === 0 && rangeY === 0) ? 1 : Math.min(canvasWidth / (rangeX || 1), canvasHeight / (rangeY || 1));
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    drawAxes(scale, centerX, centerY);

    points.forEach(p => {
        const canvasX = (p.x - centerX) * scale + canvas.width / 2;
        const canvasY = -(p.y - centerY) * scale + canvas.height / 2;
        drawnPoints.push({ name: p.name, x: p.x, y: p.y, canvasX, canvasY });
    });

    redrawAll();
}

/**
 * Canvas上の点とラベルを描画
 */
function drawPoint(p) {
    const isSelected = (p === selectedPoint);
    const transformedX = p.canvasX * zoomLevel + panOffset.x;
    const transformedY = p.canvasY * zoomLevel + panOffset.y;

    // 点
    ctx.beginPath();
    ctx.arc(transformedX, transformedY, 7 * zoomLevel, 0, Math.PI * 2, true);
    ctx.fillStyle = isSelected ? 'blue' : 'red'; // 選択時は青、通常は赤
    ctx.fill();

    // ラベル
    ctx.fillStyle = isSelected ? 'blue' : 'black'; // 選択時は青
    ctx.font = `${12 * zoomLevel}px Arial`;
    if (isSelected) {
        ctx.font = `bold ${12 * zoomLevel}px Arial`;
    }
    ctx.fillText(p.name, transformedX + 10 * zoomLevel, transformedY + 5 * zoomLevel);
}

/**
 * Canvasクリア
 */
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/**
 * 軸を描画
 */
function drawAxes(scale = 1, centerX = 0, centerY = 0) {
    ctx.beginPath();
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;
    const originX = ((0 - centerX) * scale + canvas.width / 2) * zoomLevel + panOffset.x;
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, canvas.height);
    const originY = (canvas.height / 2 - (0 - centerY) * scale) * zoomLevel + panOffset.y;
    ctx.moveTo(0, originY);
    ctx.lineTo(canvas.width, originY);
    ctx.stroke();
}

/**
 * 全てを再描画
 */
function redrawAll() {
    clearCanvas();
    drawAxes();
    
    drawnLines.forEach(line => drawLine(line.p1, line.p2));
    distanceLabels.forEach(label => drawDistanceLabel(label.x, label.y, label.text, label.angle));
    drawnPoints.forEach(p => drawPoint(p));
}

// --- インタラクション関連の関数 ---

function handleCanvasClick(event) {
    if (isPanning) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const clickedPoint = getClickedPoint(clickX, clickY);

    if (clickedPoint) {
        // Case 1: Clicking the already selected point -> Undo the last action.
        if (selectedPoint === clickedPoint) {
            // If there are any lines drawn, undo the last one.
            if (drawnLines.length > 0) {
                // The point to revert selection to is the start of the last line.
                const newSelectedPoint = drawnLines[drawnLines.length - 1].p1;

                // Remove the last measurement from all history arrays.
                drawnLines.pop();
                distanceHistory.pop();
                distanceLabels.pop();

                // Update the selection to the previous point.
                selectedPoint = newSelectedPoint;
                previousPointForDistance = newSelectedPoint;

                // Update info display
                updateDistanceDisplay(); // Show the remaining history
                if (distanceHistory.length > 0) {
                    infoDisplay.innerHTML += `<br>最後の測定を取り消しました。${selectedPoint.name} を選択中。`;
                } else {
                    infoDisplay.textContent = `最後の測定を取り消しました。${selectedPoint.name} を選択中。`;
                }

            } 
            // If no lines are drawn, just deselect the point.
            else {
                selectedPoint = null;
                previousPointForDistance = null;
                infoDisplay.textContent = '選択を解除しました。';
            }
        } 
        // Case 2: Clicking a new point.
        else {
            // If there was a point selected previously for distance measurement, measure distance to the new one.
            if (previousPointForDistance) {
                calculateAndDrawDistance(previousPointForDistance, clickedPoint);
            }
            
            // Select the new point.
            selectedPoint = clickedPoint;
            // Set it as the starting point for the *next* distance measurement.
            previousPointForDistance = clickedPoint; 
            
            // Update info display
            updateDistanceDisplay();
            if (distanceHistory.length > 0) {
                 infoDisplay.innerHTML += `<br>${selectedPoint.name} を選択中。`;
            } else {
                 infoDisplay.textContent = `${selectedPoint.name} を選択しました。次の点を選択して距離を測定します。`;
            }
        }
    } 
    // Case 3: Clicking on empty space -> Deselect everything and clear all distances.
    else {
        selectedPoint = null;
        previousPointForDistance = null;
        
        // Also clear all distance related data
        distanceHistory = [];
        drawnLines = [];
        distanceLabels = [];

        infoDisplay.textContent = '点をクリックして選択または距離測定を開始します。';
    }

    redrawAll();
}

/**
 * クリック/タップされた座標に最も近い点を返す（点名も含む）
 */
function getClickedPoint(clickX, clickY) {
    let closestPoint = null;
    // クリック判定の半径をズームレベルに合わせる
    let minDistance = 15 * zoomLevel; 

    drawnPoints.forEach(point => {
        const transformedX = point.canvasX * zoomLevel + panOffset.x;
        const transformedY = point.canvasY * zoomLevel + panOffset.y;
        
        // 点本体との距離
        const distanceToPoint = Math.sqrt(Math.pow(transformedX - clickX, 2) + Math.pow(transformedY - clickY, 2));
        
        if (distanceToPoint < minDistance) {
            minDistance = distanceToPoint;
            closestPoint = point;
        }

        // 点名ラベルとの当たり判定
        const labelX = transformedX + 10 * zoomLevel;
        const labelY = transformedY + 5 * zoomLevel;
        ctx.font = `${12 * zoomLevel}px Arial`;
        const labelWidth = ctx.measureText(point.name).width;
        const labelHeight = 12 * zoomLevel;

        if (clickX >= labelX && clickX <= labelX + labelWidth &&
            clickY >= labelY - labelHeight && clickY <= labelY) {
            // ラベルがクリックされたら、距離に関係なくその点を最優先
            closestPoint = point;
            return; // forEachを抜ける
        }
    });
    return closestPoint;
}

/**
 * 2点間の距離を計算して描画
 */
function calculateAndDrawDistance(p1, p2) {
    const distance = Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    const distanceText = `${p1.name}→${p2.name}：${distance.toFixed(3)}m`;
    
    distanceHistory.push(distanceText);
    drawnLines.push({p1, p2});

    const midX = (p1.canvasX + p2.canvasX) / 2;
    const midY = (p1.canvasY + p2.canvasY) / 2;
    const deltaX = p2.canvasX - p1.canvasX;
    const deltaY = p2.canvasY - p1.canvasY;
    const angle = Math.atan2(deltaY, deltaX);
    const offsetX = -Math.sin(angle) * 15;
    const offsetY = Math.cos(angle) * 15;
    
    distanceLabels.push({
        x: midX + offsetX,
        y: midY + offsetY,
        text: `${distance.toFixed(3)}m`,
        angle: angle
    });
    
    updateDistanceDisplay();
}

/**
 * 2点間に線を描画
 */
function drawLine(p1, p2) {
    const x1 = p1.canvasX * zoomLevel + panOffset.x;
    const y1 = p1.canvasY * zoomLevel + panOffset.y;
    const x2 = p2.canvasX * zoomLevel + panOffset.x;
    const y2 = p2.canvasY * zoomLevel + panOffset.y;
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'blue';
    ctx.lineWidth = 2 * zoomLevel;
    ctx.stroke();
}

/**
 * 距離ラベルを描画
 */
function drawDistanceLabel(x, y, text, angle = 0) {
    ctx.save();
    const transformedX = x * zoomLevel + panOffset.x;
    const transformedY = y * zoomLevel + panOffset.y;
    ctx.translate(transformedX, transformedY);
    ctx.rotate(angle);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = `${12 * zoomLevel}px Arial`;
    const textWidth = ctx.measureText(text).width;
    const padding = 3 * zoomLevel;
    ctx.fillRect(-textWidth/2 - padding, -8 * zoomLevel - padding, textWidth + padding*2, 16 * zoomLevel + padding*2);
    
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    ctx.restore();
}

/**
 * 距離履歴を更新
 */
function updateDistanceDisplay() {
    if (distanceHistory.length > 0) {
        infoDisplay.innerHTML = `距離履歴:<br>${distanceHistory.join('<br>')}`;
    }
}

// --- パンとズームのハンドラ ---

function togglePanMode(event) {
    event.preventDefault();
    isPanning = !isPanning;
    canvas.style.cursor = isPanning ? 'grab' : 'default';
    infoDisplay.textContent = isPanning ? 'パンモード: ドラッグで移動、ホイール/ピンチで拡大縮小。ダブルクリック/タップで解除。' : '点をクリックして選択または距離測定を開始します。';
}

function startPan(event) {
    if (isPanning) {
        canvas.style.cursor = 'grabbing';
        lastPanPoint.x = event.clientX;
        lastPanPoint.y = event.clientY;
    }
}

function pan(event) {
    if (isPanning && event.buttons === 1) {
        const deltaX = event.clientX - lastPanPoint.x;
        const deltaY = event.clientY - lastPanPoint.y;
        panOffset.x += deltaX;
        panOffset.y += deltaY;
        lastPanPoint.x = event.clientX;
        lastPanPoint.y = event.clientY;
        redrawAll();
    }
}

function endPan() {
    if (isPanning) {
        canvas.style.cursor = 'grab';
    }
}

function zoom(event) {
    if (isPanning) {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        const worldX = (mouseX - panOffset.x) / zoomLevel;
        const worldY = (mouseY - panOffset.y) / zoomLevel;
        
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        zoomLevel *= zoomFactor;
        zoomLevel = Math.max(0.1, Math.min(5, zoomLevel));
        
        panOffset.x = mouseX - worldX * zoomLevel;
        panOffset.y = mouseY - worldY * zoomLevel;
        
        redrawAll();
    }
}

// --- タッチイベントのハンドラ ---
let lastTouchDistance = null;
let touchTimeout = null;

function handleTouchStart(event) {
    event.preventDefault();
    const touches = event.touches;

    // ダブルタップ判定
    if (!touchTimeout) {
        touchTimeout = setTimeout(() => {
            touchTimeout = null;
        }, 300);
    } else {
        clearTimeout(touchTimeout);
        touchTimeout = null;
        togglePanMode(event);
        return;
    }

    if (isPanning) {
        if (touches.length === 1) { // パン
            lastPanPoint.x = touches[0].clientX;
            lastPanPoint.y = touches[0].clientY;
        } else if (touches.length === 2) { // ピンチズーム
            lastTouchDistance = Math.hypot(
                touches[0].clientX - touches[1].clientX,
                touches[0].clientY - touches[1].clientY
            );
        }
    }
}

function handleTouchMove(event) {
    event.preventDefault();
    if (!isPanning) return;

    const touches = event.touches;
    if (touches.length === 1) { // パン
        const deltaX = touches[0].clientX - lastPanPoint.x;
        const deltaY = touches[0].clientY - lastPanPoint.y;
        panOffset.x += deltaX;
        panOffset.y += deltaY;
        lastPanPoint.x = touches[0].clientX;
        lastPanPoint.y = touches[0].clientY;
        redrawAll();
    } else if (touches.length === 2) { // ピンチズーム
        const currentTouchDistance = Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        );
        const zoomFactor = currentTouchDistance / lastTouchDistance;
        
        const rect = canvas.getBoundingClientRect();
        const touchCenterX = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
        const touchCenterY = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;

        const worldX = (touchCenterX - panOffset.x) / zoomLevel;
        const worldY = (touchCenterY - panOffset.y) / zoomLevel;

        zoomLevel *= zoomFactor;
        zoomLevel = Math.max(0.1, Math.min(5, zoomLevel));

        panOffset.x = touchCenterX - worldX * zoomLevel;
        panOffset.y = touchCenterY - worldY * zoomLevel;

        lastTouchDistance = currentTouchDistance;
        redrawAll();
    }
}

function handleTouchEnd(event) {
    event.preventDefault();
    lastTouchDistance = null;

    // タップ（クリック）をシミュレート
    if (event.changedTouches.length === 1 && !isPanning) {
         const touch = event.changedTouches[0];
         const mouseEvent = new MouseEvent('click', {
             clientX: touch.clientX,
             clientY: touch.clientY
         });
         canvas.dispatchEvent(mouseEvent);
    }
}


// --- 初期化 ---
plotPoints();
