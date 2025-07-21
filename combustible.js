const axios = require('axios');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const os = require('os');

const API_URL = 'https://fleet.cloudfleet.com/api/v1/vehicles/';
const API_TOKEN = 'GRXZmHk.Ux35aG6PkT3-sTMRYLnM4IR1YSkhqInHe';

const esServidor = process.env.RENDER === 'true' || process.env.VERCEL === '1';
const saveFolder = esServidor ? '/tmp' : path.join(os.homedir(), 'Desktop');
const excelFilename = 'vehiculos.xlsx';
const excelPath = path.join(saveFolder, excelFilename);

function formatoFecha(fecha) {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-AR');
}

async function obtenerVehiculos() {
    let vehiculos = [];
    let paginaActual = 1;
    let hayMasPaginas = true;

    while (hayMasPaginas) {
        try {
            const response = await axios.get(API_URL, {
                headers: {
                    Authorization: `Bearer ${API_TOKEN}`,
                    'Content-Type': 'application/json; charset=utf-8'
                },
                params: { page: paginaActual }
            });

            const datosPagina = response.data?.data || response.data || [];
            vehiculos = vehiculos.concat(datosPagina);

            const nextPage = response.headers['x-next-page'];
            hayMasPaginas = !!nextPage;
            paginaActual++;

        } catch (error) {
            console.error('❌ Error:', error.response?.data || error.message);
            break;
        }
    }

    return vehiculos;
}

async function exportarVehiculosAExcel() {
    const vehiculos = await obtenerVehiculos();

    if (vehiculos.length === 0) {
        console.log('⚠️ No se encontraron vehículos.');
        return;
    }

    const datosSimplificados = vehiculos.map(v => ({
        Código: v.code || '-',
        Tipo: v.typeName || '-',
        Marca: v.brandName || '-',
        Línea: v.lineName || '-',
        Color: v.color?.trim() || '-',
        Año: v.year || '-',
        Combustible: v.mainFuelType || '-',
        Ciudad: v.city?.name || '-',
        CentroCosto: v.costCenter?.name || '-',
        Conductor: v.driver?.name || '-',
        Odómetro: v.odometer?.lastMeter || '-',
        FechaOdómetro: formatoFecha(v.odometer?.lastMeterAt),
        FechaCompra: formatoFecha(v.purchaseDate),
        PrecioCompra: v.purchasePrice || '-'
    }));

    const worksheet = xlsx.utils.json_to_sheet(datosSimplificados);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Vehículos');

    xlsx.writeFile(workbook, excelPath);

    console.log(`✅ Archivo Excel generado en: ${excelPath}`);
}

exportarVehiculosAExcel();
