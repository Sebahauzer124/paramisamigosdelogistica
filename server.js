const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { generarVentas } = require('./ventas');
const { obtenerSessionId, obtenerArticulos, exportarArticulosExcel } = require('./articulos');
const { obtenerStock, exportarStockExcel } = require('./stock');

const app = express();
const PORT = process.env.PORT || 3000;

const esServidor = process.env.RENDER === 'true' || process.env.VERCEL === '1';
const carpetaArchivos = esServidor ? '/tmp' : path.join(__dirname, 'archivos');
const carpetaEscritorio = esServidor ? '/tmp' : path.join(os.homedir(), 'Desktop');

app.use(express.static('public'));

// 👉 Ejecutar procesos
app.get('/ejecutar/:script', async (req, res) => {
  const { script } = req.params;
  const { fecha, desde, hasta, articulo, nroLote, anulado, idDeposito, frescura } = req.query;

  try {
    switch (script) {
      case 'combustible':
        return ejecutarComando('node combustible.js', res);

      case 'checklist':
        if (!fecha && (!desde || !hasta)) {
          return res.status(400).send('❌ Faltan parámetros: fecha o rango desde/hasta.');
        }
        const inicio = desde || fecha;
        const fin = hasta || fecha;
        return ejecutarComando(`node checklist.js ${inicio} ${fin}`, res);

      case 'ventas':
        if (!desde || !hasta) {
          return res.status(400).send('❌ Faltan fechas desde/hasta.');
        }
        const archivoVentas = await generarVentas(desde, hasta);
        return res.send(`✅ Ventas exportadas. Archivo: ${path.basename(archivoVentas)}`);

      case 'articulos':
        const sid = await obtenerSessionId();
        const anuladoBool = anulado === 'true' || anulado === '1';

        const filtros = {
          articulo: articulo || '',
          nroLote: nroLote || '',
          anulado: anuladoBool,
        };

        const articulos = await obtenerArticulos(sid, filtros);

        if (!Array.isArray(articulos) || articulos.length === 0) {
          return res.send('⚠️ No hay artículos para exportar.');
        }

        const nombreArchivo = `articulos_${Date.now()}.xlsx`;
        const rutaArchivo = path.join(carpetaEscritorio, nombreArchivo);

        await exportarArticulosExcel(articulos, `Exportado desde ${desde || 'inicio'} hasta ${hasta || 'fin'}`, rutaArchivo);

        return res.send({
          mensaje: `✅ Artículos exportados.`,
          archivo: nombreArchivo,
        });

      // ✅ CORREGIDO: caso stock con orden correcto de parámetros
      case 'stock':
        if (!idDeposito || (frescura !== 'true' && frescura !== 'false')) {
          return res.status(400).send('❌ Faltan parámetros obligatorios: idDeposito y frescura.');
        }

        const fechaStock = fecha || null;
        const frescuraBool = frescura === 'true';

        // ⚠️ ORDEN CORRECTO: fecha, idDeposito, frescura
        const stockData = await obtenerStock(fechaStock, idDeposito, frescuraBool);

        if (!Array.isArray(stockData) || stockData.length === 0) {
          return res.send('⚠️ No hay datos de stock para exportar.');
        }

        const nombreArchivoStock = `stock_${Date.now()}.xlsx`;
        const rutaArchivoStock = path.join(carpetaEscritorio, nombreArchivoStock);

        await exportarStockExcel(stockData, `Exportado Stock del depósito ${idDeposito} - frescura: ${frescura}`, rutaArchivoStock);

        return res.send({
          mensaje: `✅ Stock exportado.`,
          archivo: nombreArchivoStock,
        });

      default:
        return res.status(400).send('❌ Script no válido.');
    }
  } catch (error) {
    console.error(`❌ Error ejecutando ${script}:`, error.message);
    res.status(500).send(`❌ Error ejecutando ${script}: ${error.message}`);
  }
});

// 👉 Ejecutar un comando de shell
function ejecutarComando(comando, res) {
  console.log(`⏳ Ejecutando: ${comando}`);
  exec(comando, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Error ejecutando: ${stderr || error.message}`);
      return res.status(500).send(`❌ Error ejecutando: ${error.message}`);
    }
    console.log(`✅ Comando ejecutado correctamente.`);
    res.send(`✅ Proceso ejecutado correctamente.`);
  });
}

// 👉 Descargar archivo
function descargarArchivo(res, rutaArchivo, nombreArchivo) {
  if (!fs.existsSync(rutaArchivo)) {
    return res.status(404).send('❌ Archivo no encontrado.');
  }
  res.download(rutaArchivo, nombreArchivo, (err) => {
    if (err) {
      console.error('❌ Error enviando archivo:', err);
      res.status(500).send('❌ Error enviando archivo.');
    }
  });
}

// 👉 Rutas de descarga
app.get('/descargar/combustible', (req, res) => {
  const ruta = path.join(carpetaEscritorio, 'vehiculos.xlsx');
  descargarArchivo(res, ruta, 'vehiculos.xlsx');
});

app.get('/descargar/checklist', (req, res) => {
  const { desde, hasta } = req.query;
  if (!desde || !hasta) return res.status(400).send('❌ Faltan fechas desde/hasta.');
  const archivo = `checklists_${desde}_al_${hasta}.xlsx`;
  const ruta = path.join(carpetaEscritorio, archivo);
  descargarArchivo(res, ruta, archivo);
});

app.get('/descargar/ventas', (req, res) => {
  const { desde, hasta } = req.query;
  if (!desde || !hasta) return res.status(400).send('❌ Faltan fechas desde/hasta.');
  const archivo = `ventas_${desde}_al_${hasta}.xlsx`;
  const ruta = path.join(carpetaArchivos, archivo);
  descargarArchivo(res, ruta, archivo);
});

app.get('/descargar/articulos', (req, res) => {
  const { archivo } = req.query;
  if (!archivo) return res.status(400).send('❌ Falta parámetro archivo.');
  const ruta = path.join(carpetaEscritorio, archivo);
  descargarArchivo(res, ruta, archivo);
});

// 👉 Ruta descarga stock
app.get('/descargar/stock', (req, res) => {
  const { archivo } = req.query;
  if (!archivo) return res.status(400).send('❌ Falta parámetro archivo.');
  const ruta = path.join(carpetaEscritorio, archivo);
  descargarArchivo(res, ruta, archivo);
});

// 👉 Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
