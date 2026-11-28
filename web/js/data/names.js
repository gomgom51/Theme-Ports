// Noms propres du monde, selon le pays : noms de navires (par langue du port d'attache de l'armateur, ou du
// port où le courtier le propose) et noms des compagnies de l'ordinateur (tirés de leur ville). Des noms
// inventés : jamais une vraie compagnie. Le pool français est SHIP_NAMES (data/ships.js), le défaut.
import { SHIP_NAMES } from './ships.js';

// Langue des noms de navires, par pavillon (les autres : français).
const REGION_OF_FLAG = {
  US: 'en', CA: 'en', AU: 'en', NZ: 'en', ZA: 'en', NG: 'en', GH: 'en', KE: 'en', IN: 'en', PK: 'en', LK: 'en', SG: 'en', BD: 'en', PH: 'en', VN: 'en', IL: 'en',
  ES: 'es', AR: 'es', CO: 'es', MX: 'es', CL: 'es', VE: 'es', PA: 'es',
  BR: 'pt', AO: 'pt',
  NL: 'nord', DE: 'nord', PL: 'nord',
  RU: 'ru',
  GR: 'gr', IT: 'it', RO: 'it', TR: 'tr',
  SA: 'ar', AE: 'ar', QA: 'ar', EG: 'ar', LY: 'ar', DZ: 'ar', MA: 'ar', IR: 'fa',
  CN: 'zh', HK: 'zh', JP: 'ja', KR: 'ko', KP: 'ko', ID: 'ms', MY: 'ms',
};

