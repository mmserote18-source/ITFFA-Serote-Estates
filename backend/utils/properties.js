// Shared property formatting utilities used by both public and admin routes.

// Hardcoded avatars and titles for the three seeded agent accounts.
// These are placeholder values because the DB does not store profile photos.
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

// Converts a raw DB row into the flat object shape consumed by the frontend.
function formatProperty(row) {
  const suburb = row.suburb || '';
  const city = row.city || '';
  return {
    id: row.property_id,
    title: row.title,
    description: row.description || '',
    // Combine suburb + city into a single display string, omitting suburb when absent.
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
    // Fallback image is an Unsplash photo so cards never render a broken image.
    image: row.primary_image || 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=600&q=80',
    images: row.images || (row.primary_image ? [row.primary_image] : []),
    featured: Boolean(row.is_featured),
  };
}

// Base SELECT used by every property query. Ends with WHERE so callers can AND on
// additional conditions without repeating the joins. Archived listings are always excluded.
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
