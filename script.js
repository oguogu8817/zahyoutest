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
let previousPoint = null; // 前回クリックした点を保持する変数
let distanceHistory = []; // 距離履歴を保存する配列
let drawnLines = []; // 描画された線を保存する配列
let distanceLabels = []; // 距離ラベルを保存する配列
let panOffset = { x: 0, y: 0 }; // パン（移動）のオフセット
let zoomLevel = 1; // ズームレベル
let isPanning = false; // パン中かどうか
let lastPanPoint = { x: 0, y: 0 }; // 最後のパン位置

// 「点を追加」ボタンのクリックイベント
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

// 「点を削除」ボタンのクリックイベント
removePointBtn.addEventListener('click', function() {
    const pointInputs = pointList.querySelectorAll('.point-input');
    if (pointInputs.length > 1) { // 最低1つの点は残す
        pointList.removeChild(pointInputs[pointInputs.length - 1]);
        pointCounter--;
        
        // 削除後に再描画
        plotPoints();
    }
});

// 「距離履歴をクリア」ボタンのクリックイベント
clearHistoryBtn.addEventListener('click', function() {
    distanceHistory = [];
    drawnLines = [];
    distanceLabels = [];
    previousPoint = null;
    infoDisplay.textContent = '点をクリックして距離測定を開始します。';
    
    // 描画をリセット（点は残す）
    redrawAllPoints();
});

// 描画処理を関数にまとめる
function plotPoints() {
    drawnPoints = []; // 描画前にリストをリセット
    selectedPoint = null; // 選択をリセット
    previousPoint = null; // 前回クリック点をリセット
    distanceHistory = []; // 距離履歴をリセット
    drawnLines = []; // 描画された線をリセット
    distanceLabels = []; // 距離ラベルをリセット
    infoDisplay.textContent = '点をクリックして距離測定を開始します。';

    // Canvasをクリア
    clearCanvas();

    // すべての入力欄から座標と点名を取得
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
        drawAxes(); // 点がない場合はデフォルトの軸を描画
        return;
    }

    // 全ての点が描画領域に収まるように縮尺とオフセットを計算
    let minX = points[0].x, maxX = points[0].x;
    let minY = points[0].y, maxY = points[0].y;
    points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });

    const padding = 50; // キャンバスの端からの余白
    const canvasWidth = canvas.width - padding * 2;
    const canvasHeight = canvas.height - padding * 2;

    const rangeX = maxX - minX;
    const rangeY = maxY - minY;

    // 縮尺を計算
    let scale;
    if (rangeX === 0 && rangeY === 0) {
        scale = 1;
    } else {
        scale = Math.min(canvasWidth / (rangeX || 1), canvasHeight / (rangeY || 1));
    }
    
    // 描画の中心を計算
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // 新しい軸を描画
    drawAxes(scale, centerX, centerY);

    // 座標を変換して描画
    points.forEach(p => {
        const canvasX = (p.x - centerX) * scale + canvas.width / 2;
        const canvasY = -(p.y - centerY) * scale + canvas.height / 2;
        
        drawnPoints.push({ name: p.name, x: p.x, y: p.y, canvasX, canvasY });
        drawPoint(canvasX, canvasY, p.name);
    });
}

// フォーム送信イベントのリスナー
form.addEventListener('submit', function(event) {
    event.preventDefault(); // デフォルトの送信をキャンセル
    plotPoints();
});

/**
 * Canvas上の指定された座標に点と点名を描画する関数
 * @param {number} canvasX - Canvas上のX座標
 * @param {number} canvasY - Canvas上のY座標
 * @param {string} name - 点名
 * @param {boolean} isSelected - 選択状態か
 */
function drawPoint(canvasX, canvasY, name, isSelected = false) {
    // パンとズームを適用
    const transformedX = canvasX * zoomLevel + panOffset.x;
    const transformedY = canvasY * zoomLevel + panOffset.y;
    
    // 点の描画
    ctx.beginPath();
    ctx.arc(transformedX, transformedY, 7 * zoomLevel, 0, Math.PI * 2, true);
    ctx.fillStyle = isSelected ? 'blue' : 'red'; // 選択されている場合は色を変更
    ctx.fill();

    // 点名の描画
    ctx.fillStyle = 'black';
    ctx.font = `${12 * zoomLevel}px Arial`;
    ctx.fillText(name, transformedX + 10 * zoomLevel, transformedY + 5 * zoomLevel);
}

