const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'data', 'finance.json');
const MEM_DATA_FILE = path.join(__dirname, 'data', 'members.json');
const DUES_SETTINGS_FILE = path.join(__dirname, 'data', 'dues_settings.json');
const AGENCY_FILE = path.join(__dirname, 'data', 'agency_collections.json');

app.use(cors());
app.use(bodyParser.json());

// Serve Vue frontend static files
const clientDist = path.join(__dirname, '../client/dist');
if (require('fs').existsSync(clientDist)) {
    app.use(express.static(clientDist));
}

// Helper function to read data
const readData = () => {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            return [];
        }
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        // Handle potential BOM or encoding issues
        const cleanData = data.toString().trim();
        if (!cleanData) return [];
        return JSON.parse(cleanData);
    } catch (err) {
        console.error('Read data error:', err);
        return [];
    }
};

// Helper function to write data
const writeData = (data) => {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Write data error:', err);
    }
};

const readMembers = () => {
    try {
        if (!fs.existsSync(MEM_DATA_FILE)) return [];
        const data = fs.readFileSync(MEM_DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Read members error:', err);
        return [];
    }
};

const writeMembers = (data) => {
    try {
        fs.writeFileSync(MEM_DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Write members error:', err);
    }
};

const readDuesSettings = () => {
    try {
        if (!fs.existsSync(DUES_SETTINGS_FILE)) return [];
        const data = fs.readFileSync(DUES_SETTINGS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Read dues settings error:', err);
        return [];
    }
};

const writeDuesSettings = (data) => {
    try {
        fs.writeFileSync(DUES_SETTINGS_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Write dues settings error:', err);
    }
};

const readAgencyCollections = () => {
    try {
        if (!fs.existsSync(AGENCY_FILE)) return [];
        const data = fs.readFileSync(AGENCY_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Read agency collections error:', err);
        return [];
    }
};

const writeAgencyCollections = (data) => {
    try {
        fs.writeFileSync(AGENCY_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
        console.error('Write agency collections error:', err);
    }
};

// API Routes
app.get('/api/members', (req, res) => {
    res.json(readMembers());
});

app.post('/api/members', (req, res) => {
    try {
        const { name, nickname, birthday, email, phone, mobile, address, jobTitle1, jobTitle2 } = req.body;
        console.log('Incoming POST member:', req.body);
        const data = readMembers();
        const newMember = {
            id: Date.now(),
            name: name || '',
            nickname: nickname || '',
            birthday: birthday || '',
            email: email || '',
            phone: phone || '',
            mobile: mobile || '',
            address: address || '',
            jobTitle1: jobTitle1 || '',
            jobTitle2: jobTitle2 || ''
        };
        data.push(newMember);
        writeMembers(data);
        res.status(201).json(newMember);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add member' });
    }
});

app.put('/api/members/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            console.log('Invalid member ID received for PUT:', req.params.id);
            return res.status(400).json({ error: 'Invalid ID format' });
        }
        const updates = req.body;
        console.log(`Incoming PUT member ID ${id}:`, updates);
        const data = readMembers();
        const index = data.findIndex(m => m.id === id);
        if (index === -1) {
            console.log(`Member with ID ${id} not found for update`);
            return res.status(404).json({ error: 'Member not found' });
        }

        data[index] = { ...data[index], ...updates };
        writeMembers(data);
        res.json(data[index]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update member' });
    }
});

app.delete('/api/members/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            console.log('Invalid member ID received for DELETE:', req.params.id);
            return res.status(400).json({ error: 'Invalid ID format' });
        }
        console.log(`Incoming DELETE member ID ${id}`);
        const data = readMembers();
        const filtered = data.filter(m => m.id !== id);
        if (data.length === filtered.length) {
            console.log(`Member with ID ${id} not found for deletion`);
            return res.status(404).json({ error: 'Member not found' });
        }

        writeMembers(filtered);
        res.json({ message: 'Member deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete member' });
    }
});

// Dues Settings API
app.get('/api/dues-settings', (req, res) => {
    res.json(readDuesSettings());
});

app.post('/api/dues-settings', (req, res) => {
    try {
        const { category, dueDate, standardAmount } = req.body;
        const data = readDuesSettings();
        if (data.find(d => d.category === category)) {
            return res.status(400).json({ error: 'Category already exists' });
        }
        const newSetting = { category, dueDate: dueDate || '', standardAmount: parseFloat(standardAmount) || 0 };
        data.push(newSetting);
        writeDuesSettings(data);
        res.status(201).json(newSetting);
    } catch (error) {
        res.status(500).json({ error: 'Failed to add dues setting' });
    }
});

app.put('/api/dues-settings/:category', (req, res) => {
    try {
        const oldCategory = req.params.category;
        const { category, dueDate, standardAmount } = req.body;
        const data = readDuesSettings();
        const index = data.findIndex(d => d.category === oldCategory);
        if (index === -1) return res.status(404).json({ error: 'Setting not found' });

        data[index] = {
            category: category || data[index].category,
            dueDate: dueDate !== undefined ? dueDate : data[index].dueDate,
            standardAmount: standardAmount !== undefined ? parseFloat(standardAmount) : data[index].standardAmount
        };
        writeDuesSettings(data);
        res.json(data[index]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update dues setting' });
    }
});

app.delete('/api/dues-settings/:category', (req, res) => {
    try {
        const category = req.params.category;
        const data = readDuesSettings();
        const filtered = data.filter(d => d.category !== category);
        writeDuesSettings(filtered);
        res.json({ message: 'Setting deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete dues setting' });
    }
});

app.get('/api/finance', (req, res) => {
    try {
        const data = readData();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read data' });
    }
});

app.post('/api/finance', (req, res) => {
    try {
        const { type, date, item, amount, remark, member, account, fromAccount, toAccount, startPeriod, endPeriod } = req.body;
        console.log('Incoming POST request:', req.body);

        if (!type || !date || !item || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const data = readData();
        const newRecord = {
            id: Date.now(),
            type, // 'income' or 'expense'
            date,
            item,
            member: member || '',
            account: account || '',
            fromAccount: fromAccount || '',
            toAccount: toAccount || '',
            amount: parseFloat(amount),
            remark: remark || '',
            startPeriod: startPeriod || null,
            endPeriod: endPeriod || null
        };

        console.log('Saving new record:', newRecord);
        data.push(newRecord);
        writeData(data);
        res.status(201).json(newRecord);
    } catch (error) {
        console.error('Error saving data:', error);
        res.status(500).json({ error: 'Failed to save data' });
    }
});

app.post('/api/finance/batch', (req, res) => {
    try {
        const records = req.body;
        if (!Array.isArray(records)) {
            return res.status(400).json({ error: 'Payload must be an array' });
        }

        const data = readData();
        const newRecords = records.map((r, index) => ({
            ...r,
            id: Date.now() + index,
            amount: parseFloat(r.amount) || 0
        }));

        const combined = [...data, ...newRecords];
        writeData(combined);
        res.status(201).json(newRecords);
    } catch (error) {
        console.error('Error saving batch data:', error);
        res.status(500).json({ error: 'Failed to save batch data' });
    }
});

app.put('/api/finance/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { date, item, amount, remark, member, account, fromAccount, toAccount, startPeriod, endPeriod } = req.body;
        console.log(`\n>>> [VERSION v2.2] INCOMING PUT REQUEST FOR ID ${id}`);
        console.log(`>>> PAYLOAD:`, JSON.stringify(req.body, null, 2));

        const data = readData();
        const index = data.findIndex(r => r.id === id);

        if (index === -1) {
            return res.status(404).json({ error: 'Record not found' });
        }

        data[index] = {
            ...data[index],
            date: date || data[index].date,
            item: item || data[index].item,
            member: member !== undefined ? member : (data[index].member || ''),
            amount: amount !== undefined ? parseFloat(amount) : data[index].amount,
            remark: remark !== undefined ? remark : (data[index].remark || ''),
            account: account !== undefined ? account : (data[index].account || ''),
            fromAccount: fromAccount !== undefined ? fromAccount : (data[index].fromAccount || ''),
            toAccount: toAccount !== undefined ? toAccount : (data[index].toAccount || ''),
            startPeriod: startPeriod !== undefined ? startPeriod : data[index].startPeriod,
            endPeriod: endPeriod !== undefined ? endPeriod : data[index].endPeriod
        };

        console.log('Updating record into:', data[index]);
        writeData(data);
        res.json(data[index]);
    } catch (error) {
        console.error('Error updating data:', error);
        res.status(500).json({ error: 'Failed to update data' });
    }
});

app.delete('/api/finance/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        console.log(`Incoming DELETE request for ID ${id}`);

        const data = readData();
        const filteredData = data.filter(r => r.id !== id);

        if (data.length === filteredData.length) {
            return res.status(404).json({ error: 'Record not found' });
        }

        writeData(filteredData);
        res.json({ message: 'Record deleted successfully' });
    } catch (error) {
        console.error('Error deleting data:', error);
        res.status(500).json({ error: 'Failed to delete data' });
    }
});

