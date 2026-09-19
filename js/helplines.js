// =====================================================
// CAREGIVER HUB – Emergency Helplines Data
// =====================================================

export const INDIA_HELPLINES = [
  {
    flag: '🇮🇳',
    org: 'National Emergency',
    name: 'All Emergencies',
    number: '112',
    description: 'Police, Fire, Medical – single emergency number for India',
    color: '#ef4444',
  },
  {
    flag: '🚑',
    org: 'National Ambulance Service',
    name: 'Medical Ambulance',
    number: '108',
    description: 'Free ambulance service across India, 24/7',
    color: '#f97316',
  },
  {
    flag: '👴',
    org: 'Ministry of Social Justice',
    name: 'Elder Line',
    number: '14567',
    description: 'National helpline for senior citizens – counseling & support',
    color: '#8b5cf6',
  },
  {
    flag: '🧠',
    org: 'NIMHANS Bangalore',
    name: 'Mental Health & Dementia',
    number: '080-46110007',
    description: 'National Institute of Mental Health & Neurosciences helpline',
    color: '#0891b2',
  },
  {
    flag: '🤝',
    org: 'ARDSI',
    name: "Alzheimer's Helpline",
    number: '1800-102-4174',
    description: "Alzheimer's & Related Disorders Society of India – toll-free",
    color: '#10b981',
  },
  {
    flag: '🏥',
    org: 'iCall / NIMHANS',
    name: 'Caregiver Mental Health',
    number: '9152987821',
    description: 'Psychosocial support and counseling for caregivers',
    color: '#6366f1',
  },
];

export const GLOBAL_HELPLINES = {
  IN: { flag: '🇮🇳', country: 'India',     number: '112',  description: 'National Emergency Number' },
  US: { flag: '🇺🇸', country: 'USA',       number: '911',  description: 'Police, Fire, Medical Emergency' },
  UK: { flag: '🇬🇧', country: 'UK',        number: '999',  description: 'Police, Fire, Medical Emergency' },
  EU: { flag: '🇪🇺', country: 'Europe',    number: '112',  description: 'EU-wide Emergency Number' },
  AU: { flag: '🇦🇺', country: 'Australia', number: '000',  description: 'Police, Fire, Ambulance' },
  CA: { flag: '🇨🇦', country: 'Canada',    number: '911',  description: 'Police, Fire, Medical Emergency' },
  SG: { flag: '🇸🇬', country: 'Singapore', number: '995',  description: 'Ambulance & Fire Brigade' },
};

