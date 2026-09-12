import proj4 from 'proj4';

const PLANE_RECTANGULAR_ZONE_III = 'JGD2011 / Japan Plane Rectangular CS III';

proj4.defs(PLANE_RECTANGULAR_ZONE_III, '+proj=tmerc +lat_0=36 +lon_0=134.3333333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs');

export function wgs84ToPlaneRectangularZoneIII(latitude, longitude) {
  const [y, x] = proj4(
    'EPSG:4326',
    PLANE_RECTANGULAR_ZONE_III,
    [longitude, latitude],
  );

  return { x, y };
}

export function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, '').trim();
  if (!source) return [];

  const delimiter = detectDelimiter(source);
  const records = parseRecords(source, delimiter);
  if (!records.length) return [];

  const hasHeader = !isHeaderlessCoordinateRecord(records[0]);
  const columns = hasHeader
    ? records[0].map(normalizeColumnName)
    : ['name', 'planeX', 'planeY'];
  const dataRecords = hasHeader ? records.slice(1) : records;

  return dataRecords
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => {
      const item = {};

      columns.forEach((column, index) => {
        item[column] = values[index]?.trim() ?? '';
      });

      let latitude = parseCoordinate(item.latitude ?? item.lat);
      let longitude = parseCoordinate(item.longitude ?? item.lng ?? item.lon);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        const x = parseCoordinate(item.planeX ?? item.northing);
        const y = parseCoordinate(item.planeY ?? item.easting);

        if (Number.isFinite(x) && Number.isFinite(y)) {
          [longitude, latitude] = proj4(PLANE_RECTANGULAR_ZONE_III, 'EPSG:4326', [y, x]);
        }
      }

      const label = item.name ?? item.label ?? item.title ?? '地点';

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return null;
      }

      return { label, latitude, longitude };
    })
    .filter(Boolean);
}

function isHeaderlessCoordinateRecord(values) {
  return values.length >= 3
    && Number.isFinite(parseCoordinate(values[1]))
    && Number.isFinite(parseCoordinate(values[2]));
}

function parseCoordinate(value) {
  if (value === undefined || value === null || value === '') return NaN;
  return Number(String(value).replace(/,/g, '').trim());
}

function detectDelimiter(text) {
  const firstRecord = text.split(/\r?\n/, 1)[0];
  const candidates = [',', '\t', ';'];
  return candidates.reduce((best, candidate) => {
    const count = firstRecord.split(candidate).length;
    return count > best.count ? { delimiter: candidate, count } : best;
  }, { delimiter: ',', count: 1 }).delimiter;
}

function parseRecords(text, delimiter) {
  const records = [];
  let record = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      record.push(field);
      field = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else {
      field += character;
    }
  }

  if (quoted) return [];
  record.push(field);
  records.push(record);
  return records;
}

function normalizeColumnName(column) {
  const normalized = column
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_\-（）()［］\[\]]/g, '');
  const aliases = {
    名称: 'name',
    名前: 'name',
    地点名: 'name',
    点名: 'name',
    緯度: 'latitude',
    経度: 'longitude',
    lat: 'latitude',
    latitude: 'latitude',
    lng: 'longitude',
    lon: 'longitude',
    longitude: 'longitude',
    x: 'planeX',
    y: 'planeY',
    x座標: 'planeX',
    y座標: 'planeY',
    x座標m: 'planeX',
    y座標m: 'planeY',
    x座標メートル: 'planeX',
    y座標メートル: 'planeY',
    平面直角座標x: 'planeX',
    平面直角座標y: 'planeY',
    平面直角x: 'planeX',
    平面直角y: 'planeY',
    'x(m)': 'planeX',
    'y(m)': 'planeY',
    northing: 'northing',
    easting: 'easting',
  };
  return aliases[normalized] ?? normalized;
}

export function fetchCsvFromUrl(url) {
  return fetch(url).then((response) => {
    if (!response.ok) {
      throw new Error(`CSVの取得に失敗しました: ${response.status}`);
    }
    return response.text();
  });
}
