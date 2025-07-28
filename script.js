// DOM要素の取得
const form = document.getElementById("coord-form");
const pointList = document.getElementById("point-list");
const addPointBtn = document.getElementById("add-point-btn");
const removePointBtn = document.getElementById("remove-point-btn");
const panToggleBtn = document.getElementById("pan-toggle-btn");
const clearHistoryBtn = document.getElementById("clear-history-btn");
const canvas = document.getElementById("plot-canvas");
const ctx = canvas.getContext("2d");
const infoDisplay = document.getElementById("info-display");

// キャンバスのレスポンシブ対応
function resizeCanvas() {
  const container = document.querySelector(".container");
  const containerWidth = container.clientWidth - 32; // paddingを考慮

  // モバイル画面では画面幅に合わせる
  if (window.innerWidth < 768) {
    canvas.width = Math.min(containerWidth, 400);
    canvas.height = canvas.width; // 正方形を維持
  } else if (window.innerWidth < 1024) {
    canvas.width = 500;
    canvas.height = 500;
  } else {
    canvas.width = 600;
    canvas.height = 600;
  }

  // 再描画
  if (drawnPoints.length > 0) {
    redrawAll();
  }
}

// ページ読み込み時とリサイズ時にキャンバスをリサイズ
window.addEventListener("load", resizeCanvas);
window.addEventListener("resize", resizeCanvas);
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
const CLICK_RADIUS_BASE = 15; // クリック判定の基準半径
let anglePoints = []; // 角度計算用の3点を保存する配列
let angleLabels = []; // 角度ラベルを保存する配列

// --- イベントリスナー ---

// 「点を追加」ボタン
addPointBtn.addEventListener("click", function () {
  const newPointInput = document.createElement("div");
  newPointInput.classList.add("point-input");
  newPointInput.innerHTML = `
        <input type="text" name="name" placeholder="点名" value="P${pointCounter}">
        <input type="number" name="x" placeholder="X座標" step="0.001" required>
        <input type="number" name="y" placeholder="Y座標" step="0.001" required>
    `;
  pointList.appendChild(newPointInput);
  pointCounter++;
});

// 「点を削除」ボタン
removePointBtn.addEventListener("click", function () {
  const pointInputs = pointList.querySelectorAll(".point-input");
  if (pointInputs.length > 1) {
    pointList.removeChild(pointInputs[pointInputs.length - 1]);
    pointCounter--;
    // 描画ボタンが押されるまで再描画しない
  }
});

// 「パンモード切替」ボタン
panToggleBtn.addEventListener("click", function () {
  togglePanMode();
});

// 「距離履歴をクリア」ボタン
clearHistoryBtn.addEventListener("click", function () {
  distanceHistory = [];
  drawnLines = [];
  distanceLabels = [];
  anglePoints = [];
  angleLabels = [];
  previousPointForDistance = null;
  selectedPoint = null;
  infoDisplay.textContent = "点をクリックして選択または距離測定を開始します。";
  redrawAll();
});

// フォーム送信（描画実行）
form.addEventListener("submit", function (event) {
  event.preventDefault();
  plotPoints();
});

// --- Canvasイベント ---

// Pointer Eventsを使用してマウスとタッチを統一的に処理
canvas.addEventListener("pointerdown", handlePointerDown);
canvas.addEventListener("pointermove", handlePointerMove);
canvas.addEventListener("pointerup", handlePointerUp);
canvas.addEventListener("pointercancel", handlePointerCancel);

// ズーム (PC)
canvas.addEventListener("wheel", zoom);

// ダブルクリック/ダブルタップ処理 - リセット機能
canvas.addEventListener("dblclick", resetAllSelections);

// タッチ操作でのスクロール防止
canvas.style.touchAction = "none";

// --- 関数 ---

/**
 * 座標と点名からCanvasに描画する
 */
