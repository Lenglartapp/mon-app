
import ExcelJS from 'exceljs';

const filename = 'décors.xlsx'; // NFD normalization might be tricky, try copy-paste from find result if needed.
// Or try glob match? 
// Let's assume filename is correct.

async function read() {
    const workbook = new ExcelJS.Workbook();
    try {
        await workbook.xlsx.readFile(filename);
    } catch (e) {
        console.error("Error reading file:", e);
        // Try NFC
        try {
            await workbook.xlsx.readFile('décors.xlsx');
        } catch (e2) {
            console.error("Error reading file NFC:", e2);
            process.exit(1);
        }
    }

    const worksheet = workbook.worksheets[0];
    const data = [];

    worksheet.eachRow((row, rowNumber) => {
        data.push(row.values);
    });

    console.log(JSON.stringify(data, null, 2));
}

read();