export const DOCTORS = [
  // ── India – Chennai ──────────────────────────────────
  {
    id: 'd1', emoji: '🧠',
    name: 'Dr. Priya Menon',
    specialization: 'Neurologist – Dementia Specialist',
    hospital: 'Apollo Hospitals', city: 'Chennai', country: 'India',
    address: '21 Greams Lane, Thousand Lights, Chennai 600006',
    phone: '+91 44 2829 3333',
    experience: '18 yrs exp', rating: '4.9', fee: '₹800',
    lat: 13.0607, lng: 80.2492,
    slots: ['09:00 AM', '10:30 AM', '02:00 PM', '04:30 PM'],
  },
  // ── India – Bangalore ────────────────────────────────
  {
    id: 'd2', emoji: '👴',
    name: 'Dr. Suresh Iyer',
    specialization: 'Geriatrician',
    hospital: 'Manipal Hospitals', city: 'Bangalore', country: 'India',
    address: '98 Rustom Bagh, Airport Rd, Bangalore 560017',
    phone: '+91 80 2222 4444',
    experience: '22 yrs exp', rating: '4.8', fee: '₹700',
    lat: 12.9631, lng: 77.6395,
    slots: ['10:00 AM', '11:30 AM', '03:00 PM'],
  },
  // ── India – Delhi (AIIMS) ─────────────────────────────
  {
    id: 'd3', emoji: '🧬',
    name: 'Dr. Ananya Sharma',
    specialization: 'Neuropsychologist',
    hospital: 'AIIMS Delhi', city: 'New Delhi', country: 'India',
    address: 'Sri Aurobindo Marg, Ansari Nagar, New Delhi 110029',
    phone: '+91 11 2659 3308',
    experience: '14 yrs exp', rating: '4.7', fee: '₹600',
    lat: 28.5672, lng: 77.2100,
    slots: ['09:30 AM', '01:00 PM', '03:30 PM', '05:00 PM'],
  },
  // ── India – Mumbai ───────────────────────────────────
  {
    id: 'd4', emoji: '🏥',
    name: 'Dr. Ramesh Gupta',
    specialization: 'Geriatric Psychiatrist',
    hospital: 'Fortis Healthcare', city: 'Mumbai', country: 'India',
    address: 'Mulund Goregaon Link Rd, Nahur, Mumbai 400078',
    phone: '+91 22 6799 9999',
    experience: '16 yrs exp', rating: '4.8', fee: '₹750',
    lat: 19.1632, lng: 72.9363,
    slots: ['10:30 AM', '12:00 PM', '04:00 PM'],
  },
  // ── India – Hyderabad ────────────────────────────────
  {
    id: 'd5', emoji: '🧠',
    name: 'Dr. Kavitha Reddy',
    specialization: 'Neurologist – Alzheimer's Specialist',
    hospital: 'Yashoda Hospitals', city: 'Hyderabad', country: 'India',
    address: 'Raj Bhavan Rd, Somajiguda, Hyderabad 500082',
    phone: '+91 40 4567 4567',
    experience: '20 yrs exp', rating: '4.9', fee: '₹900',
    lat: 17.4126, lng: 78.4071,
    slots: ['09:00 AM', '11:00 AM', '02:30 PM', '05:00 PM'],
  },
  // ── India – Kolkata ──────────────────────────────────
  {
    id: 'd6', emoji: '👴',
    name: 'Dr. Debashis Roy',
    specialization: 'Geriatrician & Memory Care',
    hospital: 'Apollo Gleneagles Hospitals', city: 'Kolkata', country: 'India',
    address: '58 Canal Circular Rd, Kadapara, Kolkata 700054',
    phone: '+91 33 2320 3040',
    experience: '17 yrs exp', rating: '4.7', fee: '₹650',
    lat: 22.5804, lng: 88.3961,
    slots: ['10:00 AM', '12:30 PM', '04:00 PM'],
  },
  // ── India – Pune ─────────────────────────────────────
  {
    id: 'd7', emoji: '🧬',
    name: 'Dr. Meera Joshi',
    specialization: 'Neuropsychiatrist',
    hospital: 'Ruby Hall Clinic', city: 'Pune', country: 'India',
    address: '40 Sassoon Rd, Camp, Pune 411001',
    phone: '+91 20 6645 6645',
    experience: '12 yrs exp', rating: '4.6', fee: '₹550',
    lat: 18.5254, lng: 73.8724,
    slots: ['09:30 AM', '11:00 AM', '03:00 PM', '05:30 PM'],
  },
  // ── India – Ahmedabad ────────────────────────────────
  {
    id: 'd8', emoji: '🏥',
    name: 'Dr. Nikhil Patel',
    specialization: 'Geriatrician',
    hospital: 'Sterling Hospitals', city: 'Ahmedabad', country: 'India',
    address: 'Off Gurukul Rd, Memnagar, Ahmedabad 380052',
    phone: '+91 79 4000 6000',
    experience: '15 yrs exp', rating: '4.5', fee: '₹500',
    lat: 23.0525, lng: 72.5671,
    slots: ['10:00 AM', '01:00 PM', '04:00 PM'],
  },
  // ── International – UK ───────────────────────────────
  {
    id: 'd9', emoji: '🧠',
    name: 'Dr. Eleanor Hughes',
    specialization: 'Consultant Neurologist',
    hospital: "King's College Hospital", city: 'London', country: 'UK',
    address: "Denmark Hill, London SE5 9RS",
    phone: '+44 20 3299 9000',
    experience: '21 yrs exp', rating: '4.9', fee: '£150',
    lat: 51.4683, lng: -0.0945,
    slots: ['09:00 AM', '11:00 AM', '02:00 PM'],
  },
  // ── International – USA ──────────────────────────────
  {
    id: 'd10', emoji: '👴',
    name: 'Dr. James Harrington',
    specialization: 'Geriatric Medicine & Dementia Care',
    hospital: 'Mayo Clinic', city: 'Rochester, MN', country: 'USA',
    address: '200 First St SW, Rochester, MN 55905',
    phone: '+1 507 284 2511',
    experience: '25 yrs exp', rating: '5.0', fee: '$350',
    lat: 44.0224, lng: -92.4668,
    slots: ['08:00 AM', '10:00 AM', '01:00 PM', '03:30 PM'],
  },
  // ── International – Singapore ────────────────────────
  {
    id: 'd11', emoji: '🧬',
    name: 'Dr. Lim Wei Ling',
    specialization: 'Neurologist – Memory Disorders',
    hospital: 'National Neuroscience Institute', city: 'Singapore', country: 'Singapore',
    address: '11 Jln Tan Tock Seng, Singapore 308433',
    phone: '+65 6357 7000',
    experience: '16 yrs exp', rating: '4.8', fee: 'SGD 200',
    lat: 1.3216, lng: 103.8461,
    slots: ['09:00 AM', '11:30 AM', '02:00 PM'],
  },
  // ── International – Australia ────────────────────────
  {
    id: 'd12', emoji: '🏥',
    name: 'Dr. Sarah Mitchell',
    specialization: 'Geriatrician & Dementia Specialist',
    hospital: "Royal Prince Alfred Hospital", city: 'Sydney', country: 'Australia',
    address: 'Missenden Rd, Camperdown NSW 2050',
    phone: '+61 2 9515 6111',
    experience: '19 yrs exp', rating: '4.7', fee: 'AUD 250',
    lat: -33.8882, lng: 151.1835,
    slots: ['09:30 AM', '11:00 AM', '03:00 PM'],
  },
];