/**
 * Canvasをクリアする関数
 */
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 初期状態でCanvasに軸を描画
function drawAxes(scale = 1, centerX = 0, centerY = 0) {
    ctx.beginPath();
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;

    // Y軸 (x=0)
    const originX = ((0 - centerX) * scale + canvas.width / 2) * zoomLevel + panOffset.x;
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, canvas.height);

    // X軸 (y=0)
    const originY = (canvas.height / 2 - (0 - centerY) * scale) * zoomLevel + panOffset.y;
    ctx.moveTo(0, originY);
    ctx.lineTo(canvas.width, originY);

    ctx.stroke();
}

// Canvasのダブルクリックイベントリスナー（パンモード切替）
canvas.addEventListener('dblclick', function(event) {
    event.preventDefault();
    isPanning = !isPanning;
    
    if (isPanning) {
        canvas.style.cursor = 'grab';
        infoDisplay.textContent = 'パンモード: ドラッグで移動、ホイールで拡大縮小。ダブルクリックで解除。';
    } else {
        canvas.style.cursor = 'default';
        infoDisplay.textContent = '点をクリックして距離測定を開始します。';
    }
});

// Canvasのマウスダウンイベント（パン開始）
canvas.addEventListener('mousedown', function(event) {
    if (isPanning) {
        canvas.style.cursor = 'grabbing';
        lastPanPoint.x = event.clientX;
        lastPanPoint.y = event.clientY;
    }
});

// Canvasのマウスムーブイベント（パン実行）
canvas.addEventListener('mousemove', function(event) {
    if (isPanning && event.buttons === 1) { // 左クリック中
        const deltaX = event.clientX - lastPanPoint.x;
        const deltaY = event.clientY - lastPanPoint.y;
        
        panOffset.x += deltaX;
        panOffset.y += deltaY;
        
        lastPanPoint.x = event.clientX;
        lastPanPoint.y = event.clientY;
        
        redrawAllPoints();
    }
});

// Canvasのマウスアップイベント（パン終了）
canvas.addEventListener('mouseup', function(event) {
    if (isPanning) {
        canvas.style.cursor = 'grab';
    }
});

// Canvasのホイールイベント（ズーム）
canvas.addEventListener('wheel', function(event) {
    if (isPanning) {
        event.preventDefault();
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        
        // ズーム前のマウス位置（ワールド座標）
        const worldX = (mouseX - panOffset.x) / zoomLevel;
        const worldY = (mouseY - panOffset.y) / zoomLevel;
        
        // ズームレベルを更新
        const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
        zoomLevel *= zoomFactor;
        zoomLevel = Math.max(0.1, Math.min(5, zoomLevel)); // 0.1～5倍に制限
        
        // ズーム後のマウス位置を維持するようにパンオフセットを調整
        panOffset.x = mouseX - worldX * zoomLevel;
        panOffset.y = mouseY - worldY * zoomLevel;
        
        redrawAllPoints();
    }
});

// Canvasのクリックイベントリスナー
canvas.addEventListener('click', function(event) {
    if (isPanning) return; // パンモード中はクリック処理を無効
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const clickedPoint = getClickedPoint(clickX, clickY);

    if (clickedPoint) {
        if (!previousPoint) {
            // 最初の点の選択
            previousPoint = clickedPoint;
            infoDisplay.textContent = `${previousPoint.name} を選択しました。次の点を選択してください。`;
            redrawAllPoints(); // ハイライト表示のために再描画
        } else if (previousPoint === clickedPoint) {
            // 同じ点をクリックした場合は選択を解除し、線もクリア
            previousPoint = null;
            drawnLines = [];
            distanceLabels = [];
            distanceHistory = [];
            infoDisplay.textContent = '点をクリックして距離測定を開始します。';
            redrawAllPoints();
        } else {
            // 連続点間距離を計算
            const distance = calculateDistance(previousPoint, clickedPoint);
            const distanceText = `${previousPoint.name}→${clickedPoint.name}：${distance.toFixed(3)}m`;
            
            // 距離履歴に追加
            distanceHistory.push(distanceText);
            
            // 2点間に線を描画
            drawLine(previousPoint, clickedPoint);
            
            // 線を履歴に保存
            drawnLines.push({p1: previousPoint, p2: clickedPoint});
            
            // キャンバス上に距離ラベルを追加（線に並行に配置）
            const midX = (previousPoint.canvasX + clickedPoint.canvasX) / 2;
            const midY = (previousPoint.canvasY + clickedPoint.canvasY) / 2;
            
            // 線の角度を計算
            const deltaX = clickedPoint.canvasX - previousPoint.canvasX;
            const deltaY = clickedPoint.canvasY - previousPoint.canvasY;
            const angle = Math.atan2(deltaY, deltaX);
            
            // 線から少し離れた位置に配置（垂直方向に10px離す）
            const offsetX = -Math.sin(angle) * 15;
            const offsetY = Math.cos(angle) * 15;
            
            distanceLabels.push({
                x: midX + offsetX,
                y: midY + offsetY,
                text: `${distance.toFixed(3)}m`,
                angle: angle
            });
            
            // 距離履歴を表示
            updateDistanceDisplay();
            
            // 現在の点を次の前回点に設定
            previousPoint = clickedPoint;
            redrawAllPoints();
        }
    } else {
        // 何もない場所がクリックされたら選択をリセット
        previousPoint = null;
        infoDisplay.textContent = '点をクリックして距離測定を開始します。';
        redrawAllPoints();
    }
});

