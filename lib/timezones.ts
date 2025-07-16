export interface TimezoneOption {
  value: string;
  label: string;
}

export interface TimezoneGroup {
  label: string;
  options: TimezoneOption[];
}

export const timezoneGroups: TimezoneGroup[] = [
  {
    label: 'UTC',
    options: [
      { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
    ]
  },
  {
    label: 'North America',
    options: [
      { value: 'America/New_York', label: 'New York (Eastern Time)' },
      { value: 'America/Chicago', label: 'Chicago (Central Time)' },
      { value: 'America/Denver', label: 'Denver (Mountain Time)' },
      { value: 'America/Los_Angeles', label: 'Los Angeles (Pacific Time)' },
      { value: 'America/Anchorage', label: 'Anchorage (Alaska Time)' },
      { value: 'Pacific/Honolulu', label: 'Honolulu (Hawaii Time)' },
      { value: 'America/Toronto', label: 'Toronto (Eastern Time)' },
      { value: 'America/Vancouver', label: 'Vancouver (Pacific Time)' },
      { value: 'America/Calgary', label: 'Calgary (Mountain Time)' },
      { value: 'America/Mexico_City', label: 'Mexico City (Central Time)' },
    ]
  },
  {
    label: 'Europe',
    options: [
      { value: 'Europe/London', label: 'London (GMT/BST)' },
      { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
      { value: 'Europe/Berlin', label: 'Berlin (CET/CEST)' },
      { value: 'Europe/Madrid', label: 'Madrid (CET/CEST)' },
      { value: 'Europe/Rome', label: 'Rome (CET/CEST)' },
      { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST)' },
      { value: 'Europe/Stockholm', label: 'Stockholm (CET/CEST)' },
      { value: 'Europe/Warsaw', label: 'Warsaw (CET/CEST)' },
      { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
      { value: 'Europe/Istanbul', label: 'Istanbul (TRT)' },
    ]
  },
  {
    label: 'Asia',
    options: [
      { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
      { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
      { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
      { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
      { value: 'Asia/Kolkata', label: 'Mumbai (IST)' },
      { value: 'Asia/Bangkok', label: 'Bangkok (ICT)' },
      { value: 'Asia/Seoul', label: 'Seoul (KST)' },
      { value: 'Asia/Manila', label: 'Manila (PHT)' },
      { value: 'Asia/Jakarta', label: 'Jakarta (WIB)' },
      { value: 'Asia/Dubai', label: 'Dubai (GST)' },
    ]
  },
  {
    label: 'Australia & New Zealand',
    options: [
      { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
      { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
      { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
      { value: 'Australia/Perth', label: 'Perth (AWST)' },
      { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
    ]
  },
  {
    label: 'Africa & Middle East',
    options: [
      { value: 'Africa/Cairo', label: 'Cairo (EET)' },
      { value: 'Africa/Cape_Town', label: 'Cape Town (SAST)' },
      { value: 'Africa/Nairobi', label: 'Nairobi (EAT)' },
      { value: 'Africa/Lagos', label: 'Lagos (WAT)' },
    ]
  },
  {
    label: 'South America',
    options: [
      { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
      { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART)' },
      { value: 'America/Santiago', label: 'Santiago (CLT)' },
    ]
  },
];

// Flatten for backward compatibility
export const timezones: TimezoneOption[] = timezoneGroups.flatMap(group => group.options); 