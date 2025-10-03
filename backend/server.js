// backend/server.js

// =================================================================
// 1. IMPORTS
// =================================================================
const express = require('express');
const cors = require('cors');
const db = require('./database.js');
const multer = require('multer');
const fs = require('fs');
const pdfParser = require('pdf-parse');
// =================================================================

const app = express();
const PORT = 4000;

// Configura o multer
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}
const upload = multer({ dest: 'uploads/' });

// Middlewares
app.use(cors());
app.use(express.json());

// Rota de teste
app.get('/', (req, res) => {
    res.json({ "message": "API de Cenários Financeiros no ar!" });
});

/* --- API ENDPOINTS --- */

// LISTAR todos os cenários
app.get("/api/scenarios", (req, res) => {
    const sql = "SELECT * FROM scenarios ORDER BY name";
    db.all(sql, [], (err, rows) => {
        if (err) { return res.status(400).json({ "error": err.message }); }
        res.json({ "message": "success", "data": rows });
    });
});

// OBTER um cenário específico
app.get("/api/scenarios/:id", (req, res) => {
    const scenarioSql = "SELECT * FROM scenarios WHERE id = ?";
    const productsSql = "SELECT * FROM products WHERE scenario_id = ?";
    
    db.get(scenarioSql, [req.params.id], (err, scenario) => {
        if (err) { return res.status(400).json({ "error": err.message }); }
        if (!scenario) { return res.status(404).json({ "error": "Cenário não encontrado." });}

        db.all(productsSql, [req.params.id], (err, products) => {
            if (err) { return res.status(400).json({ "error": err.message }); }
            scenario.products = products || [];
            res.json({ "message": "success", "data": scenario });
        });
    });
});

// CRIAR um novo cenário
app.post("/api/scenarios", (req, res) => {
    const { name, margin, dollar_rate, products } = req.body;
    const sql = 'INSERT INTO scenarios (name, margin, dollar_rate) VALUES (?,?,?)';
    
    db.run(sql, [name, margin, dollar_rate], function(err) {
        if (err) { return res.status(400).json({ "error": err.message }); }
        
        const scenarioId = this.lastID;
        if (products && products.length > 0) {
            const insertProductSql = 'INSERT INTO products (scenario_id, name, base_value) VALUES (?,?,?)';
            products.forEach(p => {
                db.run(insertProductSql, [scenarioId, p.name, p.base_value]);
            });
        }
        res.status(201).json({ "message": "success", "data": { id: scenarioId, ...req.body } });
    });
});

// ATUALIZAR um cenário
app.put("/api/scenarios/:id", (req, res) => {
    const { name, margin, dollar_rate, products } = req.body;
    const scenarioId = req.params.id;

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const updateScenarioSql = `UPDATE scenarios SET name = ?, margin = ?, dollar_rate = ? WHERE id = ?`;
        db.run(updateScenarioSql, [name, margin, dollar_rate, scenarioId]);
        
        const deleteProductsSql = 'DELETE FROM products WHERE scenario_id = ?';
        db.run(deleteProductsSql, [scenarioId]);

        const insertProductSql = 'INSERT INTO products (scenario_id, name, base_value) VALUES (?,?,?)';
        products.forEach(p => {
            db.run(insertProductSql, [scenarioId, p.name, p.base_value]);
        });

        db.run('COMMIT', (err) => {
            if (err) {
                db.run('ROLLBACK');
                return res.status(400).json({ "error": err.message });
            }
            res.json({ "message": "success", "data": { id: scenarioId, ...req.body } });
        });
    });
});

// DELETAR um cenário
app.delete("/api/scenarios/:id", (req, res) => {
    const sql = 'DELETE FROM scenarios WHERE id = ?';
    db.run(sql, req.params.id, function(err) {
        if (err) { return res.status(400).json({ "error": err.message }); }
        res.json({ "message": "deleted", "changes": this.changes });
    });
});

// DUPLICAR um cenário
app.post("/api/scenarios/:id/duplicate", (req, res) => {
    const originalId = req.params.id;
    db.get("SELECT * FROM scenarios WHERE id = ?", [originalId], (err, scenario) => {
        if (err || !scenario) {
            return res.status(404).json({"error": "Cenário original não encontrado."});
        }
        
        const newName = `${scenario.name} (Cópia)`;
        db.run('INSERT INTO scenarios (name, margin, dollar_rate) VALUES (?,?,?)', [newName, scenario.margin, scenario.dollar_rate], function(err) {
            if (err) { return res.status(400).json({"error": err.message}); }
            
            const newScenarioId = this.lastID;
            db.all("SELECT * FROM products WHERE scenario_id = ?", [originalId], (err, products) => {
                if (products && products.length > 0) {
                    const insertSql = 'INSERT INTO products (scenario_id, name, base_value) VALUES (?,?,?)';
                    products.forEach(p => {
                        db.run(insertSql, [newScenarioId, p.name, p.base_value]);
                    });
                }
                res.status(201).json({"message": "success", "id": newScenarioId});
            });
        });
    });
});

// CRIAR cenário a partir de um PDF
app.post("/api/scenarios/upload", upload.single('quotePdf'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }

    try {
        const dataBuffer = fs.readFileSync(req.file.path);
        
        // =================================================================
        // A CORREÇÃO FINAL ESTÁ AQUI: Adicionamos .default
        // =================================================================
        const pdfData = await pdfParser.default(dataBuffer); 
        // =================================================================

        const lines = pdfData.text.split('\n');
        const products = [];
        
        const productRegex = /^(?:\d+\s)?(.*?)\s+(?:-?USD\s*[\d,]+\.\d{2}\s+)*(USD\s*[\d,]+\d{2})\s+USD\s*0\.00\s*\(0\.0%\s*Tax\)/;
        
        lines.forEach(line => {
            const match = line.match(productRegex);
            if (match) {
                const rawProductName = match[1].trim();
                const rawValue = match[2];
                let productName = rawProductName.split(' updated from ')[0];
                productName = productName.split(' ').slice(0, 4).join(' ').replace('ANNUAL', '').trim();
                const baseValue = parseFloat(rawValue.replace('USD', '').replace(/,/g, '').trim());
                if (productName && !isNaN(baseValue)) {
                    products.push({ name: productName, base_value: baseValue });
                }
            }
        });

        if (products.length === 0) {
            return res.status(400).json({ error: "Nenhum produto válido foi encontrado no PDF. O layout do arquivo pode ser incompatível." });
        }
        
        const scenarioName = req.file.originalname.replace(/\.pdf$/i, '');
        db.run('INSERT INTO scenarios (name, margin, dollar_rate) VALUES (?,?,?)', [scenarioName, 0.15, 5.20], function(err) {
            if (err) { return res.status(400).json({ "error": err.message }); }
            
            const scenarioId = this.lastID;
            const insertProductSql = 'INSERT INTO products (scenario_id, name, base_value) VALUES (?,?,?)';
            products.forEach(p => {
                db.run(insertProductSql, [scenarioId, p.name, p.base_value]);
            });
            res.status(201).json({ message: "Cenário criado com sucesso a partir do PDF!", data: { id: scenarioId } });
        });

    } catch (error) {
        console.error("Erro ao processar PDF:", error);
        res.status(500).json({ error: "Falha ao processar o arquivo PDF." });
    } finally {
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});