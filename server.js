const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

const esServidor = process.env.RENDER === 'true' || process.env.VERCEL === '1';
const desktopPath = esServidor ? '/tmp' : path.join(os.homedir(), 'Desktop');

// Sirve archivos estáticos desde 'public'
app.use(express.static('public'));

// Ejecutar scripts: combustible.js y checklist.js (con params)
app.get('/ejecutar/:script', (req, res) => {
    const { script } = req.params;
    const { fecha, desde, hasta } = req.query;

    let comando;

    switch (script) {
        case 'combustible':
            comando = 'node combustible.js';
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

// Endpoint descarga archivo combustible
app.get('/descargar/combustible', (req, res) => {
    const filePath = path.join(desktopPath, 'vehiculos.xlsx');
    if (!fs.existsSync(filePath)) return res.status(404).send('Archivo no encontrado.');
    res.download(filePath, 'vehiculos.xlsx', err => {
        if (err) {
            console.error('Error enviando archivo:', err);
            res.status(500).send('Error enviando archivo.');
        }
    });
});

// Endpoint descarga archivo checklist (con fechas en query)
app.get('/descargar/checklist', (req, res) => {
    const { desde, hasta } = req.query;
    if (!desde || !hasta) return res.status(400).send('Faltan fechas desde/hasta.');
    const fileName = `checklists_${desde}_al_${hasta}.xlsx`;
    const filePath = path.join(desktopPath, fileName);
    if (!fs.existsSync(filePath)) return res.status(404).send('Archivo no encontrado.');
    res.download(filePath, fileName, err => {
        if (err) {
            console.error('Error enviando archivo:', err);
            res.status(500).send('Error enviando archivo.');
        }
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
