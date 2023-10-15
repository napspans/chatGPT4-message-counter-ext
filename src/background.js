// 定数の定義
const FILTER_URLS = ["https://chat.openai.com/backend-api/conversation"];
const MAX_TIMESTAMPS = 50;
const TIME_TO_COUNT = 3 * 60 * 60 * 1000;


// HTTPリクエストの監視設定
chrome.webRequest.onBeforeRequest.addListener(
  handlePostRequest,
  { urls: FILTER_URLS },
  ["requestBody"]
);

// 60秒（60000ミリ秒）ごとにupdateEveryMinuteを実行
setInterval(updateEveryMinute, 60000);

// 設定項目のデフォルト値
let showBadge = true;
let targetModel = "gpt-4";

// 初期設定の読み込み
chrome.storage.local.get(["showBadge", "targetModel"], (result) => {
  if (result.hasOwnProperty("showBadge")) {
    showBadge = result.showBadge;
  }
  if (result.hasOwnProperty("targetModel")) {
    targetModel = result.targetModel;
  }
});

// 設定が変更された時に変数を更新
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "local") {
    let shouldUpdateBadge = false;

    if (changes.hasOwnProperty("showBadge")) {
      showBadge = changes.showBadge.newValue;
      shouldUpdateBadge = true;
    }
    if (changes.hasOwnProperty("targetModel")) {
      targetModel = changes.targetModel.newValue;
    }

    if (shouldUpdateBadge) {
      chrome.storage.local.get(['timestamps'], (result) => {
        const currentCount = result.timestamps ? result.timestamps.length : 0;
        
        if (showBadge) {
          updateBadge(currentCount);
        } else {
          chrome.action.setBadgeText({text: ""});
        }
      });
    }
  }
});


// POSTリクエストを処理する関数
function handlePostRequest(details) {
  if (details.method !== "POST") return;

  const body = decodeURIComponent(
    String.fromCharCode.apply(null, new Uint8Array(details.requestBody.raw[0].bytes))
  );

  if (body.includes(`"model":"${targetModel}"`)) {
    const timestamp = Date.now();
    saveTimestamp(timestamp);
  }
}


// タイムスタンプを保存する関数
function saveTimestamp(timestamp) {
  chrome.storage.local.get(['timestamps'], (result) => {
    let timestamps = result.timestamps || [];
    timestamps = cleanupTimestamps(timestamps, timestamp);
    
    // showBadgeがtrueならばバッジを更新、falseならばバッジを消す
    if (showBadge) {
      updateBadge(timestamps.length);
    } else {
      chrome.action.setBadgeText({text: ""});
    }

    chrome.storage.local.set({timestamps});
  });
}

// タイムスタンプの処理を行う関数
function cleanupTimestamps(timestamps, newTimestamp) {
  timestamps.push(newTimestamp);
  timestamps.sort();
  
  if (timestamps.length > MAX_TIMESTAMPS) {
    timestamps = timestamps.slice(-MAX_TIMESTAMPS);
  }

  const threshold = Date.now() - TIME_TO_COUNT;
  return timestamps.filter((ts) => ts > threshold);
}

// グラデーション風のバッジ背景色とテキスト色を計算する関数
function calculateGradientColors(count) {
  let r, g, b;

  if (count <= 30) {
    // 単色: 緑 (R: 127, G: 255, B: 0)
    r = 127;
    g = 255;
    b = 0;
  } else if (count <= 40) {
    // 緑からオレンジへのグラデーション (R: 127-255, G: 255-110, B: 0)
    r = Math.floor(127 + (255 - 127) * ((count - 30) / (40 - 30)));
    g = Math.floor(255 - (255 - 110) * ((count - 30) / (40 - 30)));
    b = 0;
  } else if (count <= 45) {
    // オレンジから赤へのグラデーション (R: 255, G: 110-50, B: 0)
    r = 255;
    g = Math.floor(110 - (110 - 50) * ((count - 40) / (45 - 40)));
    b = 0;
  } else if (count <= 50) {
    // 単色: 赤 (R: 255, G: 50, B: 0)
    r = 255;
    g = 50;
    b = 0;
  }
  

  // RGBA形式に変換
  const bgColor = [r, g, b, 255];
  // 文字色を自動調整
  const textColor = (r * 0.299 + g * 0.587 + b * 0.114) > 186 ? [0, 0, 0, 255] : [255, 255, 255, 255];
  
  return [bgColor, textColor];
}

// バッジのスタイルを更新する関数
function updateBadge(count) {
  chrome.action.setBadgeText({text: count.toString()});

  const [bgColor, textColor] = calculateGradientColors(count);
  chrome.action.setBadgeBackgroundColor({color: bgColor});
  if (chrome.action.setBadgeTextColor) {
    chrome.action.setBadgeTextColor({color: textColor});
  }
}

// 毎分実行する関数
function updateEveryMinute() {
  chrome.storage.local.get(['timestamps'], (result) => {
    let timestamps = result.timestamps || [];

    if (timestamps.length > MAX_TIMESTAMPS) {
      timestamps = timestamps.slice(-MAX_TIMESTAMPS);
    }
  
    const threshold = Date.now() - TIME_TO_COUNT;
    const newTimestamps = timestamps.filter((ts) => ts > threshold);

    // 更新されたtimestampsを保存
    chrome.storage.local.set({timestamps:newTimestamps});
  });
}