// Agency Collections API (代收代付)
app.get('/api/agency-collections', (req, res) => {
    res.json(readAgencyCollections());
});

app.post('/api/agency-collections', (req, res) => {
    try {
        const { title, targetMembers, remark } = req.body || {};
        if (!title || !targetMembers || !Array.isArray(targetMembers) || targetMembers.length === 0) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        const data = readAgencyCollections();
        const newCollection = {
            id: Date.now(),
            title,
            targetMembers: targetMembers, // Array of {name: string, amount: number}
            paidMembers: [],
            status: 'open',
            createdDate: new Date().toISOString().split('T')[0],
            closedDate: null,
            closedAmount: null,
            remark: remark || ''
        };
        data.push(newCollection);
        writeAgencyCollections(data);
        res.status(201).json(newCollection);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create agency collection' });
    }
});

app.put('/api/agency-collections/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const updates = req.body;
        const data = readAgencyCollections();
        const index = data.findIndex(c => c.id === id);
        if (index === -1) return res.status(404).json({ error: 'Collection not found' });

        data[index] = { ...data[index], ...updates };
        writeAgencyCollections(data);
        res.json(data[index]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update agency collection' });
    }
});

app.post('/api/agency-collections/:id/pay', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { memberName, date, amount } = req.body;
        const data = readAgencyCollections();
        const index = data.findIndex(c => c.id === id);
        if (index === -1) return res.status(404).json({ error: 'Collection not found' });

        const payment = {
            memberName,
            date: date || new Date().toISOString().split('T')[0],
            amount: parseFloat(amount)
        };
        data[index].paidMembers.push(payment);
        writeAgencyCollections(data);
        res.json(data[index]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to record payment' });
    }
});

