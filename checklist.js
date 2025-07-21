const express = require('express');
const axios = require('axios');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');

const API_URL = 'https://fleet.cloudfleet.com/api/v1/checklist/';
const API_TOKEN = 'GRXZmHk.Ux35aG6PkT3-sTMRYLnM4IR1YSkhqInHe';

const app = express();
const PORT = process.env.PORT || 3000;

// Detectar si corre en servidor (Render, Vercel) para usar carpeta /tmp, sino Escritorio local
const esServidor = process.env.RENDER === 'true' || process.env.VERCEL === '1';
const saveFolder = esServidor ? '/tmp' : path.join(os.homedir(), 'Desktop');

async function obtenerChecklists(fechaDesde, fechaHasta) {
    const params = {
        checklistDateFrom: `${fechaDesde}T00:00:00Z`,
        checklistDateTo: `${fechaHasta}T23:59:59Z`,
        page: 1
    };

    try {
        const response = await axios.get(API_URL, {
            headers: {
                Authorization: `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json; charset=utf-8'
            },
            params
        });
        return response.data || [];
    } catch (error) {
        throw error;
    }
}

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

async function exportarChecklistsAExcel(fechaDesde, fechaHasta) {
    const checklists = await obtenerChecklists(fechaDesde, fechaHasta);

    if (checklists.length === 0) {
        throw new Error('No se encontraron checklists.');
    }

    const checklistsPlanos = checklists.map(aplanarChecklist);

    const worksheet = xlsx.utils.json_to_sheet(checklistsPlanos);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Checklists');

    // Crear carpeta si no existe
    if (!fs.existsSync(saveFolder)) {
        fs.mkdirSync(saveFolder, { recursive: true });
    }

    const filename = `checklists_${fechaDesde}_al_${fechaHasta}.xlsx`;
    const excelPath = path.join(saveFolder, filename);

    xlsx.writeFile(workbook, excelPath);

    return excelPath;
}

// Endpoint para generar archivo
app.get('/generar/checklists', async (req, res) => {
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
        return res.status(400).send('❌ Faltan parámetros "desde" y/o "hasta". Ejemplo: /generar/checklists?desde=2025-07-14&hasta=2025-07-21');
    }

    try {
        const pathArchivo = await exportarChecklistsAExcel(desde, hasta);
        res.send(`✅ Archivo generado correctamente en: ${pathArchivo}\nAhora podés descargarlo desde /descargar/checklists?desde=${desde}&hasta=${hasta}`);
    } catch (error) {
        console.error('❌ Error generando checklists:', error.message || error);
        res.status(500).send(`❌ Error generando archivo: ${error.message || error}`);
    }
});

// Endpoint para descargar archivo
app.get('/descargar/checklists', (req, res) => {
    const { desde, hasta } = req.query;

    if (!desde || !hasta) {
        return res.status(400).send('❌ Faltan parámetros "desde" y/o "hasta".');
    }

    const filename = `checklists_${desde}_al_${hasta}.xlsx`;
    const excelPath = path.join(saveFolder, filename);

    if (!fs.existsSync(excelPath)) {
        return res.status(404).send('⚠️ Archivo no encontrado. Primero generá el archivo con /generar/checklists');
    }

    res.download(excelPath, filename, (err) => {
        if (err) {
            console.error('❌ Error al enviar archivo:', err);
            res.status(500).send('❌ Error al enviar archivo.');
        }
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor activo en http://localhost:${PORT}`);
});
