const axios = require('axios');
const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

// 🔧 Configuración base
const CONFIG = {
  BASE_URL: 'http://appserver31.dyndns.org:8102/web/api/chess/v1',
  USUARIO: 'nyapura',
  PASSWORD: '1234',
  DESTINO: path.join(__dirname, 'archivos'),
};

// 📂 Asegurar carpeta de destino
if (!fs.existsSync(CONFIG.DESTINO)) {
  fs.mkdirSync(CONFIG.DESTINO, { recursive: true });
}

// 🔐 Autenticación y obtención de JSESSIONID
async function obtenerSessionId() {
  const response = await axios.post(
    `${CONFIG.BASE_URL}/auth/login`,
    { usuario: CONFIG.USUARIO, password: CONFIG.PASSWORD },
    { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }
  );

  const { data, headers } = response;
  let sid = data.sessionId?.replace('JSESSIONID=', '');

  if (!sid && headers['set-cookie']) {
    const match = headers['set-cookie'][0].match(/JSESSIONID=([^;]+)/);
    if (match) sid = match[1];
  }

  if (!sid) throw new Error('❌ No se pudo obtener sessionId.');
  return sid;
}

// 📊 Obtener datos de ventas
async function obtenerDatosVentas(sessionId, desde, hasta) {
  const response = await axios.get(`${CONFIG.BASE_URL}/ventas/`, {
    headers: {
      Accept: 'application/json',
      Cookie: `JSESSIONID=${sessionId}`,
    },
    params: {
      fechaDesde: desde,
      fechaHasta: hasta,
      empresas: '1',
      detallado: true,
      nroLote: 0,
    },
  });

  return response.data?.dsReporteComprobantesApi?.VentasResumen || [];
}

// 🧾 Procesamiento (modificable según tu lógica)
function obtenerResumen(ventas) {
  return ventas;
}

function obtenerDetalle(ventas) {
  return ventas;
}

// 📁 Exportar archivo Excel
async function exportarVentasExcel(ventas, desde, hasta) {
  const workbook = new ExcelJS.Workbook();

  const resumen = obtenerResumen(ventas);
  if (resumen.length) {
    const wsResumen = workbook.addWorksheet('Resumen');
    wsResumen.columns = Object.keys(resumen[0]).map(key => ({
      header: key,
      key,
      width: 20,
    }));
    resumen.forEach(item => wsResumen.addRow(item));
  }

  const detalle = obtenerDetalle(ventas);
  if (detalle.length) {
    const wsDetalle = workbook.addWorksheet('Detalle');
    wsDetalle.columns = Object.keys(detalle[0]).map(key => ({
      header: key,
      key,
      width: 20,
    }));
    detalle.forEach(item => wsDetalle.addRow(item));
  }

  const nombreArchivo = `ventas_${desde}_al_${hasta}.xlsx`;
  const rutaArchivo = path.join(CONFIG.DESTINO, nombreArchivo);

  await workbook.xlsx.writeFile(rutaArchivo);
  return rutaArchivo;
}

// 🚀 Función principal
async function generarVentas(desde, hasta) {
  const sessionId = await obtenerSessionId();
  const ventas = await obtenerDatosVentas(sessionId, desde, hasta);

  if (!ventas.length) {
    throw new Error('⚠️ No hay ventas para exportar.');
  }

  const archivoExcel = await exportarVentasExcel(ventas, desde, hasta);
  return archivoExcel;
}

module.exports = { generarVentas };
