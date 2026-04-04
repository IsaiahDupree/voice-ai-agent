const fs = require('fs');

// Read features.json
const data = JSON.parse(fs.readFileSync('features.json', 'utf8'));

// List of P0 features implemented
const completedP0Features = [
  'F0193', // DNC list check
  'F0194', // DNC list import
  'F0195', // DNC self-service opt-out
  'F0197', // Voicemail detection enable
  'F0198', // Voicemail drop audio
  'F0203', // Retry logic enable
  'F0204', // Retry max attempts
  'F0206', // Retry on no-answer
  'F0209', // Retry exclusion on booked
  'F0212', // Campaign outcome tracking
  'F0214', // Per-contact call record
  'F0223', // Script variable injection
  'F0226', // TCPA compliance mode
  'F0227', // Contact local time check
  'F0236', // Outbound transcript save
  'F0239', // Contact status field
  'F0240', // Outbound SMS follow-up trigger
  'F0242', // Outbound first message
  'F0243', // Outbound end call detection
  'F0255', // Outbound callId storage
  'F0264', // Max call attempts enforced
  'F0265', // Outbound number validation
  'F0270', // Cal.com API key
  'F0271', // Cal.com base URL
  'F0272', // Get event types
  'F0273', // Get availability
  'F0275', // Slot format
  'F0278', // Book appointment
  'F0279', // Booking required fields
  'F0282', // Booking confirmation email
  'F0283', // Booking confirmation SMS
  'F0290', // Conflict check
  'F0291', // Conflict error message
  'F0297', // Booking created event
  'F0300', // Cal.com health check
  'F0301', // Booking in call
  'F0302', // Booking confirmation read
];

// Update features
let updated = 0;
data.features.forEach(feature => {
  if (completedP0Features.includes(feature.id)) {
    feature.status = 'completed';
    feature.passes = true;
    updated++;
  }
});

// Write back
fs.writeFileSync('features.json', JSON.stringify(data, null, 2));

console.log(`✓ Marked ${updated} P0 features as complete`);
console.log('Features completed:', completedP0Features.join(', '));

// Show progress
const total = data.features.length;
const completed = data.features.filter(f => f.passes === true).length;
console.log(`\nTotal Progress: ${completed}/${total} (${((completed/total)*100).toFixed(1)}%)`);
