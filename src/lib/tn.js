// Tamil Nadu administrative reference points.
// District headquarters coordinates are approximate reference points used for
// map centring, district selection and distance estimation. They are NOT a
// survey-grade boundary dataset: no district polygon geometry is bundled.

export const TN_CENTER = { lat: 10.85, lng: 78.55 };

export const TN_BOUNDS = { north: 13.6, south: 8.0, west: 76.1, east: 80.45 };

export const TN_DISTRICTS = [
  { id: "ariyalur", name: "Ariyalur", nameTa: "அரியலூர்", lat: 11.14, lng: 79.08 },
  { id: "chengalpattu", name: "Chengalpattu", nameTa: "செங்கல்பட்டு", lat: 12.68, lng: 79.99 },
  { id: "chennai", name: "Chennai", nameTa: "சென்னை", lat: 13.0827, lng: 80.2707 },
  { id: "coimbatore", name: "Coimbatore", nameTa: "கோயம்புத்தூர்", lat: 11.0168, lng: 76.9558 },
  { id: "cuddalore", name: "Cuddalore", nameTa: "கடலூர்", lat: 11.748, lng: 79.7714 },
  { id: "dharmapuri", name: "Dharmapuri", nameTa: "தர்மபுரி", lat: 12.1211, lng: 78.1586 },
  { id: "dindigul", name: "Dindigul", nameTa: "திண்டுக்கல்", lat: 10.3673, lng: 77.9803 },
  { id: "erode", name: "Erode", nameTa: "ஈரோடு", lat: 11.341, lng: 77.7172 },
  { id: "kallakurichi", name: "Kallakurichi", nameTa: "கள்ளக்குறிச்சி", lat: 11.7385, lng: 78.96 },
  { id: "kanchipuram", name: "Kanchipuram", nameTa: "காஞ்சிபுரம்", lat: 12.8342, lng: 79.7036 },
  { id: "kanyakumari", name: "Kanyakumari", nameTa: "கன்னியாகுமரி", lat: 8.0883, lng: 77.5385 },
  { id: "karur", name: "Karur", nameTa: "கரூர்", lat: 10.9601, lng: 78.0766 },
  { id: "krishnagiri", name: "Krishnagiri", nameTa: "கிருஷ்ணகிரி", lat: 12.5186, lng: 78.2137 },
  { id: "madurai", name: "Madurai", nameTa: "மதுரை", lat: 9.9252, lng: 78.1198 },
  { id: "mayiladuthurai", name: "Mayiladuthurai", nameTa: "மயிலாடுதுறை", lat: 11.1018, lng: 79.6529 },
  { id: "nagapattinam", name: "Nagapattinam", nameTa: "நாகப்பட்டினம்", lat: 10.7659, lng: 79.8449 },
  { id: "namakkal", name: "Namakkal", nameTa: "நாமக்கல்", lat: 11.2189, lng: 78.1677 },
  { id: "nilgiris", name: "Nilgiris", nameTa: "நீலகிரி", lat: 11.4102, lng: 76.695 },
  { id: "perambalur", name: "Perambalur", nameTa: "பெரம்பலூர்", lat: 11.2333, lng: 78.8833 },
  { id: "pudukkottai", name: "Pudukkottai", nameTa: "புதுக்கோட்டை", lat: 10.3833, lng: 78.8001 },
  { id: "ramanathapuram", name: "Ramanathapuram", nameTa: "இராமநாதபுரம்", lat: 9.3639, lng: 78.8395 },
  { id: "ranipet", name: "Ranipet", nameTa: "இராணிப்பேட்டை", lat: 12.9249, lng: 79.33 },
  { id: "salem", name: "Salem", nameTa: "சேலம்", lat: 11.6643, lng: 78.146 },
  { id: "sivaganga", name: "Sivaganga", nameTa: "சிவகங்கை", lat: 9.8433, lng: 78.4809 },
  { id: "tenkasi", name: "Tenkasi", nameTa: "தென்காசி", lat: 8.9594, lng: 77.3152 },
  { id: "thanjavur", name: "Thanjavur", nameTa: "தஞ்சாவூர்", lat: 10.787, lng: 79.1378 },
  { id: "theni", name: "Theni", nameTa: "தேனி", lat: 10.0104, lng: 77.4768 },
  { id: "thoothukudi", name: "Thoothukudi", nameTa: "தூத்துக்குடி", lat: 8.7642, lng: 78.1348 },
  { id: "tiruchirappalli", name: "Tiruchirappalli", nameTa: "திருச்சிராப்பள்ளி", lat: 10.7905, lng: 78.7047 },
  { id: "tirunelveli", name: "Tirunelveli", nameTa: "திருநெல்வேலி", lat: 8.7139, lng: 77.7567 },
  { id: "tirupathur", name: "Tirupathur", nameTa: "திருப்பத்தூர்", lat: 12.4954, lng: 78.5678 },
  { id: "tiruppur", name: "Tiruppur", nameTa: "திருப்பூர்", lat: 11.1085, lng: 77.3411 },
  { id: "tiruvallur", name: "Tiruvallur", nameTa: "திருவள்ளூர்", lat: 13.1231, lng: 79.9113 },
  { id: "tiruvannamalai", name: "Tiruvannamalai", nameTa: "திருவண்ணாமலை", lat: 12.2253, lng: 79.0747 },
  { id: "tiruvarur", name: "Tiruvarur", nameTa: "திருவாரூர்", lat: 10.7724, lng: 79.6368 },
  { id: "vellore", name: "Vellore", nameTa: "வேலூர்", lat: 12.9165, lng: 79.1325 },
  { id: "viluppuram", name: "Viluppuram", nameTa: "விழுப்புரம்", lat: 11.9401, lng: 79.4861 },
  { id: "virudhunagar", name: "Virudhunagar", nameTa: "விருதுநகர்", lat: 9.568, lng: 77.9624 },
];

