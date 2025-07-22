const axios = require('axios');
const path = require('path');
const fs = require('fs');
const os = require('os');
const ExcelJS = require('exceljs');

const CONFIG = {
  BASE_URL: 'http://appserver31.dyndns.org:8102/web/api/chess/v1',
  USUARIO: 'nyapura',
  PASSWORD: '1234',
  DESTINO: path.join(os.homedir(), 'Desktop'), // Guardar en Escritorio
};

// Crear carpeta destino si no existe (el Escritorio siempre existe, pero por las dudas)
if (!fs.existsSync(CONFIG.DESTINO)) {
  fs.mkdirSync(CONFIG.DESTINO, { recursive: true });
}

// 🔐 Login para obtener sessionId
async function obtenerSessionId() {
  try {
    const response = await axios.post(
      `${CONFIG.BASE_URL}/auth/login`,
      {
        usuario: CONFIG.USUARIO,
        password: CONFIG.PASSWORD,
      },
      {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );

    // Extraer sessionId desde data o headers
    let sessionId = response.data.sessionId?.replace('JSESSIONID=', '');

    if (!sessionId && response.headers['set-cookie']) {
      const cookie = response.headers['set-cookie'].find((c) =>
        c.includes('JSESSIONID=')
      );
      if (cookie) {
        const match = cookie.match(/JSESSIONID=([^;]+)/);
        if (match) sessionId = match[1];
      }
    }

    if (!sessionId) throw new Error('No se pudo obtener sessionId tras login.');
    return sessionId;
  } catch (error) {
    throw new Error(`Error al obtener sessionId: ${error.message}`);
  }
}

// 🔍 Encuentra primer array de objetos en respuesta anidada
function encontrarPrimerArrayDeObjetos(obj) {
  if (Array.isArray(obj) && typeof obj[0] === 'object') return obj;
  if (typeof obj === 'object' && obj !== null) {
    for (const key in obj) {
      const result = encontrarPrimerArrayDeObjetos(obj[key]);
      if (result) return result;
    }
  }
  return null;
}

// 📦 Obtener artículos con filtros
async function obtenerArticulos(sessionId, filtros = {}) {
  try {
    const response = await axios.get(`${CONFIG.BASE_URL}/articulos/`, {
      headers: {
        Accept: 'application/json',
        Cookie: `JSESSIONID=${sessionId}`,
      },
      params: filtros,
    });

    const data = response.data;
    const lista = encontrarPrimerArrayDeObjetos(data);

    if (!lista || lista.length === 0) {
      throw new Error('No se encontró lista de artículos en la respuesta.');
    }

    console.log(`✅ Artículos obtenidos: ${lista.length}`);
    return lista;
  } catch (error) {
    const msg = error.response?.data || error.message;
    console.error('❌ Error obteniendo artículos:', msg);
    throw new Error(`Error al obtener artículos: ${msg}`);
  }
}

// 📤 Exportar artículos a Excel
async function exportarArticulosExcel(articulos, infoExtra = null) {
  if (!Array.isArray(articulos) || articulos.length === 0) {
    throw new Error('No hay artículos para exportar.');
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Artículos');

  // Fila informativa opcional
  if (infoExtra) {
    worksheet.addRow([infoExtra]);
    worksheet.addRow([]); // línea vacía
  }

  // Columnas base y agregadas
  const columnasBase = [
    'idArticulo', 'desArticulo', 'unidadesBulto', 'anulado', 'fechaAlta',
    'factorVenta', 'minimoVenta', 'pesable', 'pesoCotaSuperior', 'pesoCotaInferior',
    'esCombo', 'exentoIva', 'inafecto', 'exonerado', 'ivaDiferencial', 'tasaIva',
    'tasaInternos', 'internosBulto', 'tasaIibb', 'esAlcoholico', 'visibleMobile',
    'esComodatable', 'desCortaArticulo', 'tieneRetornables', 'bultosPallet',
    'pisosPallet', 'pesoBulto', 'llevaFrescura', 'esActivoFijo', 'cantidadPuertas',
    'litrosRepago', 'idArtUsado', 'aniosAmortizacion'
  ];

  const columnasExtras = ['agrupaciones_info', 'relaciones_info'];

  // Definir columnas
  worksheet.columns = [...columnasBase, ...columnasExtras].map((key) => ({
    header: key,
    key,
    width: 25,
  }));

  // Agregar artículos al Excel
  for (const art of articulos) {
    const fila = {};

    columnasBase.forEach((col) => {
      fila[col] = art[col] ?? '';
    });

    // Serializar agrupaciones
    fila['agrupaciones_info'] = Array.isArray(art.eAgrupaciones)
      ? art.eAgrupaciones
          .map((a) => `${a.desFormaAgrupar}: ${a.desAgrupacion}`)
          .join(' | ')
      : '';

    // Serializar relaciones
    fila['relaciones_info'] = Array.isArray(art.eRelArticulo)
      ? art.eRelArticulo
          .map((r) => `${r.desArtRetornable} (${r.cantidadRelacion})`)
          .join(' | ')
      : '';

    worksheet.addRow(fila);
  }

  const archivoDestino = path.join(CONFIG.DESTINO, 'articulos_exportados.xlsx');
  await workbook.xlsx.writeFile(archivoDestino);

  console.log(`✅ Excel exportado correctamente: ${archivoDestino}`);
  return archivoDestino;
}

// Exportar funciones para usar en otro archivo
module.exports = {
  obtenerSessionId,
  obtenerArticulos,
  exportarArticulosExcel,
};
