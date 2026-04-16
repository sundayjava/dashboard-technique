import { geolocation } from '@vercel/functions';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

/**
 * Comprehensive mapping of ISO country codes to international dial codes
 * Sorted alphabetically by country code for easy maintenance
 */
const COUNTRY_TO_DIAL_CODE: Record<string, string> = {
  // A
  'AD': '+376', // Andorra
  'AE': '+971', // UAE
  'AF': '+93',  // Afghanistan
  'AG': '+1',   // Antigua and Barbuda
  'AL': '+355', // Albania
  'AM': '+374', // Armenia
  'AO': '+244', // Angola
  'AR': '+54',  // Argentina
  'AT': '+43',  // Austria
  'AU': '+61',  // Australia
  'AZ': '+994', // Azerbaijan
  
  // B
  'BA': '+387', // Bosnia and Herzegovina
  'BB': '+1',   // Barbados
  'BD': '+880', // Bangladesh
  'BE': '+32',  // Belgium
  'BF': '+226', // Burkina Faso
  'BG': '+359', // Bulgaria
  'BH': '+973', // Bahrain
  'BI': '+257', // Burundi
  'BJ': '+229', // Benin
  'BR': '+55',  // Brazil
  'BS': '+1',   // Bahamas
  'BT': '+975', // Bhutan
  'BW': '+267', // Botswana
  
  // C
  'CA': '+1',   // Canada
  'CD': '+243', // Democratic Republic of the Congo
  'CF': '+236', // Central African Republic
  'CG': '+242', // Republic of the Congo
  'CH': '+41',  // Switzerland
  'CI': '+225', // Côte d'Ivoire
  'CL': '+56',  // Chile
  'CM': '+237', // Cameroon
  'CN': '+86',  // China
  'CO': '+57',  // Colombia
  'CR': '+506', // Costa Rica
  'CU': '+53',  // Cuba
  'CY': '+357', // Cyprus
  'CZ': '+420', // Czech Republic
  
  // D
  'DE': '+49',  // Germany
  'DJ': '+253', // Djibouti
  'DK': '+45',  // Denmark
  'DO': '+1',   // Dominican Republic
  'DZ': '+213', // Algeria
  
  // E
  'EC': '+593', // Ecuador
  'EE': '+372', // Estonia
  'EG': '+20',  // Egypt
  'ER': '+291', // Eritrea
  'ES': '+34',  // Spain
  'ET': '+251', // Ethiopia
  
  // F
  'FI': '+358', // Finland
  'FJ': '+679', // Fiji
  'FR': '+33',  // France
  
  // G
  'GA': '+241', // Gabon
  'GB': '+44',  // United Kingdom
  'GE': '+995', // Georgia
  'GH': '+233', // Ghana
  'GM': '+220', // Gambia
  'GN': '+224', // Guinea
  'GQ': '+240', // Equatorial Guinea
  'GR': '+30',  // Greece
  'GT': '+502', // Guatemala
  'GW': '+245', // Guinea-Bissau
  'GY': '+592', // Guyana
  
  // H
  'HK': '+852', // Hong Kong
  'HN': '+504', // Honduras
  'HR': '+385', // Croatia
  'HT': '+509', // Haiti
  'HU': '+36',  // Hungary
  
  // I
  'ID': '+62',  // Indonesia
  'IE': '+353', // Ireland
  'IL': '+972', // Israel
  'IN': '+91',  // India
  'IQ': '+964', // Iraq
  'IR': '+98',  // Iran
  'IS': '+354', // Iceland
  'IT': '+39',  // Italy
  
  // J
  'JM': '+1',   // Jamaica
  'JO': '+962', // Jordan
  'JP': '+81',  // Japan
  
  // K
  'KE': '+254', // Kenya
  'KG': '+996', // Kyrgyzstan
  'KH': '+855', // Cambodia
  'KR': '+82',  // South Korea
  'KW': '+965', // Kuwait
  'KZ': '+7',   // Kazakhstan
  
  // L
  'LA': '+856', // Laos
  'LB': '+961', // Lebanon
  'LI': '+423', // Liechtenstein
  'LK': '+94',  // Sri Lanka
  'LR': '+231', // Liberia
  'LS': '+266', // Lesotho
  'LT': '+370', // Lithuania
  'LU': '+352', // Luxembourg
  'LV': '+371', // Latvia
  'LY': '+218', // Libya
  
  // M
  'MA': '+212', // Morocco
  'MC': '+377', // Monaco
  'MD': '+373', // Moldova
  'ME': '+382', // Montenegro
  'MG': '+261', // Madagascar
  'MK': '+389', // North Macedonia
  'ML': '+223', // Mali
  'MM': '+95',  // Myanmar
  'MN': '+976', // Mongolia
  'MR': '+222', // Mauritania
  'MT': '+356', // Malta
  'MU': '+230', // Mauritius
  'MV': '+960', // Maldives
  'MW': '+265', // Malawi
  'MX': '+52',  // Mexico
  'MY': '+60',  // Malaysia
  'MZ': '+258', // Mozambique
  
  // N
  'NA': '+264', // Namibia
  'NE': '+227', // Niger
  'NG': '+234', // Nigeria
  'NI': '+505', // Nicaragua
  'NL': '+31',  // Netherlands
  'NO': '+47',  // Norway
  'NP': '+977', // Nepal
  'NZ': '+64',  // New Zealand
  
  // O
  'OM': '+968', // Oman
  
  // P
  'PA': '+507', // Panama
  'PE': '+51',  // Peru
  'PG': '+675', // Papua New Guinea
  'PH': '+63',  // Philippines
  'PK': '+92',  // Pakistan
  'PL': '+48',  // Poland
  'PT': '+351', // Portugal
  'PY': '+595', // Paraguay
  
  // Q
  'QA': '+974', // Qatar
  
  // R
  'RO': '+40',  // Romania
  'RS': '+381', // Serbia
  'RU': '+7',   // Russia
  'RW': '+250', // Rwanda
  
  // S
  'SA': '+966', // Saudi Arabia
  'SC': '+248', // Seychelles
  'SD': '+249', // Sudan
  'SE': '+46',  // Sweden
  'SG': '+65',  // Singapore
  'SI': '+386', // Slovenia
  'SK': '+421', // Slovakia
  'SL': '+232', // Sierra Leone
  'SN': '+221', // Senegal
  'SO': '+252', // Somalia
  'SR': '+597', // Suriname
  'SS': '+211', // South Sudan
  'ST': '+239', // São Tomé and Príncipe
  'SV': '+503', // El Salvador
  'SY': '+963', // Syria
  'SZ': '+268', // Eswatini
  
  // T
  'TD': '+235', // Chad
  'TG': '+228', // Togo
  'TH': '+66',  // Thailand
  'TJ': '+992', // Tajikistan
  'TM': '+993', // Turkmenistan
  'TN': '+216', // Tunisia
  'TR': '+90',  // Turkey
  'TT': '+1',   // Trinidad and Tobago
  'TW': '+886', // Taiwan
  'TZ': '+255', // Tanzania
  
  // U
  'UA': '+380', // Ukraine
  'UG': '+256', // Uganda
  'US': '+1',   // United States
  'UY': '+598', // Uruguay
  'UZ': '+998', // Uzbekistan
  
  // V
  'VE': '+58',  // Venezuela
  'VN': '+84',  // Vietnam
  
  // Y
  'YE': '+967', // Yemen
  
  // Z
  'ZA': '+27',  // South Africa
  'ZM': '+260', // Zambia
  'ZW': '+263', // Zimbabwe
};

/**
 * Geolocation API Route
 * Uses Vercel's edge geolocation to detect user's country and return dial code
 * Falls back to US (+1) if country is not detected or not in mapping
 */
export async function GET(request: NextRequest) {
  try {
    const { country } = geolocation(request);
    
    // Get dial code from mapping, default to US (+1)
    const dialCode = country ? COUNTRY_TO_DIAL_CODE[country] || '+1' : '+1';
    
    return Response.json({
      success: true,
      country_calling_code: dialCode,
      country_code: country || 'US',
    });
  } catch (error) {
    // Fallback to US dial code on any error
    console.error('Geolocation detection failed:', error);
    
    return Response.json({
      success: false,
      country_calling_code: '+1',
      country_code: 'US',
      error: 'Geolocation detection failed, using default',
    });
  }
}
