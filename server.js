const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 3000;

// Carpeta Escritorio del usuario (donde los scripts guardan archivos)
const ESCRITORIO = path.join(os.homedir(), 'Desktop');

app.use(express.static('public'));

// Ejecutar scripts
app.get('/ejecutar/:script', (req, res) => {
  const { script } = req.params;
  const { fecha, desde, hasta } = req.query;

  let comando;

  switch (script) {
    case 'combustible':
      comando = `node combustible.js`;
      break;

    case 'checklist':
      if (desde && hasta) {
        comando = `node checklist.js ${desde} ${hasta}`;
      } else if (fecha) {
        comando = `node checklist.js ${fecha} ${fecha}`;
      } else {
        return res.status(400).send('❌ Faltan parámetros: fecha o rango desde/hasta.');
      }
      break;

    default:
      return res.status(400).send('❌ Script no válido.');
  }

  console.log(`⏳ Ejecutando: ${comando}`);

  exec(comando, (error, stdout, stderr) => {
    if (error) {
      console.error(`❌ Error ejecutando ${script}:`, stderr || error.message);
      return res.status(500).send(`❌ Error ejecutando ${script}.`);
    }

    console.log(`✅ ${script} ejecutado correctamente.`);
    res.send(`✅ ${script} ejecutado correctamente.`);
  });
});

// Ruta para descargar archivos guardados en el escritorio
app.get('/descargar/:archivo', (req, res) => {
  const archivo = req.params.archivo;
  const filePath = path.join(ESCRITORIO, archivo);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('❌ Archivo no encontrado');
  }

  res.download(filePath, archivo, (err) => {
    if (err) {
      console.error('Error al enviar archivo:', err);
      res.status(500).send('❌ Error al descargar el archivo');
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
