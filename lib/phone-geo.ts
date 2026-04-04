/**
 * F0142: Caller geographic data
 * F0143: Multi-location routing
 *
 * Phone number geolocation utilities using NANP (North American Numbering Plan)
 */

// Area code to state/city mapping (sample - would be more comprehensive in production)
export const AREA_CODE_MAP: Record<string, {
  state: string;
  stateCode: string;
  city: string;
  region: string;
  timezone: string;
}> = {
  '212': { state: 'New York', stateCode: 'NY', city: 'New York City', region: 'Northeast', timezone: 'America/New_York' },
  '213': { state: 'California', stateCode: 'CA', city: 'Los Angeles', region: 'West', timezone: 'America/Los_Angeles' },
  '214': { state: 'Texas', stateCode: 'TX', city: 'Dallas', region: 'South', timezone: 'America/Chicago' },
  '215': { state: 'Pennsylvania', stateCode: 'PA', city: 'Philadelphia', region: 'Northeast', timezone: 'America/New_York' },
  '216': { state: 'Ohio', stateCode: 'OH', city: 'Cleveland', region: 'Midwest', timezone: 'America/New_York' },
  '217': { state: 'Illinois', stateCode: 'IL', city: 'Springfield', region: 'Midwest', timezone: 'America/Chicago' },
  '218': { state: 'Minnesota', stateCode: 'MN', city: 'Duluth', region: 'Midwest', timezone: 'America/Chicago' },
  '219': { state: 'Indiana', stateCode: 'IN', city: 'Gary', region: 'Midwest', timezone: 'America/Chicago' },
  '224': { state: 'Illinois', stateCode: 'IL', city: 'Chicago', region: 'Midwest', timezone: 'America/Chicago' },
  '225': { state: 'Louisiana', stateCode: 'LA', city: 'Baton Rouge', region: 'South', timezone: 'America/Chicago' },
  '228': { state: 'Mississippi', stateCode: 'MS', city: 'Gulfport', region: 'South', timezone: 'America/Chicago' },
  '229': { state: 'Georgia', stateCode: 'GA', city: 'Albany', region: 'South', timezone: 'America/New_York' },
  '231': { state: 'Michigan', stateCode: 'MI', city: 'Traverse City', region: 'Midwest', timezone: 'America/Detroit' },
  '234': { state: 'Ohio', stateCode: 'OH', city: 'Akron', region: 'Midwest', timezone: 'America/New_York' },
  '239': { state: 'Florida', stateCode: 'FL', city: 'Fort Myers', region: 'South', timezone: 'America/New_York' },
  '240': { state: 'Maryland', stateCode: 'MD', city: 'Rockville', region: 'South', timezone: 'America/New_York' },
  '248': { state: 'Michigan', stateCode: 'MI', city: 'Troy', region: 'Midwest', timezone: 'America/Detroit' },
  '251': { state: 'Alabama', stateCode: 'AL', city: 'Mobile', region: 'South', timezone: 'America/Chicago' },
  '252': { state: 'North Carolina', stateCode: 'NC', city: 'Greenville', region: 'South', timezone: 'America/New_York' },
  '253': { state: 'Washington', stateCode: 'WA', city: 'Tacoma', region: 'West', timezone: 'America/Los_Angeles' },
  '254': { state: 'Texas', stateCode: 'TX', city: 'Waco', region: 'South', timezone: 'America/Chicago' },
  '256': { state: 'Alabama', stateCode: 'AL', city: 'Huntsville', region: 'South', timezone: 'America/Chicago' },
  '260': { state: 'Indiana', stateCode: 'IN', city: 'Fort Wayne', region: 'Midwest', timezone: 'America/Indiana/Indianapolis' },
  '262': { state: 'Wisconsin', stateCode: 'WI', city: 'Milwaukee', region: 'Midwest', timezone: 'America/Chicago' },
  '267': { state: 'Pennsylvania', stateCode: 'PA', city: 'Philadelphia', region: 'Northeast', timezone: 'America/New_York' },
  '269': { state: 'Michigan', stateCode: 'MI', city: 'Kalamazoo', region: 'Midwest', timezone: 'America/Detroit' },
  '270': { state: 'Kentucky', stateCode: 'KY', city: 'Bowling Green', region: 'South', timezone: 'America/Chicago' },
  '281': { state: 'Texas', stateCode: 'TX', city: 'Houston', region: 'South', timezone: 'America/Chicago' },
  '301': { state: 'Maryland', stateCode: 'MD', city: 'Bethesda', region: 'South', timezone: 'America/New_York' },
  '302': { state: 'Delaware', stateCode: 'DE', city: 'Wilmington', region: 'South', timezone: 'America/New_York' },
  '303': { state: 'Colorado', stateCode: 'CO', city: 'Denver', region: 'West', timezone: 'America/Denver' },
  '304': { state: 'West Virginia', stateCode: 'WV', city: 'Charleston', region: 'South', timezone: 'America/New_York' },
  '305': { state: 'Florida', stateCode: 'FL', city: 'Miami', region: 'South', timezone: 'America/New_York' },
  '310': { state: 'California', stateCode: 'CA', city: 'Santa Monica', region: 'West', timezone: 'America/Los_Angeles' },
  '312': { state: 'Illinois', stateCode: 'IL', city: 'Chicago', region: 'Midwest', timezone: 'America/Chicago' },
  '313': { state: 'Michigan', stateCode: 'MI', city: 'Detroit', region: 'Midwest', timezone: 'America/Detroit' },
  '314': { state: 'Missouri', stateCode: 'MO', city: 'St. Louis', region: 'Midwest', timezone: 'America/Chicago' },
  '315': { state: 'New York', stateCode: 'NY', city: 'Syracuse', region: 'Northeast', timezone: 'America/New_York' },
  '316': { state: 'Kansas', stateCode: 'KS', city: 'Wichita', region: 'Midwest', timezone: 'America/Chicago' },
  '317': { state: 'Indiana', stateCode: 'IN', city: 'Indianapolis', region: 'Midwest', timezone: 'America/Indiana/Indianapolis' },
  '318': { state: 'Louisiana', stateCode: 'LA', city: 'Shreveport', region: 'South', timezone: 'America/Chicago' },
  '319': { state: 'Iowa', stateCode: 'IA', city: 'Cedar Rapids', region: 'Midwest', timezone: 'America/Chicago' },
  '320': { state: 'Minnesota', stateCode: 'MN', city: 'St. Cloud', region: 'Midwest', timezone: 'America/Chicago' },
  '321': { state: 'Florida', stateCode: 'FL', city: 'Orlando', region: 'South', timezone: 'America/New_York' },
  '323': { state: 'California', stateCode: 'CA', city: 'Los Angeles', region: 'West', timezone: 'America/Los_Angeles' },
  '330': { state: 'Ohio', stateCode: 'OH', city: 'Akron', region: 'Midwest', timezone: 'America/New_York' },
  '404': { state: 'Georgia', stateCode: 'GA', city: 'Atlanta', region: 'South', timezone: 'America/New_York' },
  '415': { state: 'California', stateCode: 'CA', city: 'San Francisco', region: 'West', timezone: 'America/Los_Angeles' },
  '512': { state: 'Texas', stateCode: 'TX', city: 'Austin', region: 'South', timezone: 'America/Chicago' },
  '617': { state: 'Massachusetts', stateCode: 'MA', city: 'Boston', region: 'Northeast', timezone: 'America/New_York' },
  '702': { state: 'Nevada', stateCode: 'NV', city: 'Las Vegas', region: 'West', timezone: 'America/Los_Angeles' },
  '713': { state: 'Texas', stateCode: 'TX', city: 'Houston', region: 'South', timezone: 'America/Chicago' },
  '714': { state: 'California', stateCode: 'CA', city: 'Anaheim', region: 'West', timezone: 'America/Los_Angeles' },
  '718': { state: 'New York', stateCode: 'NY', city: 'Brooklyn', region: 'Northeast', timezone: 'America/New_York' },
  '720': { state: 'Colorado', stateCode: 'CO', city: 'Denver', region: 'West', timezone: 'America/Denver' },
  '773': { state: 'Illinois', stateCode: 'IL', city: 'Chicago', region: 'Midwest', timezone: 'America/Chicago' },
  '786': { state: 'Florida', stateCode: 'FL', city: 'Miami', region: 'South', timezone: 'America/New_York' },
  '917': { state: 'New York', stateCode: 'NY', city: 'New York City', region: 'Northeast', timezone: 'America/New_York' },
  '949': { state: 'California', stateCode: 'CA', city: 'Irvine', region: 'West', timezone: 'America/Los_Angeles' },
};

