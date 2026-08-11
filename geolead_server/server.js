const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
app.use(cors());
// Kiwify envia webhook em formato application/x-www-form-urlencoded na maioria das vezes, mas também pode ser JSON.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ROTA 1: WEBHOOK DO KIWIFY
app.post('/webhook/kiwify', (req, res) => {
    try {
        const payload = req.body;
        console.log('Webhook recebido:', JSON.stringify(payload));

        // A estrutura exata depende do Kiwify. Geralmente é payload.Customer.email e payload.order_status
        const email = payload.Customer?.email || payload.email;
        const status = payload.order_status || payload.status;

        if (!email || !status) {
            return res.status(400).send('Faltando email ou status');
        }

        const normalizedEmail = email.toLowerCase().trim();

        if (status === 'paid' || status === 'approved') {
            // Insere ou atualiza o status para pago
            db.get(`SELECT id FROM licenses WHERE email = ?`, [normalizedEmail], (err, row) => {
                if (row) {
                    db.run(`UPDATE licenses SET status = 'paid' WHERE email = ?`, [normalizedEmail]);
                } else {
                    db.run(`INSERT INTO licenses (email, status) VALUES (?, 'paid')`, [normalizedEmail]);
                }
            });
        } else if (status === 'refunded' || status === 'chargedback') {
            // Revoga o acesso
            db.run(`UPDATE licenses SET status = 'revoked' WHERE email = ?`, [normalizedEmail]);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('Erro no webhook:', error);
        res.status(500).send('Erro interno');
    }
});

// ROTA 2: VALIDAÇÃO DA EXTENSÃO (CHAMADA PELO CHROME)
app.post('/api/validate', (req, res) => {
    const { email, device_id } = req.body;

    if (!email || !device_id) {
        return res.status(400).json({ valid: false, message: 'E-mail ou ID do aparelho ausente.' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    db.get(`SELECT * FROM licenses WHERE email = ?`, [normalizedEmail], (err, row) => {
        if (err) {
            return res.status(500).json({ valid: false, message: 'Erro no servidor' });
        }

        if (!row) {
            return res.status(404).json({ valid: false, message: 'E-mail não localizado nas compras aprovadas.' });
        }

        if (row.status !== 'paid') {
            return res.status(403).json({ valid: false, message: 'Esta compra foi reembolsada ou recusada.' });
        }

        // Se o device_id estiver em branco no banco, é a primeira vez que o cliente faz login
        if (!row.device_id) {
            db.run(`UPDATE licenses SET device_id = ? WHERE email = ?`, [device_id, normalizedEmail], (updateErr) => {
                if (updateErr) return res.status(500).json({ valid: false, message: 'Erro ao vincular aparelho.' });
                return res.json({ valid: true, message: 'Licença vinculada e ativada com sucesso!' });
            });
        } else {
            // Se já tem um device_id, tem que ser exatamente o mesmo (impede compartilhamento)
            if (row.device_id === device_id) {
                return res.json({ valid: true, message: 'Licença validada com sucesso!' });
            } else {
                return res.status(403).json({ valid: false, message: 'Esta licença já está sendo usada em outro computador/conta Google. O compartilhamento é bloqueado.' });
            }
        }
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Servidor de licenças rodando na porta ${PORT}`);
});
