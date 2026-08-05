// src/controllers/leadsController.js
import { db } from '#db/knex.js';

// Get all leads
export const getAllLeads = async (req, res) => {
    const leads = await db('leads').select('*');
    res.json({ success: true, data: leads });
};

// Create a single lead
export const createLead = async (req, res) => {
    const { name, email } = req.body;
    const [newId] = await db('leads').insert({ name, email });
    res.status(201).json({ success: true, id: newId, message: 'Lead added!' });
};