export const DISTRICT_BY_ID = Object.fromEntries(TN_DISTRICTS.map((d) => [d.id, d]));

export function districtLabel(id, lang) {
  const d = DISTRICT_BY_ID[id];
  if (!d) return id || "—";
  return lang === "ta" ? d.nameTa : d.name;
}

// The 12 supported hazard classes. `key` matches the Hazard entity enum.
export const HAZARD_TYPES = [
  { key: "flood", en: "Flood / urban inundation", ta: "வெள்ளம் / நகர வெள்ளம்", tone: "severe" },
  { key: "stagnation", en: "Water stagnation", ta: "நீர் தேக்கம்", tone: "elevated" },
  { key: "damaged_road", en: "Potholes / damaged road", ta: "சேதமடைந்த சாலை", tone: "caution" },
  { key: "closure", en: "Bridge failure / road closure", ta: "சாலை மூடல்", tone: "severe" },
  { key: "cyclone", en: "Cyclone / severe storm", ta: "புயல்", tone: "severe" },
  { key: "tsunami", en: "Tsunami", ta: "சுனாமி", tone: "severe" },
  { key: "earthquake", en: "Earthquake", ta: "நிலநடுக்கம்", tone: "elevated" },
  { key: "landslide", en: "Landslide", ta: "நிலச்சரிவு", tone: "elevated" },
  { key: "fire", en: "Fire / smoke", ta: "தீ / புகை", tone: "severe" },
  { key: "industrial", en: "Industrial / chemical", ta: "தொழிற்சாலை அவசரநிலை", tone: "severe" },
  { key: "debris", en: "Debris / blocked evacuation route", ta: "இடிபாடுகள்", tone: "elevated" },
  { key: "other", en: "Other verified emergency", ta: "பிற அவசரநிலை", tone: "caution" },
];

export const HAZARD_BY_KEY = Object.fromEntries(HAZARD_TYPES.map((h) => [h.key, h]));

export function hazardLabel(key, lang) {
  const h = HAZARD_BY_KEY[key];
  if (!h) return key || "—";
  return lang === "ta" ? h.ta : h.en;
}