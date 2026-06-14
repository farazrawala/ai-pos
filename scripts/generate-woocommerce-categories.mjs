import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, '..', 'woocommerce_categories.csv');

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const parents = [
  'Clothing',
  'Electronics',
  'Home & Garden',
  'Sports & Outdoors',
  'Beauty & Personal Care',
  'Toys & Games',
  'Books & Media',
  'Automotive',
  'Pet Supplies',
  'Office Supplies',
  'Health & Wellness',
  'Jewelry & Watches',
  'Baby & Kids',
  'Food & Beverages',
  'Furniture',
  'Tools & Hardware',
  'Arts & Crafts',
  'Musical Instruments',
  'Travel & Luggage',
  'Shoes & Footwear',
];

const childrenByParent = {
  Clothing: ["Men's T-Shirts", "Women's Dresses", 'Kids Hoodies', 'Activewear', 'Winter Coats', 'Denim Jeans', 'Swimwear', 'Socks & Underwear'],
  Electronics: ['Smartphones', 'Laptops', 'Tablets', 'Headphones', 'Smart Watches', 'Cameras', 'Gaming Consoles', 'TV & Home Theater'],
  'Home & Garden': ['Kitchen Appliances', 'Bedding', 'Bathroom Accessories', 'Lighting', 'Garden Tools', 'Outdoor Furniture', 'Storage & Organization', 'Home Decor'],
  'Sports & Outdoors': ['Camping Gear', 'Cycling', 'Fitness Equipment', 'Team Sports', 'Hiking Boots', 'Water Sports', 'Golf', 'Yoga & Pilates'],
  'Beauty & Personal Care': ['Skincare', 'Makeup', 'Hair Care', 'Fragrances', 'Nail Care', "Men's Grooming", 'Bath & Body', 'Sun Care'],
  'Toys & Games': ['Action Figures', 'Board Games', 'Educational Toys', 'Puzzles', 'Remote Control', 'Dolls & Playsets', 'Outdoor Play', 'Building Blocks'],
  'Books & Media': ['Fiction', 'Non-Fiction', "Children's Books", 'Comics & Manga', 'Audiobooks', 'Magazines', 'Textbooks', 'E-Reader Accessories'],
  Automotive: ['Car Care', 'Interior Accessories', 'Exterior Accessories', 'Motorcycle Gear', 'Tires & Wheels', 'Tools & Equipment', 'Oils & Fluids', 'GPS & Electronics'],
  'Pet Supplies': ['Dog Food', 'Cat Food', 'Pet Toys', 'Aquarium Supplies', 'Bird Supplies', 'Pet Grooming', 'Pet Beds', 'Leashes & Collars'],
  'Office Supplies': ['Pens & Pencils', 'Notebooks', 'Printers & Ink', 'Desk Organizers', 'Paper Products', 'Binders & Folders', 'Calculators', 'Whiteboards'],
  'Health & Wellness': ['Vitamins & Supplements', 'First Aid', 'Medical Devices', 'Massage & Relaxation', 'Oral Care', 'Vision Care', 'Mobility Aids', 'Fitness Trackers'],
  'Jewelry & Watches': ['Necklaces', 'Earrings', 'Bracelets', 'Rings', 'Luxury Watches', 'Fashion Watches', "Men's Jewelry", 'Engagement Rings'],
  'Baby & Kids': ['Diapers & Wipes', 'Baby Clothing', 'Strollers', 'Car Seats', 'Feeding', 'Nursery Furniture', 'Maternity', 'School Supplies'],
  'Food & Beverages': ['Snacks', 'Coffee & Tea', 'Pantry Staples', 'Organic Foods', 'Beverages', 'Spices & Seasonings', 'Baking Supplies', 'Gourmet Gifts'],
  Furniture: ['Living Room', 'Bedroom', 'Dining Room', 'Office Furniture', 'Mattresses', 'Kids Furniture', 'Outdoor Furniture', 'Storage Furniture'],
  'Tools & Hardware': ['Power Tools', 'Hand Tools', 'Plumbing', 'Electrical', 'Paint & Supplies', 'Safety Equipment', 'Fasteners', 'Measuring Tools'],
  'Arts & Crafts': ['Painting Supplies', 'Sewing & Knitting', 'Scrapbooking', 'Beading & Jewelry Making', 'Drawing & Sketching', 'Craft Kits', 'Fabric', 'Party Supplies'],
  'Musical Instruments': ['Guitars', 'Keyboards & Pianos', 'Drums & Percussion', 'Wind Instruments', 'String Instruments', 'DJ Equipment', 'Microphones', 'Sheet Music'],
  'Travel & Luggage': ['Carry-On Bags', 'Checked Luggage', 'Backpacks', 'Travel Accessories', 'Passport Holders', 'Packing Organizers', 'Travel Pillows', 'Garment Bags'],
  'Shoes & Footwear': ["Men's Sneakers", "Women's Heels", 'Running Shoes', 'Boots', 'Sandals', 'Slippers', 'Work & Safety Shoes', 'Kids Shoes'],
};

const descTemplates = [
  'Shop our curated selection of {name} for everyday use and special occasions.',
  'Discover premium {name} with fast shipping and easy returns.',
  'Best-selling {name} for online shoppers — quality you can trust.',
  'Explore top-rated {name} at competitive prices.',
  'New arrivals in {name} — updated weekly for our WooCommerce store.',
  'Affordable {name} designed for comfort, style, and durability.',
  'Browse {name} from trusted brands in our catalog.',
  'Limited-time deals on popular {name} items.',
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const rows = [];
const usedSlugs = new Set();

const addRow = (name, parent = '') => {
  let slug = slugify(name);
  let n = 2;
  while (usedSlugs.has(slug)) {
    slug = `${slugify(name)}-${n++}`;
  }
  usedSlugs.add(slug);
  const desc = pick(descTemplates).replace('{name}', name.toLowerCase());
  rows.push({ name, slug, description: desc, parent });
};

parents.forEach((p) => addRow(p, ''));
parents.forEach((p) => {
  (childrenByParent[p] || []).slice(0, 4).forEach((k) => addRow(k, p));
});

const escapeCsv = (v) => {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

const header = 'name,slug,description,parent';
const lines = [
  header,
  ...rows.map((r) => [r.name, r.slug, r.description, r.parent].map(escapeCsv).join(',')),
];

fs.writeFileSync(outPath, `\ufeff${lines.join('\r\n')}`, 'utf8');
console.log(`Wrote ${rows.length} categories to ${outPath}`);
