const axios   = require('axios');
const ExcelJS = require('exceljs');
const fs      = require('fs');
const path    = require('path');

// 📌 Configuración
const CONFIG = {
  BASE_URL:  'http://appserver31.dyndns.org:8102/web/api/chess/v1',
  USUARIO:   'nyapura',
  PASSWORD:  '1234',
  DESTINO:   'G:\\Mi unidad\\nicobe',
  FILTROS: {
    fechaDesde: '2025-05-02',
    fechaHasta: '2025-05-02',
  }
};

// 📅 Valida YYYY‑MM‑DD
function validarFecha(f) {
  return /^\d{4}-\d{2}-\d{2}$/.test(f) &&
         !isNaN(new Date(f).getTime());
}

// 🔐 Login y obtención de JSESSIONID
async function obtenerSessionId() {
  try {
    const { data, headers } = await axios.post(
      `${CONFIG.BASE_URL}/auth/login`,
      { usuario: CONFIG.USUARIO, password: CONFIG.PASSWORD },
      { headers: { 'Accept':'application/json','Content-Type':'application/json' } }
    );
    let sid = data.sessionId?.replace('JSESSIONID=','');
    if (!sid && headers['set-cookie']) {
      const m = headers['set-cookie'][0].match(/JSESSIONID=([^;]+)/);
      if (m) sid = m[1];
    }
    if (!sid) throw new Error('No llegó sessionId');
    console.log('✅ Login OK:', sid);
    return sid;
  } catch (err) {
    console.error('❌ Login falló:', err.message);
    return null;
  }
}

// 💾 Guarda JSON en disco
async function guardarJSON(nombre, obj) {
  if (!fs.existsSync(CONFIG.DESTINO)) {
    fs.mkdirSync(CONFIG.DESTINO, { recursive: true });
  }
  const ruta = path.join(CONFIG.DESTINO, nombre);
  await fs.promises.writeFile(ruta, JSON.stringify(obj, null, 2));
  console.log(`📄 ${nombre} guardado`);
}

// 📈 Descarga ventas detalladas
async function obtenerVentas(sid) {
  try {
    const res = await axios.get(`${CONFIG.BASE_URL}/ventas/`, {
      headers: { 'Accept':'application/json', Cookie:`JSESSIONID=${sid}` },
      params: {
        ...CONFIG.FILTROS,
        empresas:  '1',
        detallado: true,
        nroLote:   0
      }
    });
    await guardarJSON('respuesta_api_ventas.json', res.data);
    return res.data.dsReporteComprobantesApi?.VentasResumen || [];
  } catch (err) {
    console.error('❌ Error al obtener ventas:', err.message);
    return [];
  }
}

// 🗂 Filtra columnas de Resumen
function extraerResumen(comprobantes) {
  const campos = [
    'idEmpresa','dsEmpresa','idDocumento','dsDocumento','letra','serie',
    'nrodoc','anulado','idMovComercial','dsMovComercial','idRechazo','dsRechazo',
    'fechaComprobate','fechaAlta','usuarioAlta','fechaVencimiento','fechaEntrega',
    'idSucursal','dsSucursal','idFuerzaVentas','dsFuerzaVentas',
    'idDeposito','dsDeposito','idVendedor','dsVendedor',
    'idSupervisor','dsSupervisor','idGerente','dsGerente',
    'tipoConstribuyente','dsTipoConstribuyente',
    'idTipoPago','dsTipoPago','fechaPago',
    'idPedido','fechaPedido','origen','planillaCarga',
    'idFleteroCarga','dsFleteroCarga','idLiquidacion','fechaLiquidacion',
    'idCaja','fechaCaja','cajero',
    'idCliente','nombreCliente','domicilioCliente','codigoPostal','dsLocalidad',
    'idProvincia','dsProvincia','idNegocio','dsNegocio',
    'idAgrupacion','dsAgrupacion','idArea','dsArea',
    'idSegmentoMkt','dsSegmentoMkt','idCanalMkt','dsCanalMkt',
    'idSubcanalMkt','dsSubcanalMKT','fechaAsientoContable','nroAsientoContable',
    'nroPlanContable','codCuentaContable','idCentroCosto','dsCuentaContable',
    'subtotalBruto','subtotalBonificado','subtotalNeto','iva21','iva27','iva105',
    'per3337','iva2','percepcion212','percepcioniibb','internos','subtotalFinal',
    'tradespendg','tradespends','tradespendb','tradespendi','tradespendp','tradespendt',
    'totradspend','acciones','persiibbd','persiibbr','numerosserie','numerosactivo',
    'cuentayorden','codprovcyo','descrip','nrorendcyo','idTipoCambio','dsTipoCambio',
    'timbrado','cfdiEmitido','regimenFiscal','informado','firmadigital','proveedor',
    'fvigpcompra','preciocomprabr','preciocomprant','lineaCredito','estadoFiscal','numeracionFiscal'
  ];

  return comprobantes.map(c => {
    const obj = {};
    campos.forEach(k => obj[k] = c[k] ?? '');
    return obj;
  });
}

// 🧩 Extrae detalle de líneas
function extraerDetalle(comprobantes) {
  const camposLinea = [
    'idLinea','idArticulo','dsArticulo','idConcepto','dsConcepto',
    'esCombo','idCombo','idArticuloEstadistico','dsArticuloEstadistico',
    'presentacionArticulo','cantidadPorPallets','peso',
    'cantidadSolicitada','unidadesSolicitadas','cantidadesCorCargo','cantidadesSinCargo',
    'cantidadesTotal','pesoTotal','cantidadesRechazo','unimedcargo','unimedscargo','unimedtotal',
    'precioUnitarioBruto','bonificacion','precioUnitarioNeto','tipocambio','motivocambio','descmotcambio'
  ];

  const filas = [];
  comprobantes.forEach(c => {
    const lineas = c.lineas || c.líneas || [];
    lineas.forEach(l => {
      const row = { nrodoc: c.nrodoc }; // linkeo con nrodoc
      camposLinea.forEach(k => row[k] = l[k] ?? '');
      filas.push(row);
    });
  });
  return filas;
}

// 💾 Genera Excel con dos hojas
async function exportarExcel(comps) {
  const wb = new ExcelJS.Workbook();

  // Hoja Resumen
  const resumen = extraerResumen(comps);
  if (resumen.length) {
    const ws = wb.addWorksheet('Resumen');
    ws.columns = Object.keys(resumen[0]).map(k => ({ header:k, key:k, width:20 }));
    resumen.forEach(r => ws.addRow(r));
  }

  // Hoja Detalle
  const detalle = extraerDetalle(comps);
  if (detalle.length) {
    const ws2 = wb.addWorksheet('Detalle');
    ws2.columns = Object.keys(detalle[0]).map(k => ({ header:k, key:k, width:20 }));
    detalle.forEach(r => ws2.addRow(r));
  }

  const file = path.join(CONFIG.DESTINO, 'ventas_completo.xlsx');
  await wb.xlsx.writeFile(file);
  console.log('✅ Excel completo guardado en:', file);
}

// 🏁 Orquestador
(async () => {
  const { fechaDesde, fechaHasta } = CONFIG.FILTROS;
  if (!validarFecha(fechaDesde) || !validarFecha(fechaHasta)) {
    console.error('❗ Formato de fecha inválido');
    return;
  }

  const sid = await obtenerSessionId();
  if (!sid) return;

  const ventas = await obtenerVentas(sid);
  if (!ventas.length) {
    console.warn('❗ No hay ventas para exportar');
    return;
  }

  await exportarExcel(ventas);
})();

