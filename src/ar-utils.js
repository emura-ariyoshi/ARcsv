import proj4 from 'proj4';

const PLANE_RECTANGULAR_ZONE_III = 'JGD2011 / Japan Plane Rectangular CS III';

proj4.defs(PLANE_RECTANGULAR_ZONE_III, '+proj=tmerc +lat_0=36 +lon_0=134.3333333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs');

export function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, '').trim();
  if (!source) return [];

  const delimiter = detectDelimiter(source);
  const records = parseRecords(source, delimiter);
  if (records.length < 2) return [];

  const columns = records[0].map(normalizeColumnName);

  return records
    .slice(1)
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => {
      const item = {};

      columns.forEach((column, index) => {
        item[column] = values[index]?.trim() ?? '';
      });

      let latitude = Number(item.latitude ?? item.lat);
      let longitude = Number(item.longitude ?? item.lng ?? item.lon);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        const x = Number(item.planeX ?? item.northing);
        const y = Number(item.planeY ?? item.easting);

        if (Number.isFinite(x) && Number.isFinite(y)) {
          [longitude, latitude] = proj4(
            PLANE_RECTANGULAR_ZONE_III,
            'EPSG:4326',
            [y, x],
          );
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
  const normalized = column.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/[\s_\-]/g, '');
  const aliases = {
    名称: 'name',
    名前: 'name',
    地点名: 'name',
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