function plotPoints() {
  // 描画時のみ選択状態をリセット（点の再配置時）
  drawnPoints = [];
  selectedPoint = null;
  previousPointForDistance = null;
  distanceHistory = [];
  drawnLines = [];
  distanceLabels = [];
  anglePoints = [];
  angleLabels = [];
  infoDisplay.textContent = "点をクリックして選択または距離測定を開始します。";

  clearCanvas();

  const pointInputs = pointList.querySelectorAll(".point-input");
  const points = [];
  pointInputs.forEach((input) => {
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
  let minX = points[0].x,
    maxX = points[0].x;
  let minY = points[0].y,
    maxY = points[0].y;
  points.forEach((p) => {
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

  let scale = rangeX === 0 && rangeY === 0 ? 1 : Math.min(canvasWidth / (rangeX || 1), canvasHeight / (rangeY || 1));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  drawAxes(scale, centerX, centerY);

  points.forEach((p) => {
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
  const isSelected = p === selectedPoint;
  const transformedX = p.canvasX * zoomLevel + panOffset.x;
  const transformedY = p.canvasY * zoomLevel + panOffset.y;

  // 点
  ctx.beginPath();
  ctx.arc(transformedX, transformedY, 7 * zoomLevel, 0, Math.PI * 2, true);
  ctx.fillStyle = isSelected ? "blue" : "red"; // 選択時は青、通常は赤
  ctx.fill();

  // ラベル
  ctx.fillStyle = isSelected ? "blue" : "black"; // 選択時は青
  ctx.font = `${12 * zoomLevel}px Arial`;
  if (isSelected) {
    ctx.font = `bold ${12 * zoomLevel}px Arial`;
  }
  ctx.fillText(p.name, transformedX + 15 * zoomLevel, transformedY - 10 * zoomLevel);
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
  ctx.strokeStyle = "#ccc";
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

  drawnLines.forEach((line) => drawLine(line.p1, line.p2));
  distanceLabels.forEach((label) => drawDistanceLabel(label.x, label.y, label.text, label.angle));
  angleLabels.forEach((label) => drawAngleLabel(label.x, label.y, label.text));
  drawnPoints.forEach((p) => drawPoint(p));
}

// --- インタラクション関連の関数 ---

function handleCanvasClick(event) {
  if (isPanning) return;

  let clickX, clickY;

  // イベントがpointerEventからの呼び出しの場合、既に座標が調整されている
  if (typeof event.clientX === "number" && typeof event.clientY === "number") {
    clickX = event.clientX;
    clickY = event.clientY;
  } else {
    // 通常のクリックイベントの場合
    const rect = canvas.getBoundingClientRect();
    clickX = event.clientX - rect.left;
    clickY = event.clientY - rect.top;
  }

  const clickedPoint = getClickedPoint(clickX, clickY);

  // 点がクリックされた場合のみ処理
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
        infoDisplay.textContent = "選択を解除しました。";
      }
    }
    // Case 2: Clicking a new point.
    else {
      // If there was a point selected previously for distance measurement, measure distance to the new one.
      if (previousPointForDistance) {
        calculateAndDrawDistance(previousPointForDistance, clickedPoint);
      }

      // 角度計算のための点を追加
      anglePoints.push(clickedPoint);
      if (anglePoints.length > 3) {
        anglePoints.shift(); // 3点を超えたら最初の点を削除
      }

      // 3点揃ったら角度を計算して表示
      if (anglePoints.length === 3) {
        calculateAndDrawAngle(anglePoints[0], anglePoints[1], anglePoints[2]);
      }

      // Select the new point.
      selectedPoint = clickedPoint;
      // Set it as the starting point for the *next* distance measurement.
      previousPointForDistance = clickedPoint;

      // Update info display
      updateDistanceDisplay();
      updateAngleDisplay();
      if (distanceHistory.length > 0 || angleLabels.length > 0) {
        infoDisplay.innerHTML += `<br>${selectedPoint.name} を選択中。`;
      } else {
        infoDisplay.textContent = `${selectedPoint.name} を選択しました。次の点を選択して距離を測定します。`;
      }
    }
  }
  // 点以外がクリックされた場合は何もしない

  redrawAll();
}

/**
 * クリック/タップされた座標に最も近い点を返す（点名も含む）
 */
function getClickedPoint(clickX, clickY) {
  let closestPoint = null;
  // クリック判定の半径をズームレベルに合わせる
  let minDistance = CLICK_RADIUS_BASE * zoomLevel;

  drawnPoints.forEach((point) => {
    const transformedX = point.canvasX * zoomLevel + panOffset.x;
    const transformedY = point.canvasY * zoomLevel + panOffset.y;

    // 点本体との距離
    const distanceToPoint = Math.sqrt(Math.pow(transformedX - clickX, 2) + Math.pow(transformedY - clickY, 2));

    if (distanceToPoint < minDistance) {
      minDistance = distanceToPoint;
      closestPoint = point;
    }

    // 点名ラベルとの当たり判定
    const labelX = transformedX + 15 * zoomLevel;
    const labelY = transformedY - 10 * zoomLevel;
    ctx.font = `${12 * zoomLevel}px Arial`;
    const labelWidth = ctx.measureText(point.name).width;
    const labelHeight = 12 * zoomLevel;

    if (clickX >= labelX && clickX <= labelX + labelWidth && clickY >= labelY - labelHeight && clickY <= labelY) {
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
  drawnLines.push({ p1, p2 });

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
    angle: angle,
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
  ctx.strokeStyle = "blue";
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

  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.font = `${12 * zoomLevel}px Arial`;
  const textWidth = ctx.measureText(text).width;
  const padding = 3 * zoomLevel;
  ctx.fillRect(
    -textWidth / 2 - padding,
    -8 * zoomLevel - padding,
    textWidth + padding * 2,
    16 * zoomLevel + padding * 2
  );

  ctx.fillStyle = "#333";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * 距離履歴を更新
 */
function updateDistanceDisplay() {
  if (distanceHistory.length > 0) {
    infoDisplay.innerHTML = `距離履歴:<br>${distanceHistory.join("<br>")}`;
  }
}

/**
 * 3点間の角度を計算して描画
 */
function calculateAndDrawAngle(p1, p2, p3) {
  // ベクトル p2->p1 と p2->p3 を計算
  const vec1 = { x: p1.x - p2.x, y: p1.y - p2.y };
  const vec2 = { x: p3.x - p2.x, y: p3.y - p2.y };

  // 内積とベクトルの大きさを計算
  const dot = vec1.x * vec2.x + vec1.y * vec2.y;
  const mag1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
  const mag2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

  // 角度を計算（ラジアンから度に変換）
  const angleRad = Math.acos(dot / (mag1 * mag2));
  const angleDeg = angleRad * (180 / Math.PI);

  // 角度ラベルを配置（p2の位置）
  angleLabels.push({
    x: p2.canvasX,
    y: p2.canvasY - 20,
    text: `∠${p1.name}${p2.name}${p3.name}: ${angleDeg.toFixed(1)}°`,
  });
}

/**
 * 角度ラベルを描画
 */
function drawAngleLabel(x, y, text) {
  const transformedX = x * zoomLevel + panOffset.x;
  const transformedY = y * zoomLevel + panOffset.y;

  ctx.fillStyle = "rgba(255, 255, 0, 0.9)";
  ctx.font = `${12 * zoomLevel}px Arial`;
  const textWidth = ctx.measureText(text).width;
  const padding = 3 * zoomLevel;
  ctx.fillRect(
    transformedX - textWidth / 2 - padding,
    transformedY - 8 * zoomLevel - padding,
    textWidth + padding * 2,
    16 * zoomLevel + padding * 2
  );

  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, transformedX, transformedY);
}

/**
 * 角度表示を更新
 */
function updateAngleDisplay() {
  if (angleLabels.length > 0) {
    const angleTexts = angleLabels.map((label) => label.text);
    if (distanceHistory.length > 0) {
      infoDisplay.innerHTML += `<br>角度:<br>${angleTexts.join("<br>")}`;
    } else {
      infoDisplay.innerHTML = `角度:<br>${angleTexts.join("<br>")}`;
    }
  }
}

// --- パンとズームのハンドラ ---

function togglePanMode() {
  isPanning = !isPanning;
  canvas.style.cursor = isPanning ? "grab" : "default";

  // ボタンの見た目を更新
  if (isPanning) {
    panToggleBtn.classList.add("active");
    panToggleBtn.textContent = "パンモード OFF";
    infoDisplay.textContent = "パンモード: ドラッグで移動、ホイール/ピンチで拡大縮小。";
  } else {
    panToggleBtn.classList.remove("active");
    panToggleBtn.textContent = "パンモード";
    infoDisplay.textContent = "点をクリックして選択または距離測定を開始します。";
  }
}

// ダブルクリック時のリセット機能
function resetAllSelections(event) {
  event.preventDefault();

  // すべての選択や測定状態をリセット
  selectedPoint = null;
  previousPointForDistance = null;
  distanceHistory = [];
  drawnLines = [];
  distanceLabels = [];
  anglePoints = [];
  angleLabels = [];

  infoDisplay.textContent = "すべての選択と測定をリセットしました。";
  redrawAll();
}

// Pointer Events用の変数
let isPointerDown = false;
let lastClickTime = 0;
let lastPointerPosition = { x: 0, y: 0 };
let panThreshold = 5; // パンと判定する最小移動距離

function handlePointerDown(event) {
  event.preventDefault();
  isPointerDown = true;
  lastPointerPosition.x = event.clientX;
  lastPointerPosition.y = event.clientY;

  if (isPanning) {
    canvas.style.cursor = "grabbing";
    lastPanPoint.x = event.clientX;
    lastPanPoint.y = event.clientY;
  }
}

function handlePointerMove(event) {
  if (!isPointerDown) return;

  if (isPanning) {
    event.preventDefault();
    const deltaX = event.clientX - lastPanPoint.x;
    const deltaY = event.clientY - lastPanPoint.y;
    panOffset.x += deltaX;
    panOffset.y += deltaY;
    lastPanPoint.x = event.clientX;
    lastPanPoint.y = event.clientY;
    redrawAll();
  }
}

function handlePointerUp(event) {
  if (!isPointerDown) return;

  event.preventDefault();
  const deltaX = Math.abs(event.clientX - lastPointerPosition.x);
  const deltaY = Math.abs(event.clientY - lastPointerPosition.y);

  // パンモードでない場合、または移動距離が小さい場合はクリック処理
  if (!isPanning || (deltaX < panThreshold && deltaY < panThreshold)) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    handleCanvasClick({ clientX: x, clientY: y });
  }

  if (isPanning) {
    canvas.style.cursor = "grab";
  }

  isPointerDown = false;
}

function handlePointerCancel() {
  isPointerDown = false;
  if (isPanning) {
    canvas.style.cursor = "grab";
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

// --- 不要なイベント変数をクリーンアップ ---

// --- 初期化 ---
// 初期状態では点をプロットせず、キャンバスの軸のみ描画
clearCanvas();
drawAxes();