export interface PhoneGeoData {
  areaCode: string;
  state?: string;
  stateCode?: string;
  city?: string;
  region?: string;
  timezone?: string;
  country: string;
  countryCode: string;
}

/**
 * Extracts area code from a phone number
 */
export function extractAreaCode(phoneNumber: string): string | null {
  // Remove all non-numeric characters
  const digits = phoneNumber.replace(/\D/g, '');

  // Handle +1 country code
  if (digits.startsWith('1') && digits.length === 11) {
    return digits.substring(1, 4);
  }

  // Handle 10-digit number
  if (digits.length === 10) {
    return digits.substring(0, 3);
  }

  return null;
}

/**
 * F0142: Get geographic data from phone number
 */
export function getPhoneGeoData(phoneNumber: string): PhoneGeoData | null {
  const areaCode = extractAreaCode(phoneNumber);

  if (!areaCode) {
    return null;
  }

  const geoData = AREA_CODE_MAP[areaCode];

  if (!geoData) {
    // Return basic data even if area code not in our map
    return {
      areaCode,
      country: 'United States',
      countryCode: 'US',
    };
  }

  return {
    areaCode,
    ...geoData,
    country: 'United States',
    countryCode: 'US',
  };
}

/**
 * F0143: Find nearest assistant based on caller location
 */
export async function findNearestAssistant(
  phoneNumber: string,
  assistantLocations: Array<{
    assistantId: string;
    stateCode?: string;
    region?: string;
  }>
): Promise<string | null> {
  const geoData = getPhoneGeoData(phoneNumber);

  if (!geoData || !geoData.stateCode) {
    return null; // Can't route without geo data
  }

  // Try exact state match first
  const stateMatch = assistantLocations.find(
    (loc) => loc.stateCode === geoData.stateCode
  );

  if (stateMatch) {
    return stateMatch.assistantId;
  }

  // Fall back to region match
  const regionMatch = assistantLocations.find(
    (loc) => loc.region === geoData.region
  );

  if (regionMatch) {
    return regionMatch.assistantId;
  }

  // No match found
  return null;
}
