/** Neighborhood / town areas keyed by city name (matches `pakistanLocations` city labels). */
export const PAKISTAN_AREAS_BY_CITY = {
  Karachi: [
    'Baldia Town',
    'Bin Qasim',
    'Clifton',
    'DHA',
    'Federal B Area',
    'Garden East',
    'Garden West',
    'Gulistan-e-Johar',
    'Gulshan-e-Iqbal',
    'Jamshed Town',
    'Keamari',
    'Korangi',
    'Landhi',
    'Lyari',
    'Malir',
    'Manzoor Colony',
    'Mehmoodabad',
    'Model Colony',
    'New Karachi',
    'North Nazimabad',
    'Orangi Town',
    'PECHS',
    'Saddar',
    'Safoora Goth',
    'Shah Faisal',
    'SITE Area',
    'Sohrab Goth',
    'Surjani Town',
    'Tariq Road',
    'Karachi Cantt',
  ],
  Lahore: [
    'Allama Iqbal Town',
    'Cantonment',
    'DHA',
    'Faisal Town',
    'Garden Town',
    'Ghari Shahu',
    'Gulberg',
    'Iqbal Town',
    'Johar Town',
    'Model Town',
    'Mughalpura',
    'Nishtar Town',
    'Ravi Town',
    'Samanabad',
    'Shadman',
    'Shahdara',
    'Township',
    'Wapda Town',
  ],
  Islamabad: [
    'Blue Area',
    'Bahria Town',
    'F-6',
    'F-7',
    'F-8',
    'F-10',
    'F-11',
    'G-6',
    'G-7',
    'G-8',
    'G-9',
    'G-10',
    'G-11',
    'G-13',
    'G-15',
    'I-8',
    'I-9',
    'I-10',
    'I-11',
  ],
  Rawalpindi: [
    'Bahria Town',
    'Chaklala',
    'Committee Chowk',
    'DHA',
    'Raja Bazaar',
    'Saddar',
    'Satellite Town',
    'Westridge',
  ],
  Faisalabad: [
    'D Ground',
    'Ghulam Muhammad Abad',
    'Jinnah Colony',
    'Madina Town',
    'Peoples Colony',
    'Susan Road',
  ],
  Multan: [
    'Bosan Road',
    'Cantt',
    'Gulgasht Colony',
    'Hussain Agahi',
    'Shah Rukn-e-Alam',
  ],
  Peshawar: [
    'Cantt',
    'Hayatabad',
    'Saddar',
    'University Town',
    'Warsak Road',
  ],
  Hyderabad: [
    'Hirabad',
    'Latifabad',
    'Qasimabad',
    'SITE Area',
  ],
  Quetta: [
    'Brewery Road',
    'Cantt',
    'Jinnah Town',
    'Satellite Town',
  ],
  Sukkur: ['Barrage Colony', 'City Center', 'Lab-e-Mehran', 'New Sukkur'],
  Gujranwala: ['Cantt', 'Civil Lines', 'Model Town', 'Peoples Colony'],
  Sialkot: ['Cantt', 'City Center', 'Ugoki Road'],
  Gujrat: ['City Center', 'Jalalpur Jattan Road', 'Shadola Road'],
  Sargodha: ['Cantt', 'City Center', 'Katchery Bazaar'],
  Bahawalpur: ['Cantt', 'Model Town', 'Satellite Town'],
  Abbottabad: ['Cantt', 'Jhangi', 'Mandian', 'Supply Bazaar'],
};

const GENERIC_AREAS = ['City Center', 'Main Bazaar', 'Industrial Area', 'Other'];

export function getPakistanAreas(city) {
  const name = String(city || '').trim();
  if (!name) return [];

  const exact = PAKISTAN_AREAS_BY_CITY[name];
  if (exact) return exact;

  const key = Object.keys(PAKISTAN_AREAS_BY_CITY).find(
    (item) => item.toLowerCase() === name.toLowerCase()
  );
  if (key) return PAKISTAN_AREAS_BY_CITY[key];

  return GENERIC_AREAS;
}
