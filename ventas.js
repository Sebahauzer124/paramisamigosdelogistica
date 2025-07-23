const axios    = require('axios');
const ExcelJS  = require('exceljs');
const fs       = require('fs');
const path     = require('path');

// 📌 Configuración
const CONFIG = {
  BASE_URL:  'http://appserver31.dyndns.org:8102/web/api/chess/v1',
  USUARIO:   'nyapura',
  PASSWORD:  '1234',
  DESTINO:   path.join(__dirname, 'archivos')
};

// Asegura carpeta de destino
if (!fs.existsSync(CONFIG.DESTINO)) {
  fs.mkdirSync(CONFIG.DESTINO, { recursive: true });
}

// 🔐 Login y obtención de JSESSIONID
async function obtenerSessionId() {
  const { data, headers } = await axios.post(
    `${CONFIG.BASE_URL}/auth/login`,
    { usuario: CONFIG.USUARIO, password: CONFIG.PASSWORD },
    { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' } }
  );
  let sid = data.sessionId?.replace('JSESSIONID=', '');
  if (!sid && headers['set-cookie']) {
    const m = headers['set-cookie'][0].match(/JSESSIONID=([^;]+)/);
    if (m) sid = m[1];
  }
  if (!sid) throw new Error('No llegó sessionId');
  return sid;
}

// 📊 Descarga ventas detalladas
async function obtenerVentas(sid, desde, hasta) {
  const res = await axios.get(`${CONFIG.BASE_URL}/ventas/`, {
    headers: { 'Accept': 'application/json', Cookie: `JSESSIONID=${sid}` },
    params: {
      fechaDesde: desde,
      fechaHasta: hasta,
      empresas: '1',
      detallado: true,
      nroLote: 0
    }
  });
  return res.data.dsReporteComprobantesApi?.VentasResumen || [];
}

// Funciones de filtrado (completá según tu lógica)
function extraerResumen(comprobantes) {
  return comprobantes;  // Ajustá según lo que necesites exportar
}

function extraerDetalle(comprobantes) {
  return comprobantes;  // Ajustá según lo que necesites exportar
}

// 📁 Genera el archivo Excel
async function exportarExcel(comps, desde, hasta) {
  const wb = new ExcelJS.Workbook();
  const resumen = extraerResumen(comps);

  if (resumen.length) {
    const ws = wb.addWorksheet('Resumen');
    ws.columns = Object.keys(resumen[0]).map(k => ({ header: k, key: k, width: 20 }));
    resumen.forEach(r => ws.addRow(r));
  }

  const detalle = extraerDetalle(comps);

  if (detalle.length) {
    const ws2 = wb.addWorksheet('Detalle');
    ws2.columns = Object.keys(detalle[0]).map(k => ({ header: k, key: k, width: 20 }));
    detalle.forEach(r => ws2.addRow(r));
  }

  const nombreArchivo = `ventas_${desde}_al_${hasta}.xlsx`;
  const rutaArchivo = path.join(CONFIG.DESTINO, nombreArchivo);

  await wb.xlsx.writeFile(rutaArchivo);

  return rutaArchivo;
}

// Función principal exportada
async function generarVentas(desde, hasta) {
  const sid = await obtenerSessionId();
  const ventas = await obtenerVentas(sid, desde, hasta);

  if (!ventas.length) {
    throw new Error('No hay ventas para exportar.');
  }

  const archivo = await exportarExcel(ventas, desde, hasta);

  return archivo;
}

module.exports = { generarVentas };
