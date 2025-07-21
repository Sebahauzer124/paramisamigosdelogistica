const express = require('express');
const { exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

// Servir archivos estáticos desde la carpeta 'public'
app.use(express.static('public'));

// Ruta para ejecutar scripts
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

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
