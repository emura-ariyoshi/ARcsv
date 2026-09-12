export function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const [headerLine, ...rows] = lines;
  const columns = headerLine.split(',').map((label) => label.trim().toLowerCase());

  return rows
    .map((row) => {
      const values = row.split(',').map((value) => value.trim());
      const item = {};

      columns.forEach((col, index) => {
        item[col] = values[index] ?? '';
      });

      const lat = Number(item.latitude ?? item.lat ?? item.y);
      const lng = Number(item.longitude ?? item.lng ?? item.lon ?? item.x);
      const label = item.name ?? item.label ?? item.title ?? '地点';

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      return { label, latitude: lat, longitude: lng };
    })
    .filter(Boolean);
}

export function fetchCsvFromUrl(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`CSVの取得に失敗しました: ${response.status}`);
    }
    return response.text();
  });
}
