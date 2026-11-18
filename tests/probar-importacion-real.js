// Prueba la importación con los Excel reales de datos-privados/ (no se sube a GitHub).
// Uso:  node tests/probar-importacion-real.js
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { filasAClientes, planificarImportacion } from '../js/importar.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const archivo = path.join(raiz, 'datos-privados', 'Clientes_Bonilla_para_app.xlsx');
if (!fs.existsSync(archivo)) { console.log('No está', archivo); process.exit(0); }

// Cargar SheetJS (lib/xlsx.full.min.js) igual que en el navegador
const ctx = {};
vm.runInNewContext(fs.readFileSync(path.join(raiz, 'lib', 'xlsx.full.min.js'), 'utf8'), ctx);
const XLSX = ctx.XLSX;

function filas(ruta, hoja) {
  const wb = XLSX.read(fs.readFileSync(ruta), { type: 'buffer', cellDates: true });
  const nombre = wb.SheetNames.find((n) => n === hoja) || wb.SheetNames[0];
  return XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: false, defval: '' });
}

const leido = filasAClientes(filas(archivo, 'Clientes'));
const plan = planificarImportacion(leido.clientes, [], { fecha: '2026-11-18', archivo: path.basename(archivo), columnas: leido.columnas });
console.log('CLIENTES:', plan.resumen);
console.log('Columnas ignoradas:', leido.ignoradas);
console.log(`Avisos (${leido.avisos.length}):`);
for (const a of leido.avisos) console.log('  -', a);
const conHora = plan.nuevos.filter((c) => c.horaApertura).map((c) => `${c.codigo} ${c.horaApertura}`);
console.log('Con hora de apertura:', conHora.length, conHora.join(', '));
console.log('De baja por CERRADO:', plan.nuevos.filter((c) => c.estado === 'baja').map((c) => c.codigo).join(', '));
const porDia = [1, 2, 3, 4, 5].map((d) => plan.nuevos.filter((c) => c.estado === 'activo' && c.diasLlamada.includes(d)).length);
console.log('Activos por día L-M-X-J-V:', porDia.join(' - '));
const c1 = plan.nuevos.find((c) => c.codigo === 'C001');
console.log('C001:', c1.nombreComercial, '|', c1.poblacion, '|', c1.telefonos.length, 'teléfonos');

// Promociones
const promo = path.join(raiz, 'datos-privados', 'Promociones_semana_plantilla.xlsx');
if (fs.existsSync(promo)) {
  const f = filas(promo, 'Promociones');
  const validas = f.slice(1).filter((r) => String(r[0] || '').trim() && !/^EJEMPLO/i.test(String(r[0]).trim()));
  console.log(`PROMOCIONES: ${f.length - 1} filas, ${validas.length} válidas (se ignoran las que empiezan por «EJEMPLO»)`);
}