export const SHIP_NAME_POOLS = {
  fr: SHIP_NAMES,
  en: ['Sea Breeze', 'Northern Star', 'Ocean Pride', 'Morning Tide', 'Silver Gull', 'Cape Endeavour', 'Southern Cross', 'Atlantic Dawn',
    'Pacific Wren', 'Harbour Light', 'Stormy Petrel', 'Lady Grace', 'Fair Wind', 'Blue Heron', 'Kestrel', 'Evening Swell', 'Highland Mist', 'Coral Sun'],
  es: ['Estrella del Mar', 'Brisa', 'Gaviota', 'Mar Azul', 'Viento Sur', 'Alborada', 'Cruz del Sur', 'Lucero', 'Marea Alta', 'Santa Lucía',
    'Delfín', 'Rosa de los Vientos', 'Faro Austral', 'Golondrina', 'Pampero', 'Bahía Serena'],
  pt: ['Estrela do Mar', 'Gaivota', 'Maré Alta', 'Vento Norte', 'Aurora Atlântica', 'Cruzeiro do Sul', 'Brisa Tropical', 'Baía Azul',
    'Boa Esperança', 'Sereia', 'Garça', 'Lua Nova', 'Ilha Bela', 'Andorinha', 'Onda Verde', 'Kianda'],
  nord: ['Nordwind', 'Möwe', 'Seestern', 'Elbe', 'Hanse', 'Sturmvogel', 'Noorderlicht', 'Zeemeeuw', 'Waddenzee', 'Vrijheid', 'Bałtyk',
    'Mewa', 'Wiking', 'Polarstern', 'Helgoland', 'Zuiderkruis'],
  ru: ['Sibir', 'Neva', 'Volna', 'Baïkal', 'Kapitan Belov', 'Akademik Orlov', 'Severnaïa Zvezda', 'Amour', 'Tchaïka', 'Taïmyr', 'Pomor',
    'Belomorie', 'Kamtchatka', 'Altaï', 'Irtych', 'Ladoga'],
  gr: ['Poséidon', 'Aegean Star', 'Kalliopi', 'Agios Nikolaos', 'Ourania', 'Meltemi', 'Délos', 'Ionian Spirit', 'Kyma', 'Nefeli', 'Elpida',
    'Andros', 'Thira', 'Argonaute', 'Astra', 'Ithaki'],
  it: ['Stella Maris', 'Libeccio', 'Maestrale', 'Gabbiano', 'Portofino', 'Laguna', 'Marina', 'Aurora Ligure', 'Vento di Levante', 'Capri',
    'Sirena', 'Tramonto', 'Ostro', 'Grecale', 'Bonaccia', 'Lanterna'],
  tr: ['Poyraz', 'Martı', 'Yıldız', 'Deniz', 'Karadeniz', 'Lodos', 'Akdeniz', 'Mavi Dalga', 'Ege', 'Rüzgâr', 'Kırlangıç', 'Toros', 'Fırtına',
    'Yakamoz', 'Kumru', 'Anadolu'],
  ar: ['Al Bahr', 'Najm al Bahr', 'Al Nour', 'Badr', 'Al Salam', 'Dana', 'Yasmine', 'Rimal', 'Nakhil', 'Al Majd', 'Loulou', 'Marjan',
    'Al Waha', 'Sindbad', 'Zahra', 'Qamar'],
  fa: ['Darya', 'Setareh', 'Kish', 'Hormoz', 'Parvaz', 'Alborz', 'Simorgh', 'Nasim', 'Mehr', 'Arvand', 'Golestan', 'Tara'],
  zh: ['Hai Xing', 'Xiang Yun', 'Hua Hai', 'Ming Zhu', 'Jin Long', 'Feng Shun', 'Chang Jiang', 'Hai Ou', 'An Kang', 'Fu Xing', 'Bai Lu',
    'Qing Shan', 'Hong Fu', 'Yong Sheng', 'Xin Hai', 'Ping An'],
  ja: ['Asahi Maru', 'Kaiyo Maru', 'Hikari Maru', 'Sakura Maru', 'Shinsei Maru', 'Fuji Maru', 'Kamome Maru', 'Seiun Maru', 'Nagisa Maru',
    'Hayate Maru', 'Tsubasa Maru', 'Shiokaze Maru', 'Hokuto Maru', 'Akatsuki Maru', 'Minato Maru', 'Kirishima Maru'],
  ko: ['Hanbada', 'Haenuri', 'Saebyeok', 'Pado', 'Hanra', 'Galmaegi', 'Mirae', 'Arirang', 'Nuri', 'Dasom', 'Bada', 'Saenal', 'Haesol',
    'Baekdu', 'Byeol', 'Dongbaek'],
  ms: ['Bintang Laut', 'Samudra', 'Mutiara', 'Angin Timur', 'Nusantara', 'Camar', 'Pelangi', 'Bahari', 'Sinar Bahari', 'Laut Biru', 'Merpati',
    'Dewi Laut', 'Tanjung', 'Rajawali', 'Bayu', 'Seri Selat'],
};
export const ALL_SHIP_NAMES = Object.values(SHIP_NAME_POOLS).flat();
export const shipNamePool = (flag) => SHIP_NAME_POOLS[REGION_OF_FLAG[flag]] || SHIP_NAMES;

// Compagnies de l'ordinateur : un nom tiré de leur ville, dans le style du pays ({c} : la ville).
const COMPANY_STYLES = {
  fr: ['Armement {c}', '{c} Marine'], en: ['{c} Sealines', '{c} Ocean Carriers'], es: ['Naviera {c}', '{c} Marítima'],
  pt: ['Navegação {c}', '{c} Marítima'], nord: ['{c} Reederei', '{c} Seefracht'], ru: ['{c} Morflot', '{c} Sudokhodstvo'],
  gr: ['{c} Navigation', '{c} Maritime'], it: ['Navigazione {c}', '{c} Armatori'], tr: ['{c} Denizcilik', '{c} Lines'],
  ar: ['{c} Marine', '{c} Sea Lines'], fa: ['{c} Darya Lines', '{c} Marine'], zh: ['{c} Ocean', '{c} Haiyun'],
  ja: ['{c} Kaiun', '{c} Kisen'], ko: ['{c} Haeun', '{c} Marine'], ms: ['{c} Pelayaran', '{c} Marine'],
};
// Nom d'une compagnie de l'ordinateur basée à `city` (nom affiché du port), pavillon `flag` ; pick(liste) choisit.
export function companyNameFor(city, flag, pick) {
  return pick(COMPANY_STYLES[REGION_OF_FLAG[flag] || 'fr']).replace('{c}', city);
}
