/**
 * Centralized Agricultural Crop Configuration
 * Primary district: Warangal, Telangana, India
 */

const CROPS = {
  cotton: {
    cropId: 'cotton',
    canonicalName: 'Cotton',
    displayNameEn: 'Cotton',
    displayNameTe: 'పత్తి (Patti)',
    commodityCodes: [15],
    priceUnit: '₹/Quintal',
    arrivalUnit: 'Tonnes',
    imagePath: '/crops/cotton.png',
    varietyExample: 'Bramha, DCH-32'
  },
  dry_chillies: {
    cropId: 'dry_chillies',
    canonicalName: 'Dry Chillies',
    displayNameEn: 'Dry Chillies',
    displayNameTe: 'ఎండు మిర్చి (Endu Mirchi)',
    commodityCodes: [113, 132],
    priceUnit: '₹/Quintal',
    arrivalUnit: 'Tonnes',
    imagePath: '/crops/dry_chillies.png',
    varietyExample: '1st Sort, Teja'
  },
  maize: {
    cropId: 'maize',
    canonicalName: 'Maize',
    displayNameEn: 'Maize',
    displayNameTe: 'మొక్కజొన్న (Mokkajonna)',
    commodityCodes: [4],
    priceUnit: '₹/Quintal',
    arrivalUnit: 'Tonnes',
    imagePath: '/crops/maize.png',
    varietyExample: 'Hybrid Yellow'
  },
  turmeric: {
    cropId: 'turmeric',
    canonicalName: 'Turmeric',
    displayNameEn: 'Turmeric',
    displayNameTe: 'పసుపు (Pasupu)',
    commodityCodes: [35],
    priceUnit: '₹/Quintal',
    arrivalUnit: 'Tonnes',
    imagePath: '/crops/turmeric.png',
    varietyExample: 'Finger, Bulb'
  },
  groundnut: {
    cropId: 'groundnut',
    canonicalName: 'Groundnut',
    displayNameEn: 'Groundnut',
    displayNameTe: 'వేరుశనగ / పల్లీ (Verusanaga)',
    commodityCodes: [10],
    priceUnit: '₹/Quintal',
    arrivalUnit: 'Tonnes',
    imagePath: '/crops/groundnut.png',
    varietyExample: 'Pods, Bold'
  },
  paddy: {
    cropId: 'paddy',
    canonicalName: 'Paddy',
    displayNameEn: 'Paddy',
    displayNameTe: 'వరి / వడ్లు (Vari / Vadlu)',
    commodityCodes: [2],
    priceUnit: '₹/Quintal',
    arrivalUnit: 'Tonnes',
    imagePath: '/crops/paddy.png',
    varietyExample: 'Paddy(Common), BPT'
  },
  red_gram: {
    cropId: 'red_gram',
    canonicalName: 'Red Gram',
    displayNameEn: 'Red Gram',
    displayNameTe: 'కందులు (Kandulu)',
    commodityCodes: [45],
    priceUnit: '₹/Quintal',
    arrivalUnit: 'Tonnes',
    imagePath: '/crops/red_gram.png',
    varietyExample: 'Red, White'
  }
};

const WARANGAL_MARKETS = [
  'Warangal APMC',
  'Kesamudram APMC',
  'Jangaon APMC',
  'Mahabubabad APMC',
  'Narsampet APMC',
  'Nekkonda APMC',
  'Mulugu APMC',
  'Wardhannapet APMC',
  'Thorrur APMC',
  'Parkal APMC',
  'Station Ghanpur',
  'Cherial APMC'
];

module.exports = { CROPS, WARANGAL_MARKETS };

