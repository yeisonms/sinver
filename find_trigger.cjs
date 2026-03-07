const fs = require('fs');
const content = fs.readFileSync('d:\\proyectos2026\\sinver\\esquema_completo.sql', 'utf8');

const lines = content.split('\n');
lines.forEach((line, index) => {
    if (line.toLowerCase().includes('total_sold')) {
        console.log(`Line ${index + 1}: ${line}`);
    }
});
