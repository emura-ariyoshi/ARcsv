# AR CSV Viewer

スマートフォンのカメラにGPS座標のポイントを重ねて表示する小さなWebアプリです。

## できること

- カメラ映像を背景にしたAR風オーバーレイ
- CSVから座標データを読み込む
- QRコードからCSV URLまたはCSV本文を読み込む
- GPSで現在地を取得し、方向（コンパス）と距離で表示位置を計算
- 読み込んだポイントをリスト表示

## 実行方法

1. 依存パッケージをインストール
   ```bash
   npm install
   ```
2. 開発サーバー起動
   ```bash
   npm run dev -- --host 0.0.0.0
   ```
3. ブラウザで表示
   - ローカル: `http://localhost:5173`
   - スマホ: PCと同じWi-Fi上で端末のIPアドレスを開く

## GitHub Pages での公開

1. GitHub にリポジトリを作成
2. このプロジェクトを push
3. GitHub の Settings → Pages で source を `Deploy from a branch` に設定
4. branch は `main` / `gh-pages` のどちらかを選択
5. 公開URLをQRコードにする

GitHub Pages では `vite.config.js` の `base: './'` を使うことで、相対パスが正しく解決されます。

## 必要なブラウザ権限

- カメラ
- 位置情報
- 方位センサー（端末が対応している場合）

HTTPS または localhost で動作します。

## CSV形式

```csv
name,latitude,longitude
東京タワー,35.658581,139.745433
スカイツリー,35.710062,139.8107
```

## QRコード形式

QRコードには次のいずれかを入れてください。

- CSVファイルのHTTPS URL（例: `https://example.com/points.csv`）
- 上記CSV形式の本文
- `{ "csvUrl": "https://example.com/points.csv" }` 形式のJSON

CSV URLは、公開HTTPSサーバーからブラウザが取得できる必要があります。QR読み取りはカメラを起動した後に行い、読み取り完了後はGPSと方位に応じてポイントをAR風に配置します。

## 備考

- 現在の実装はモバイルWeb向けのAR風オーバーレイです。
- `deviceorientation` が使えない環境では、方位の更新が止まるため、位置や方向に応じて確認してください。
- 地点が画面外に出る場合は、表示条件に合わせて調整できます。
