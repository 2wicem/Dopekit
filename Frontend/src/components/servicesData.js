import dopeSalon from './images/dope.jpg'
import dopeFrenchHeart from './images/dope0.jpg'
import dopeCoffinSet from './images/dope01.jpg'
import dopeRedFrench from './images/dope02.jpg'
import dopeStiletto from './images/dope03.jpg'
import dopeArt1 from './images/dope1.png'
import dopeArt2 from './images/dope2.png'
import dopeArt3 from './images/dope3.png'
import dopeGeometric from './images/dope5.jpg'
import dopeJeweled from './images/dope6.jpg'
import dopeKidsGel from './images/dope7.jpg'
import dopeLeopardTips from './images/dope8.jpg'
import dopeClassicGel from './images/dope9.jpg'

export const priceList = [
  { id: 'just-gel', name: 'Just gel', price: 2000, tag: 'Quick glam' },
  { id: 'builder-gel', name: 'Builder + gel', price: 3000, tag: 'Strength' },
  { id: 'tips-gel', name: 'Tips + gel', price: 3500, tag: 'Length' },
  { id: 'tips-builder-gel', name: 'Tips Builder + gel', price: 4500, tag: 'Full set' },
  { id: 'gum-gel', name: 'Gum gel', price: 4000, tag: 'Sculpted' },
  { id: 'pedicure', name: 'Pedicure', price: 3000, tag: 'Feet refresh' },
  { id: 'acrylics', name: 'Acrylics', price: 5000, tag: 'Premium' },
]

export const serviceCards = [
  {
    id: 'just-gel',
    title: 'Just gel',
    serviceName: 'Just gel',
    price: 2000,
    image: dopeClassicGel,
    alt: 'Classic gel polish in orange with rose gold glitter ombré',
    description: 'A clean gel manicure with premium polishes like Bluesky and Skywei for everyday shine.',
  },
  {
    id: 'builder-gel',
    title: 'Builder + gel',
    serviceName: 'Builder + gel',
    price: 3000,
    image: dopeGeometric,
    alt: 'Red and nude geometric builder gel with gold studs',
    description: 'Strengthened natural nails with builder gel and a glossy gel finish in your chosen colour.',
  },
  {
    id: 'tips-gel',
    title: 'Tips + gel',
    serviceName: 'Tips + gel',
    price: 3500,
    image: dopeLeopardTips,
    alt: 'Long coffin tips gel with leopard print and marble designs',
    description: 'Professional tips shaped to perfection, finished with long-lasting gel colour and art.',
  },
  {
    id: 'tips-builder-gel',
    title: 'Tips Builder + gel',
    serviceName: 'Tips Builder + gel',
    price: 4500,
    image: dopeCoffinSet,
    alt: 'Coffin tips gel set with animal print and rhinestone details',
    description: 'Extended length with builder support under gel — ideal for bold coffin, stiletto or almond shapes.',
  },
  {
    id: 'gum-gel',
    title: 'Gum gel',
    serviceName: 'Gum gel',
    price: 4000,
    image: dopeJeweled,
    alt: 'Red builder gel nails with gold beads and pearl accents',
    description: 'Flexible gum gel overlay for a natural feel with sculpted structure and luxe finish.',
  },
  {
    id: 'pedicure',
    title: 'Pedicure',
    serviceName: 'Pedicure',
    price: 3000,
    image: dopeSalon,
    alt: 'Relaxing pedicure service at Dopekit salon',
    description: 'Soak, shape, cuticle care and polish — leave with soft, refreshed feet and a clean finish.',
  },
  {
    id: 'acrylics',
    title: 'Acrylics',
    serviceName: 'Acrylics',
    price: 5000,
    image: dopeRedFrench,
    alt: 'Red and nude gel French tips with bow and heart details',
    description: 'Full acrylic sets with custom shaping, colour and optional nail art for maximum drama.',
  },
  {
    id: 'nail-art',
    title: 'Custom nail art',
    serviceName: 'Custom nail art',
    price: 5000,
    image: dopeArt1,
    alt: 'Custom nail art by Dopekit',
    description: 'Hand-painted designs, charms and details — tell us your vibe and we bring it to life.',
  },
  {
    id: 'kids-gel',
    title: 'Kids gel',
    serviceName: 'Kids gel',
    price: 1500,
    image: dopeKidsGel,
    alt: 'Shimmery pink gel manicure with cute nail art for kids',
    description: 'Gentle gel manicures for little ones with fun colours and cute, age-appropriate designs.',
  },
  {
    id: 'french-tips',
    title: 'French tips',
    serviceName: 'French tips',
    price: 2500,
    image: dopeFrenchHeart,
    alt: 'Gel French tips with heart and leopard accent nails',
    description: 'Classic or modern French tips with gel — crisp lines, glossy finish, optional accent nails.',
  },
]

export const carouselSlides = [
  {
    id: 'salon-showcase',
    title: 'Dopekit studio',
    image: dopeSalon,
    alt: 'Fresh gel manicure finished at the salon',
  },
  {
    id: 'gel-french-hearts',
    title: 'Gel French tips',
    image: dopeFrenchHeart,
    alt: 'Gel French tips with heart and leopard accent nails',
  },
  {
    id: 'tips-coffin',
    title: 'Tips gel collection',
    image: dopeCoffinSet,
    alt: 'Coffin tips gel set with animal print and rhinestone details',
  },
  {
    id: 'gel-red-french',
    title: 'Red gel art',
    image: dopeRedFrench,
    alt: 'Red and nude gel French tips with bow and heart details',
  },
  {
    id: 'builder-stiletto',
    title: 'Builder gel stiletto',
    image: dopeStiletto,
    alt: 'Long stiletto builder gel with lavender, orange and pearl accents',
  },
  {
    id: 'portfolio-1',
    title: 'Custom nail art',
    image: dopeArt1,
    alt: 'Custom nail art by Dopekit',
  },
  {
    id: 'portfolio-2',
    title: 'Bold nail designs',
    image: dopeArt2,
    alt: 'Bold nail design by Dopekit',
  },
  {
    id: 'portfolio-3',
    title: 'Statement nails',
    image: dopeArt3,
    alt: 'Statement nail art by Dopekit',
  },
  {
    id: 'builder-geometric',
    title: 'Builder gel geometric',
    image: dopeGeometric,
    alt: 'Red and nude geometric builder gel with gold studs',
  },
  {
    id: 'builder-jeweled',
    title: 'Jeweled builder gel',
    image: dopeJeweled,
    alt: 'Red builder gel nails with gold beads and pearl accents',
  },
  {
    id: 'kids-gel',
    title: 'Kids gel manicure',
    image: dopeKidsGel,
    alt: 'Shimmery pink gel manicure with cute nail art',
  },
  {
    id: 'tips-leopard',
    title: 'Tips gel & acrylic',
    image: dopeLeopardTips,
    alt: 'Long coffin tips with orange glitter and leopard French tips',
  },
  {
    id: 'classic-gel',
    title: 'Classic gel polish',
    image: dopeClassicGel,
    alt: 'Classic gel polish in orange with rose gold glitter ombré',
  },
]