app.delete('/api/agency-collections/:id/pay/:memberName', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const memberName = decodeURIComponent(req.params.memberName);
        const data = readAgencyCollections();
        const index = data.findIndex(c => c.id === id);
        if (index === -1) return res.status(404).json({ error: 'Collection not found' });

        data[index].paidMembers = data[index].paidMembers.filter(p => p.memberName !== memberName);
        writeAgencyCollections(data);
        res.json(data[index]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to remove payment' });
    }
});

app.post('/api/agency-collections/:id/close', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { closedAmount, closedRemark } = req.body;
        const data = readAgencyCollections();
        const index = data.findIndex(c => c.id === id);
        if (index === -1) return res.status(404).json({ error: 'Collection not found' });

        data[index].status = 'closed';
        data[index].closedDate = new Date().toISOString().split('T')[0];
        data[index].closedAmount = parseFloat(closedAmount) || 0;
        data[index].closedRemark = closedRemark || '';
        writeAgencyCollections(data);
        res.json(data[index]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to close collection' });
    }
});

app.delete('/api/agency-collections/:id', (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const data = readAgencyCollections();
        const filtered = data.filter(c => c.id !== id);
        writeAgencyCollections(filtered);
        res.json({ message: 'Collection deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete collection' });
    }
});

app.get('/api/debug', (req, res) => {
    try {
        const data = readData();
        res.json({
            serverVersion: "v2.2-FINAL",
            timestamp: new Date().toISOString(),
            count: data.length,
            recordsWithPeriod: data.filter(r => r.startPeriod).length,
            sample: data.slice(-2)
        });
    } catch (error) {
        res.status(500).json({ error: 'Debug failed' });
    }
});

// SPA fallback — serve index.html for non-API routes
app.get('*', (req, res) => {
    const indexFile = path.join(__dirname, '../client/dist/index.html');
    if (require('fs').existsSync(indexFile)) {
        res.sendFile(indexFile);
    } else {
        res.status(404).send('Frontend not built yet');
    }
});

app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`SREVER STARTED AT ${new Date().toISOString()}`);
    console.log(`Server Version: 2026-02-20-V2 (Amortization Support)`);
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`=========================================`);
});