/**
 * クリックされた座標に最も近い点を返す
 * @param {number} clickX - クリックされたCanvas上のX座標
 * @param {number} clickY - クリックされたCanvas上のY座標
 * @returns {object|null} - クリックされた点オブジェクト、またはnull
 */
function getClickedPoint(clickX, clickY) {
    let closestPoint = null;
    let minDistance = 10; // クリック判定の半径

    drawnPoints.forEach(point => {
        // パンとズームを考慮した座標でクリック判定
        const transformedX = point.canvasX * zoomLevel + panOffset.x;
        const transformedY = point.canvasY * zoomLevel + panOffset.y;
        const distance = Math.sqrt(Math.pow(transformedX - clickX, 2) + Math.pow(transformedY - clickY, 2));
        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = point;
        }
    });
    return closestPoint;
}

/**
 * 2点間の距離を計算する
 * @param {object} p1 - 点1
 * @param {object} p2 - 点2
 * @returns {number} - 距離
 */
function calculateDistance(p1, p2) {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
}

/**
 * すべての点を再描画する
 */
function redrawAllPoints() {
    clearCanvas();
    drawAxes();
    
    // 描画された線を再描画
    drawnLines.forEach(line => {
        drawLine(line.p1, line.p2);
    });
    
    // 距離ラベルを再描画
    distanceLabels.forEach(label => {
        drawDistanceLabel(label.x, label.y, label.text, label.angle);
    });
    
    // 点を再描画
    drawnPoints.forEach(p => {
        drawPoint(p.canvasX, p.canvasY, p.name, p === previousPoint);
    });
}

/**
 * 2点間に線を描画する
 * @param {object} p1 - 点1
 * @param {object} p2 - 点2
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
 * キャンバス上に距離ラベルを描画する
 * @param {number} x - X座標
 * @param {number} y - Y座標
 * @param {string} text - 表示するテキスト
 * @param {number} angle - 線の角度（ラジアン）
 */
function drawDistanceLabel(x, y, text, angle = 0) {
    ctx.save();
    
    // パンとズームを適用した座標に移動し、回転させる
    const transformedX = x * zoomLevel + panOffset.x;
    const transformedY = y * zoomLevel + panOffset.y;
    
    ctx.translate(transformedX, transformedY);
    ctx.rotate(angle);
    
    // 背景を描画
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = `${12 * zoomLevel}px Arial`;
    const textWidth = ctx.measureText(text).width;
    const padding = 3 * zoomLevel;
    ctx.fillRect(-textWidth/2 - padding, -8 * zoomLevel - padding, textWidth + padding*2, 16 * zoomLevel + padding*2);
    
    // テキストを描画
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, 0);
    
    ctx.restore();
}

/**
 * 距離履歴を表示する
 */
function updateDistanceDisplay() {
    if (distanceHistory.length > 0) {
        const historyText = distanceHistory.join('<br>');
        infoDisplay.innerHTML = `距離履歴:<br>${historyText}`;
    }
}

// 初期描画
clearCanvas();
drawAxes();
plotPoints(); // 初期座標を描画