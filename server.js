const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Detectar si corre en Render o Vercel
const esServidor = process.env.RENDER === 'true' || process.env.VERCEL === '1';
const desktopPath = esServidor ? '/tmp' : path.join(os.homedir(), 'Desktop');

// Servir archivos estáticos (HTML y JS frontend)
app.use(express.static('public'));

// Ruta para ejecutar scripts
app.get('/ejecutar/:script', (req, res) => {
    const { script } = req.params;
    const { fecha, desde, hasta } = req.query;

    let comando;

    if (script === 'combustible') {
        comando = 'node combustible.js';
    } else if (script === 'checklist') {
        if (desde && hasta) {
            comando = `node checklist.js ${desde} ${hasta}`;
        } else if (fecha) {
            comando = `node checklist.js ${fecha} ${fecha}`;
        } else {
            return res.status(400).send('❌ Faltan parámetros: fecha o rango desde/hasta.');
        }
    } else {
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

// Descarga archivo de vehículos (combustible)
app.get('https://paramisamigosdelogistica.onrender.com/descargar/combustible', (req, res) => {
    const filePath = path.join(desktopPath, 'vehiculos.xlsx');
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('⚠️ Archivo de vehículos no encontrado.');
    }
    res.download(filePath, 'vehiculos.xlsx');
});

// Descarga archivo de checklist (requiere rango de fechas)
app.get('https://paramisamigosdelogistica.onrender.com/descargar/checklist', (req, res) => {
    const { desde, hasta } = req.query;
    if (!desde || !hasta) {
        return res.status(400).send('⚠️ Faltan parámetros desde/hasta.');
    }

    const fileName = `checklists_${desde}_al_${hasta}.xlsx`;
    const filePath = path.join(desktopPath, fileName);

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('⚠️ Archivo de checklist no encontrado.');
    }

    res.download(filePath, fileName);
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
