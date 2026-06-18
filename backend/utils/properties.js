const AGENT_AVATARS = {
  2: 'https://i.pravatar.cc/150?img=47',
  3: 'https://i.pravatar.cc/150?img=12',
  4: 'https://i.pravatar.cc/150?img=45',
};

const AGENT_TITLES = {
  2: 'Senior Property Consultant',
  3: 'Residential Sales Agent',
  4: 'Rental Specialist',
};

function formatProperty(row) {
  const suburb = row.suburb || '';
  const city = row.city || '';
  return {
    id: row.property_id,
    title: row.title,
    description: row.description || '',
    location: suburb ? `${suburb}, ${city}` : city,
    suburb,
    city,
    price: Number(row.price),
    type: row.property_type,
    status: row.status,
    beds: row.bedrooms,
    baths: row.bathrooms,
    parking: row.parking_bays,
    sqm: row.floor_size_m2 ? Number(row.floor_size_m2) : 0,
    agent: row.agent_name,
    agentId: row.agent_id,
    agentEmail: row.agent_email || null,
    agentPhone: row.agent_phone || null,
    agentAvatar: AGENT_AVATARS[row.agent_id] || 'https://i.pravatar.cc/150?img=1',
    agentTitle: AGENT_TITLES[row.agent_id] || 'Property Agent',
    image: row.primary_image || 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80',
    images: row.images || (row.primary_image ? [row.primary_image] : []),
    featured: Boolean(row.is_featured),
  };
}

const PROPERTY_SELECT = `
  SELECT
    p.property_id,
    p.agent_id,
    p.title,
    p.description,
    p.property_type,
    p.status,
    p.price,
    p.suburb,
    p.city,
    p.bedrooms,
    p.bathrooms,
    p.parking_bays,
    p.floor_size_m2,
    p.is_featured,
    u.full_name AS agent_name,
    u.email AS agent_email,
    u.phone AS agent_phone,
    (SELECT pi.image_url FROM property_images pi
     WHERE pi.property_id = p.property_id AND pi.is_primary = 1
     LIMIT 1) AS primary_image
  FROM properties p
  JOIN users u ON u.user_id = p.agent_id
  WHERE p.status NOT IN ('archived')
`;

module.exports = { formatProperty, PROPERTY_SELECT, AGENT_AVATARS, AGENT_TITLES };
