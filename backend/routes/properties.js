const express = require('express');
const pool = require('../config/db');
const { formatProperty, PROPERTY_SELECT } = require('../utils/properties');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { city, type, status, minPrice, maxPrice, beds, search, sort, featured } = req.query;

    let sql = `${PROPERTY_SELECT}`;
    const params = [];

    if (featured === 'true' || featured === '1') {
      sql += ' AND p.is_featured = 1';
    }
    if (city) {
      sql += ' AND p.city = ?';
      params.push(city);
    }
    if (type) {
      sql += ' AND p.property_type = ?';
      params.push(type);
    }
    if (status) {
      sql += ' AND p.status = ?';
      params.push(status);
    }
    if (beds) {
      sql += ' AND p.bedrooms >= ?';
      params.push(Number(beds));
    }
    if (minPrice) {
      sql += ' AND p.price >= ?';
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      sql += ' AND p.price <= ?';
      params.push(Number(maxPrice));
    }
    if (search) {
      sql += ' AND (p.title LIKE ? OR p.suburb LIKE ? OR p.city LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    if (sort === 'price-asc') sql += ' ORDER BY p.price ASC';
    else if (sort === 'price-desc') sql += ' ORDER BY p.price DESC';
    else if (sort === 'newest') sql += ' ORDER BY p.created_at DESC';
    else sql += ' ORDER BY p.is_featured DESC, p.property_id DESC';

    const [rows] = await pool.query(sql, params);
    res.json(rows.map(formatProperty));
  } catch (err) {
    console.error('Properties list error:', err);
    res.status(500).json({ error: 'Failed to load properties' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid property ID' });

    const [rows] = await pool.query(`${PROPERTY_SELECT} AND p.property_id = ?`, [id]);
    if (!rows.length) return res.status(404).json({ error: 'Property not found' });

    const [images] = await pool.query(
      `SELECT image_url FROM property_images WHERE property_id = ? ORDER BY is_primary DESC, sort_order ASC`,
      [id]
    );

    const property = formatProperty(rows[0]);
    property.images = images.map(i => i.image_url);

    res.json(property);
  } catch (err) {
    console.error('Property detail error:', err);
    res.status(500).json({ error: 'Failed to load property' });
  }
});

module.exports = router;
