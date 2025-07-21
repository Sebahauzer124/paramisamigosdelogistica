const axios = require('axios');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');

const API_URL = 'https://fleet.cloudfleet.com/api/v1/checklist/';
const API_TOKEN = 'GRXZmHk.Ux35aG6PkT3-sTMRYLnM4IR1YSkhqInHe';

// Leer fechas desde argumentos
const fechaDesde = process.argv[2];
const fechaHasta = process.argv[3];

if (!fechaDesde || !fechaHasta) {
    console.error('⚠️ Debés pasar las fechas como argumentos. Ej: node checklist.js 2025-07-14 2025-07-21');
    process.exit(1);
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

async function descargarChecklists() {
    try {
        console.log(`⏳ Descargando checklists desde ${fechaDesde} hasta ${fechaHasta}...`);

        let checklists = [];
        let paginaActual = 1;
        let hayMasPaginas = true;

        while (hayMasPaginas) {
            console.log(`📄 Descargando página ${paginaActual}...`);

            const response = await axios.get(API_URL, {
                headers: {
                    Authorization: `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json; charset=utf-8'
                },
                params: {
                    checklistDateFrom: `${fechaDesde}T00:00:00Z`,
                    checklistDateTo: `${fechaHasta}T23:59:59Z`,
                    page: paginaActual
                }
            });

            const datosPagina = response.data?.data || response.data || [];
            checklists = checklists.concat(datosPagina);

            const nextPage = response.headers['x-next-page'];
            hayMasPaginas = !!nextPage;
            paginaActual++;
        }

        if (checklists.length === 0) {
            console.log('⚠️ No se encontraron checklists.');
            return;
        }

        const checklistsPlanos = checklists.map(aplanarChecklist);

        const worksheet = xlsx.utils.json_to_sheet(checklistsPlanos);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, 'Checklists');

        const esServidor = process.env.RENDER === 'true' || process.env.VERCEL === '1';
        const saveFolder = esServidor ? '/tmp' : path.join(os.homedir(), 'Desktop');
        const excelPath = path.join(saveFolder, `checklists_${fechaDesde}_al_${fechaHasta}.xlsx`);

        xlsx.writeFile(workbook, excelPath);

        console.log(`✅ Archivo Excel generado en: ${excelPath}`);

    } catch (error) {
        if (error.response) {
            console.error('❌ Código de error:', error.response.status);
            console.error('❌ Mensaje API:', error.response.data);
        } else {
            console.error('❌ Error general:', error.message);
        }
    }
}

descargarChecklists();
