export const DEFAULT_USER_COUNTRY = 'Pakistan';
export const DEFAULT_USER_STATE = 'Sindh';
export const DEFAULT_USER_CITY = 'Karachi';

export const USER_COUNTRY_OPTIONS = ['Pakistan'];

export const PAKISTAN_STATES = [
  'Punjab',
  'Sindh',
  'Khyber Pakhtunkhwa',
  'Balochistan',
  'Islamabad Capital Territory',
  'Gilgit-Baltistan',
  'Azad Jammu and Kashmir',
];

export const PAKISTAN_CITIES_BY_STATE = {
  Punjab: [
    'Ahmedpur East',
    'Arifwala',
    'Attock',
    'Bahawalnagar',
    'Bahawalpur',
    'Bhakkar',
    'Burewala',
    'Chakwal',
    'Chiniot',
    'Chishtian',
    'Daska',
    'Dera Ghazi Khan',
    'Faisalabad',
    'Gojra',
    'Gujar Khan',
    'Gujranwala',
    'Gujrat',
    'Hafizabad',
    'Hasilpur',
    'Jaranwala',
    'Jhang',
    'Jhelum',
    'Kamoke',
    'Kasur',
    'Khanewal',
    'Khanpur',
    'Khushab',
    'Kot Addu',
    'Lahore',
    'Layyah',
    'Lodhran',
    'Mandi Bahauddin',
    'Mianwali',
    'Multan',
    'Muridke',
    'Murree',
    'Muzaffargarh',
    'Nankana Sahib',
    'Narowal',
    'Okara',
    'Pakpattan',
    'Rahim Yar Khan',
    'Rajanpur',
    'Rawalpindi',
    'Sadiqabad',
    'Sahiwal',
    'Sargodha',
    'Sheikhupura',
    'Sialkot',
    'Taxila',
    'Toba Tek Singh',
    'Vehari',
    'Wah Cantonment',
    'Wazirabad',
  ],
  Sindh: [
    'Badin',
    'Dadu',
    'Ghotki',
    'Hala',
    'Hyderabad',
    'Jacobabad',
    'Jamshoro',
    'Kandhkot',
    'Karachi',
    'Kashmore',
    'Khairpur',
    'Kotri',
    'Larkana',
    'Matiari',
    'Mirpur Khas',
    'Mithi',
    'Naushahro Feroze',
    'Nawabshah',
    'Qambar',
    'Rohri',
    'Sanghar',
    'Sehwan',
    'Shahdadkot',
    'Shikarpur',
    'Sujawal',
    'Sukkur',
    'Tando Adam',
    'Tando Allahyar',
    'Tando Muhammad Khan',
    'Thatta',
    'Umerkot',
  ],
  'Khyber Pakhtunkhwa': [
    'Abbottabad',
    'Bannu',
    'Battagram',
    'Charsadda',
    'Chitral',
    'Dera Ismail Khan',
    'Hangu',
    'Haripur',
    'Karak',
    'Kohat',
    'Lakki Marwat',
    'Landi Kotal',
    'Mansehra',
    'Mardan',
    'Mingora',
    'Nowshera',
    'Parachinar',
    'Peshawar',
    'Swabi',
    'Tank',
    'Timergara',
  ],
  Balochistan: [
    'Chaman',
    'Dera Murad Jamali',
    'Gwadar',
    'Hub',
    'Jaffarabad',
    'Kalat',
    'Khuzdar',
    'Loralai',
    'Mastung',
    'Nushki',
    'Ormara',
    'Panjgur',
    'Pasni',
    'Pishin',
    'Quetta',
    'Sibi',
    'Turbat',
    'Usta Muhammad',
    'Uthal',
    'Zhob',
    'Ziarat',
  ],
  'Islamabad Capital Territory': ['Islamabad'],
  'Gilgit-Baltistan': ['Astore', 'Chilas', 'Gahkuch', 'Gilgit', 'Hunza', 'Khaplu', 'Nagar', 'Skardu'],
  'Azad Jammu and Kashmir': [
    'Bagh',
    'Bhimber',
    'Kotli',
    'Mirpur',
    'Muzaffarabad',
    'Pallandri',
    'Rawalakot',
  ],
};

export function getPakistanCities(state) {
  if (state && PAKISTAN_CITIES_BY_STATE[state]) {
    return PAKISTAN_CITIES_BY_STATE[state];
  }
  return Object.values(PAKISTAN_CITIES_BY_STATE)
    .flat()
    .slice()
    .sort((a, b) => a.localeCompare(b));
}

export function getStateForCity(city) {
  const name = String(city || '').trim();
  if (!name) return '';
  return (
    Object.entries(PAKISTAN_CITIES_BY_STATE).find(([, cities]) =>
      cities.some((item) => item.toLowerCase() === name.toLowerCase())
    )?.[0] || ''
  );
}

export function withCurrentOption(options, current) {
  const value = String(current || '').trim();
  if (!value) return options;
  const exists = options.some((item) => item.toLowerCase() === value.toLowerCase());
  return exists ? options : [value, ...options];
}
