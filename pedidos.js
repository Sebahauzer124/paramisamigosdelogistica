const axios = require('axios');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// 📌 Configuración
const BASE_URL = 'http://appserver31.dyndns.org:8102/web/api/chess/v1';
const USUARIO = 'nyapura';
const PASSWORD = '1234';
const DIR_DESTINO = 'G:\\Mi unidad\\nicobe';

// 🗓️ Filtros de búsqueda
const filtros = {
  fechaEntrega: '2025-05-02',
  fechaPedido: '', // podés poner una fecha acá si querés usarla
  facturado: 'true' // true / false / ''
};

// ✅ Validar fecha
function validarFecha(f) {
  return f === '' || (/^\d{4}-\d{2}-\d{2}$/.test(f) && !isNaN(new Date(f).getTime()));
}

// ✅ Login
async function obtenerSessionId() {
  try {
    const { data, headers } = await axios.post(`${BASE_URL}/auth/login`, {
      usuario: USUARIO,
      password: PASSWORD
    }, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    let sid = data.sessionId;
    if (sid?.startsWith('JSESSIONID=')) sid = sid.replace('JSESSIONID=', '');

    if (!sid && headers['set-cookie']) {
      const match = headers['set-cookie'][0].match(/JSESSIONID=([^;]+)/);
      if (match) sid = match[1];
    }

    if (!sid) throw new Error('No se obtuvo sessionId');
    console.log('✅ Login OK:', sid);
    return sid;
  } catch (e) {
    console.error('❌ Login falló:', e.message);
    return null;
  }
}

// ✅ Guardar JSON para debug
async function guardarJSON(data, nombre) {
  if (!fs.existsSync(DIR_DESTINO)) fs.mkdirSync(DIR_DESTINO, { recursive: true });
  const ruta = path.join(DIR_DESTINO, nombre);
  await fs.promises.writeFile(ruta, JSON.stringify(data, null, 2));
  console.log(`📄 ${nombre} guardado`);
}

// ✅ Obtener pedidos
async function obtenerPedidos(sid) {
  try {
    const res = await axios.get(`${BASE_URL}/pedidos/`, {
      headers: {
        'Accept': 'application/json',
        Cookie: `JSESSIONID=${sid}`
      },
      params: {
        fechaEntrega: filtros.fechaEntrega,
        fechaPedido: filtros.fechaPedido,
        facturado: filtros.facturado
      }
    });

    await guardarJSON(res.data, 'respuesta_api_pedidos.json');
    return res.data.pedidos || [];
  } catch (e) {
    console.error('❌ Error al obtener pedidos:', e.message);
    return [];
  }
}

// ✅ Procesar cabeceras
function procesarCabeceras(pedidos) {
  const campos = [
    'idPedido', 'origen', 'idUsuario', 'idEmpresa', 'idSucursal',
    'idFuerzaVentas', 'idDeposito', 'idFormaPago', 'idTipoDocumento',
    'idCliente', 'idAliasCliente', 'fechaEntrega', 'idVendedor', 'idModoAtencion'
  ];
  return pedidos.map(p => campos.reduce((acc, key) => {
    acc[key] = p[key] ?? '';
    return acc;
  }, {}));
}

// ✅ Procesar líneas de pedido
function procesarLineas(pedidos) {
  const camposCabecera = ['idPedido', 'idCliente', 'fechaEntrega', 'idVendedor', 'origen'];
  const camposLinea = [
    'idLineaDetalle', 'idMotivoCambio', 'idArticulo', 'cantBultos',
    'cantUnidades', 'pesoKilos', 'precioUnitario', 'bonificacion'
  ];

  const filas = [];

  pedidos.forEach(pedido => {
    const cab = camposCabecera.reduce((acc, key) => {
      acc[key] = pedido[key] ?? '';
      return acc;
    }, {});

    (pedido.items || []).forEach(item => {
      const fila = { ...cab };
      camposLinea.forEach(k => fila[k] = item[k] ?? '');
      filas.push(fila);
    });
  });

  return filas;
}

// ✅ Exportar a Excel
async function exportarExcel(cabeceras, lineas) {
  const wb = new ExcelJS.Workbook();

  if (cabeceras.length) {
    const wsCab = wb.addWorksheet('Pedidos');
    wsCab.columns = Object.keys(cabeceras[0]).map(k => ({ header: k, key: k, width: 20 }));
    cabeceras.forEach(r => wsCab.addRow(r));
  }

  if (lineas.length) {
    const wsDet = wb.addWorksheet('DetallePedidos');
    wsDet.columns = Object.keys(lineas[0]).map(k => ({ header: k, key: k, width: 20 }));
    lineas.forEach(r => wsDet.addRow(r));
  }

  const archivo = path.join(DIR_DESTINO, 'pedidos.xlsx');
  await wb.xlsx.writeFile(archivo);
  console.log('✅ Excel guardado en:', archivo);
}

// 🏁 Ejecución principal
(async () => {
  if (!validarFecha(filtros.fechaEntrega) || !validarFecha(filtros.fechaPedido)) {
    console.error('✋ Fecha inválida');
    return;
  }

  const sid = await obtenerSessionId();
  if (!sid) return;

  const pedidos = await obtenerPedidos(sid);

  if (!pedidos.length) {
    console.warn('❗ No hay pedidos para exportar');
    return;
  }

  const cabeceras = procesarCabeceras(pedidos);
  const lineas = procesarLineas(pedidos);

  await exportarExcel(cabeceras, lineas);
})();
