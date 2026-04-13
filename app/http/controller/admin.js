const Admin = require('../../models/Admin');

class AdminController {
    async index(req, res) {
        try {
            const admins = await Admin.find();
            res.json(admins);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async store(req, res) {
        try {
            const admin = new Admin(req.body);
            await admin.save();
            res.status(201).json(admin);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async show(req, res) {
        try {
            const admin = await Admin.findById(req.params.id);
            if (!admin) return res.status(404).json({ error: 'Not found' });
            res.json(admin);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async update(req, res) {
        try {
            const admin = await Admin.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!admin) return res.status(404).json({ error: 'Not found' });
            res.json(admin);
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    }

    async destroy(req, res) {
        try {
            const admin = await Admin.findByIdAndDelete(req.params.id);
            if (!admin) return res.status(404).json({ error: 'Not found' });
            res.json({ message: 'Deleted' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new AdminController();