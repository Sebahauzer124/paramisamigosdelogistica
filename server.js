const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { generarVentas } = require('./ventas');

const app = express();
const PORT = process.env.PORT || 3000;

const esServidor = process.env.RENDER === 'true' || process.env.VERCEL === '1';
const carpetaTemp = '/tmp';
const carpetaEscritorio = esServidor ? carpetaTemp : path.join(os.homedir(), 'Desktop');

app.use(express.static('public'));

// 👉 Ejecutar procesos
app.get('/ejecutar/:script', async (req, res) => {
  const { script } = req.params;
  const { fecha, desde, hasta } = req.query;

  try {
    switch (script) {
      case 'ventas':
        if (!desde || !hasta) {
          return res.status(400).send('❌ Faltan fechas desde/hasta.');
        }

        const archivoVentas = await generarVentas(desde, hasta);
        const nombreArchivo = path.basename(archivoVentas);

        if (!fs.existsSync(archivoVentas)) {
          return res.status(404).send('❌ No se encontró el archivo generado.');
        }

        res.download(archivoVentas, nombreArchivo, err => {
          if (err) {
            console.error('❌ Error enviando archivo:', err);
            res.status(500).send('❌ Error enviando archivo.');
          } else {
            console.log(`✅ Archivo enviado: ${nombreArchivo}`);
          }
        });
        break;

      default:
        res.status(400).send('❌ Script no válido.');
        break;
    }
  } catch (error) {
    console.error(`❌ Error ejecutando ${script}:`, error.message);
    res.status(500).send(`❌ Error ejecutando ${script}: ${error.message}`);
  }
});

// 👉 Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
