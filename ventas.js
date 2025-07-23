const axios = require('axios');
const ExcelJS = require('exceljs');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 📌 Configuración para ventas
const CONFIG = {
  BASE_URL: 'http://appserver31.dyndns.org:8102/web/api/chess/v1',
  USUARIO: 'nyapura',
  PASSWORD: '1234',
  DESTINO: path.join(__dirname, 'archivos')
};

// Configuración para checklist
const CHECKLIST_API_URL = 'https://fleet.cloudfleet.com/api/v1/checklist/';
const CHECKLIST_API_TOKEN = 'GRXZmHk.Ux35aG6PkT3-sTMRYLnM4IR1YSkhqInHe';

// Asegura carpeta de destino para ventas
if (!fs.existsSync(CONFIG.DESTINO)) {
  fs.mkdirSync(CONFIG.DESTINO, { recursive: true });
}

// --- Funciones para Ventas ---

async function obtenerSessionId() {
  const { data, headers } = await axios.post(
    `${CONFIG.BASE_URL}/auth/login`,
    { usuario: CONFIG.USUARIO, password: CONFIG.PASSWORD },
    { headers: { Accept: 'application/json', 'Content-Type': 'application/json' } }
  );
  let sid = data.sessionId?.replace('JSESSIONID=', '');
  if (!sid && headers['set-cookie']) {
    const m = headers['set-cookie'][0].match(/JSESSIONID=([^;]+)/);
    if (m) sid = m[1];
  }
  if (!sid) throw new Error('No llegó sessionId');
  return sid;
}

async function obtenerVentas(sid, desde, hasta) {
  const res = await axios.get(`${CONFIG.BASE_URL}/ventas/`, {
    headers: { Accept: 'application/json', Cookie: `JSESSIONID=${sid}` },
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

function extraerResumen(comprobantes) {
  return comprobantes; // Ajusta según necesidad
}

function extraerDetalle(comprobantes) {
  return comprobantes; // Ajusta según necesidad
}

async function exportarExcelVentas(comps, desde, hasta) {
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

async function generarVentas(desde, hasta) {
  const sid = await obtenerSessionId();
  const ventas = await obtenerVentas(sid, desde, hasta);

  if (!ventas.length) {
    throw new Error('No hay ventas para exportar.');
  }

  const archivo = await exportarExcelVentas(ventas, desde, hasta);

  return archivo;
}

// --- Funciones para Checklists ---

function aplanarChecklist(checklist) {
  return {
    number: checklist.number,
    vehicle_id: checklist.vehicle?.id || '',
    vehicle_code: checklist.vehicle?.code || '',
    checklistDate: checklist.checklistDate,
    status_name: checklist.status?.name || '',
    voided_reason: checklist.voided?.voidedReason || '',
    startedAt: checklist.startedAt,
    endedAt: checklist.endedAt,
    durationInMinutes: checklist.durationInMinutes,
    type_name: checklist.type?.name || '',
    type_code: checklist.type?.code || '',
    odometer: checklist.odometer || '',
    hourmeter: checklist.hourmeter || '',
    driver: checklist.driver || '',
    schedule_nextDate: checklist.schedule?.nextDate || '',
    schedule_nextOdometer: checklist.schedule?.nextOdometer || '',
    schedule_nextHourmeter: checklist.schedule?.nextHourmeter || '',
    qtyVariablesApproved: checklist.statistics?.qtyVariablesApproved || 0,
    qtyVariablesRejected: checklist.statistics?.qtyVariablesRejected || 0,
    qtyVariablesCritical: checklist.statistics?.qtyVariablesCritical || 0,
    qtyTotalVariables: checklist.statistics?.qtyTotalVariables || 0,
    comment: checklist.comment || '',
    city_id: checklist.city?.id || '',
    city_name: checklist.city?.name || '',
    city_code: checklist.city?.code || '',
    costCenter: checklist.costCenter || '',
    primaryGroup: checklist.primaryGroup || '',
    secundaryGroup: checklist.secundaryGroup || '',
    createdAt: checklist.createdAt,
    createdBy_id: checklist.createdBy?.id || '',
    createdBy_name: checklist.createdBy?.name || ''
  };
}

async function descargarChecklists(fechaDesde, fechaHasta) {
  let checklistsTotales = [];
  let paginaActual = 1;
  const LIMITE_POR_PAGINA = 50;

  try {
    while (true) {
      const response = await axios.get(CHECKLIST_API_URL, {
        headers: {
          Authorization: `Bearer ${CHECKLIST_API_TOKEN}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        params: {
          checklistDateFrom: `${fechaDesde}T00:00:00Z`,
          checklistDateTo: `${fechaHasta}T23:59:59Z`,
          page: paginaActual
        }
      });

      const data = response.data?.data || response.data || [];

      if (!Array.isArray(data) || data.length === 0) {
        console.log(`🚩 Fin de resultados. Total final: ${checklistsTotales.length}`);
        break;
      }

      checklistsTotales = checklistsTotales.concat(data);

      console.log(`📄 Página ${paginaActual}: descargados ${data.length}, acumulados ${checklistsTotales.length}`);

      if (data.length < LIMITE_POR_PAGINA) {
        console.log('📌 Última página detectada por menos registros.');
        break;
      }

      paginaActual++;
    }

    if (checklistsTotales.length === 0) {
      console.log('⚠️ No se encontraron checklists.');
      return null;
    }

    const checklistsPlanos = checklistsTotales.map(aplanarChecklist);

    const worksheet = xlsx.utils.json_to_sheet(checklistsPlanos);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Checklists');

    const esServidor = process.env.RENDER === 'true' || process.env.VERCEL === '1';
    const saveFolder = esServidor ? '/tmp' : path.join(os.homedir(), 'Desktop');
    const excelPath = path.join(saveFolder, `checklists_${fechaDesde}_al_${fechaHasta}.xlsx`);

    xlsx.writeFile(workbook, excelPath);

    console.log(`✅ Archivo Excel generado en: ${excelPath}`);

    return excelPath;

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    throw error;
  }
}

// --- Función para correr ambas descargas juntas (opcional) ---
async function descargarVentasYChecklists(desde, hasta) {
  try {
    const archivoVentas = await generarVentas(desde, hasta);
    console.log('Archivo de ventas generado:', archivoVentas);

    const archivoChecklists = await descargarChecklists(desde, hasta);
    console.log('Archivo de checklists generado:', archivoChecklists);

    return { archivoVentas, archivoChecklists };
  } catch (error) {
    console.error('Error descargando ventas o checklists:', error);
    throw error;
  }
}

module.exports = {
  generarVentas,
  descargarChecklists,
  descargarVentasYChecklists
};
