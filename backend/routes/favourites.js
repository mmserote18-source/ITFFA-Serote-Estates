const express = require('express');
const pool = require('../config/db');
const { authRequired } = require('../middleware/auth');
const { formatProperty, PROPERTY_SELECT } = require('../utils/properties');

const router = express.Router();

router.use(authRequired);

router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `${PROPERTY_SELECT}
       AND p.property_id IN (
         SELECT property_id FROM favourites WHERE user_id = ?
       )
       ORDER BY p.property_id DESC`,
      [req.user.id]
    );
    res.json(rows.map(formatProperty));
  } catch (err) {
    console.error('Favourites list error:', err);
    res.status(500).json({ error: 'Failed to load favourites' });
  }
});

router.post('/:propertyId', async (req, res) => {
  try {
    const propertyId = Number(req.params.propertyId);
    const userId = req.user.id;

    const [prop] = await pool.query(
      `SELECT property_id FROM properties WHERE property_id = ? AND status NOT IN ('archived')`,
      [propertyId]
    );
    if (!prop.length) return res.status(404).json({ error: 'Property not found' });

    const [existing] = await pool.query(
      `SELECT favourite_id FROM favourites WHERE user_id = ? AND property_id = ?`,
      [userId, propertyId]
    );

    if (existing.length) {
      await pool.query(`DELETE FROM favourites WHERE user_id = ? AND property_id = ?`, [userId, propertyId]);
      return res.json({ saved: false, message: 'Removed from favourites' });
    }

    await pool.query(`INSERT INTO favourites (user_id, property_id) VALUES (?, ?)`, [userId, propertyId]);
    res.json({ saved: true, message: 'Saved to favourites' });
  } catch (err) {
    console.error('Favourite toggle error:', err);
    res.status(500).json({ error: 'Failed to update favourite' });
  }
});

module.exports = router;
