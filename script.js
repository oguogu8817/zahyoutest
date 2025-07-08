// DOM要素の取得
const form = document.getElementById('coord-form');
const pointList = document.getElementById('point-list');
const addPointBtn = document.getElementById('add-point-btn');
const canvas = document.getElementById('plot-canvas');
const ctx = canvas.getContext('2d');
const infoDisplay = document.getElementById('info-display');
let pointCounter = 2;
let drawnPoints = []; // 描画された点を保存する配列
let selectedPoint = null; // 選択中の点を保持する変数

// 「点を追加」ボタンのクリックイベント
addPointBtn.addEventListener('click', function() {
    const newPointInput = document.createElement('div');
    newPointInput.classList.add('point-input');
    newPointInput.innerHTML = `
        <input type="text" name="name" placeholder="点名" value="P${pointCounter}">
        <input type="number" name="x" placeholder="X座標" required>
        <input type="number" name="y" placeholder="Y座標" required>
    `;
    pointList.appendChild(newPointInput);
    pointCounter++;
});

// フォーム送信イベントのリスナー
form.addEventListener('submit', function(event) {
    event.preventDefault(); // デフォルトの送信をキャンセル
    drawnPoints = []; // 描画前にリストをリセット
    selectedPoint = null; // 選択をリセット
    infoDisplay.textContent = '点をクリックして距離測定を開始します。';

    // Canvasをクリアして軸を再描画
    clearCanvas();
    drawAxes();

    // すべての入力欄から座標と点名を取得して描画
    const pointInputs = pointList.querySelectorAll('.point-input');
    pointInputs.forEach(input => {
        const name = input.querySelector('input[name="name"]').value;
        const x = parseFloat(input.querySelector('input[name="x"]').value);
        const y = parseFloat(input.querySelector('input[name="y"]').value);

        if (!isNaN(x) && !isNaN(y)) {
            const canvasX = canvas.width / 2 + x;
            const canvasY = canvas.height / 2 - y;
            drawnPoints.push({ name, x, y, canvasX, canvasY });
            drawPoint(canvasX, canvasY, name);
        }
    });
});

/**
 * Canvas上の指定された座標に点と点名を描画する関数
 * @param {number} canvasX - Canvas上のX座標
 * @param {number} canvasY - Canvas上のY座標
 * @param {string} name - 点名
 * @param {boolean} isSelected - 選択状態か
 */
function drawPoint(canvasX, canvasY, name, isSelected = false) {
    // 点の描画
    ctx.beginPath();
    ctx.arc(canvasX, canvasY, 7, 0, Math.PI * 2, true);
    ctx.fillStyle = isSelected ? 'blue' : 'red'; // 選択されている場合は色を変更
    ctx.fill();

    // 点名の描画
    ctx.fillStyle = 'black';
    ctx.font = '12px Arial';
    ctx.fillText(name, canvasX + 10, canvasY + 5);
}

/**
 * Canvasをクリアする関数
 */
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 初期状態でCanvasに軸を描画
function drawAxes() {
    ctx.beginPath();
    // X軸
    ctx.moveTo(0, canvas.height / 2);
    ctx.lineTo(canvas.width, canvas.height / 2);
    // Y軸
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.strokeStyle = '#ccc';
    ctx.stroke();
}

// Canvasのクリックイベントリスナー
canvas.addEventListener('click', function(event) {
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const clickedPoint = getClickedPoint(clickX, clickY);

    if (clickedPoint) {
        if (!selectedPoint) {
            // 1点目の選択
            selectedPoint = clickedPoint;
            infoDisplay.textContent = `${selectedPoint.name} を選択しました。2点目を選択してください。`;
            redrawAllPoints(); // ハイライト表示のために再描画
        } else {
            // 2点目の選択と距離計算
            const distance = calculateDistance(selectedPoint, clickedPoint);
            infoDisplay.textContent = `${selectedPoint.name} と ${clickedPoint.name} の距離: ${distance.toFixed(2)}`;
            
            // 2点間に線を描画
            drawLine(selectedPoint, clickedPoint);

            selectedPoint = null; // 選択をリセット
            // redrawAllPoints(); // 線を引いた後にハイライトを消す場合はコメントを外す
        }
    } else {
        // 何もない場所がクリックされたら選択をリセット
        selectedPoint = null;
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
        const distance = Math.sqrt(Math.pow(point.canvasX - clickX, 2) + Math.pow(point.canvasY - clickY, 2));
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
    drawnPoints.forEach(p => {
        drawPoint(p.canvasX, p.canvasY, p.name, p === selectedPoint);
    });
}

/**
 * 2点間に線を描画する
 * @param {object} p1 - 点1
 * @param {object} p2 - 点2
 */
function drawLine(p1, p2) {
    ctx.beginPath();
    ctx.moveTo(p1.canvasX, p1.canvasY);
    ctx.lineTo(p2.canvasX, p2.canvasY);
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 2;
    ctx.stroke();
}

// 初期描画
clearCanvas();
drawAxes();